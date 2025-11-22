// routes/news.js
import express from "express";
import pool from "../db.js";
import redis from "../redis.js";
import { randomUUID } from "crypto";

const router = express.Router();

const CACHE_VERSION_KEY = "news:version";
const CACHE_TTL_SECONDS = 60;
const LOCK_KEY = "lock:news:all";
const LOCK_TTL_MS = 10000; // 拿到鎖時最多持有 10s
const WAIT_POLL_MS = 100;   // 未拿到鎖的輪詢間隔
const WAIT_TIMEOUT_MS = 9000; // 最多等 9s 再fallback

// Lua script for safe release (compare token then del)
const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

// sleep helper
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// get current version (string)
async function getCurrentVersion() {
    const v = await redis.get(CACHE_VERSION_KEY);
    return v || "0";
}

// compose cache key
function cacheKeyForVersion(v) {
    return `news:all:v${v}`;
}

// try acquire lock, return token if got, else null
async function tryAcquireLock() {
    const token = randomUUID();
    // redis.set(key, token, {NX: true, PX: LOCK_TTL_MS}) in node-redis v4:
    const ok = await redis.set(LOCK_KEY, token, { NX: true, PX: LOCK_TTL_MS });
    if (ok) return token;
    return null;
}

// safe release using Lua script
async function releaseLock(token) {
    try {
        await redis.eval(RELEASE_LOCK_SCRIPT, {
            keys: [LOCK_KEY],
            arguments: [token],
        });
    } catch (err) {
        console.error("releaseLock error:", err);
    }
}

// 1. 取得全部新聞 (有 Redis Cache + lock + version)
router.get("/", async (req, res) => {
    try {
        // 1) 先嘗試讀版本化快取
        let version = await getCurrentVersion();
        let key = cacheKeyForVersion(version);
        let cache = await redis.get(key);
        if (cache) {
            return res.json(JSON.parse(cache));
        }

        // 2) 快取 miss，嘗試拿鎖
        const token = await tryAcquireLock();
        if (token) {
            // 我拿到鎖 → 我去查 DB 並建立新快取
            try {
                const [rows] = await pool.query(
                    "SELECT * FROM news ORDER BY created_at DESC"
                );

                // 新增版本（INCR）以產生新 key，保證 atomic mapping
                const newVersion = await redis.incr(CACHE_VERSION_KEY);
                const newKey = cacheKeyForVersion(newVersion.toString());

                await redis.set(newKey, JSON.stringify(rows), {
                    EX: CACHE_TTL_SECONDS,
                });

                // 為了避免堆積太多舊 key，設定舊 key 的 TTL（可選）
                // await redis.expire(key, 5); // 讓舊 key 在短時間內過期（視情況可不做）

                // 釋放鎖（安全釋放）
                await releaseLock(token);

                return res.json(rows);
            } catch (err) {
                // 建立快取或 DB 查詢失敗，確保釋放鎖
                await releaseLock(token);
                console.error("Error querying DB or setting cache:", err);
                return res.status(500).json({ error: "Internal Server Error" });
            }
        } else {
            // 3) 沒拿到鎖 → 其他 node 可能在建立快取，等候短時間輪詢看是否有新快取
            const waitStart = Date.now();
            while (Date.now() - waitStart < WAIT_TIMEOUT_MS) {
                // check current version's key
                version = await getCurrentVersion();
                key = cacheKeyForVersion(version);
                cache = await redis.get(key);
                if (cache) {
                    return res.json(JSON.parse(cache));
                }
                await sleep(WAIT_POLL_MS);
            }

            // 4) 等超時還沒快取，為了可用性 fallback 讀 DB（保守做法）
            try {
                const [rows] = await pool.query(
                    "SELECT * FROM news ORDER BY created_at DESC"
                );
                return res.json(rows);
            } catch (err) {
                console.error("DB fallback error:", err);
                return res.status(500).json({ error: "Internal Server Error" });
            }
        }
    } catch (err) {
        console.error("GET /news error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 2. 查看單篇新聞 (有 Redis - 以 id 為 key，同樣可以套 lock 機制)
router.get("/:id", async (req, res) => {
    const id = req.params.id;
    const itemKey = `news:${id}`;
    try {
        const cache = await redis.get(itemKey);
        if (cache) {
            return res.json(JSON.parse(cache));
        }

        // 簡單的單筆鎖（可選），這裡採同樣流程但簡化處理直接查 DB 然後 set
        const [rows] = await pool.query("SELECT * FROM news WHERE id = ?", [id]);
        const data = rows[0] || {};
        await redis.set(itemKey, JSON.stringify(data), { EX: CACHE_TTL_SECONDS });

        return res.json(data);
    } catch (err) {
        console.error("GET /news/:id error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 3. 新增新聞（不直接 del all，而是 incr version）
router.post("/", async (req, res) => {
    try {
        const { title, content, category, author } = req.body;
        const [result] = await pool.query(
            "INSERT INTO news (title, content, category, author) VALUES (?, ?, ?, ?)",
            [title, content, category, author]
        );

        // 版本升級：讀者會看到新版本的 key 或下一個拿鎖的會建立
        await redis.incr(CACHE_VERSION_KEY);

        return res.json({ id: result.insertId, message: "News created" });
    } catch (err) {
        console.error("POST /news error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 4. 更新新聞（升級版本）
router.put("/:id", async (req, res) => {
    try {
        const { title, content, category, author } = req.body;
        await pool.query(
            "UPDATE news SET title=?, content=?, category=?, author=? WHERE id=?",
            [title, content, category, author, req.params.id]
        );

        // 更新時升級版本
        await redis.incr(CACHE_VERSION_KEY);
        // 選擇性地刪單筆 cache
        await redis.del(`news:${req.params.id}`);

        return res.json({ message: "News updated" });
    } catch (err) {
        console.error("PUT /news/:id error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 5. 刪除新聞
router.delete("/:id", async (req, res) => {
    try {
        await pool.query("DELETE FROM news WHERE id=?", [req.params.id]);

        // 版本升級
        await redis.incr(CACHE_VERSION_KEY);
        await redis.del(`news:${req.params.id}`);

        return res.json({ message: "News deleted" });
    } catch (err) {
        console.error("DELETE /news/:id error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;

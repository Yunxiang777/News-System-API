import redis from "../config/redis.js";
import { NewsModel } from "../models/newsModel.js";
import { RedisLock, sleep } from "../utils/redisLock.js";

const CACHE_VERSION_KEY = "news:version";
const LOCK_KEY = "lock:news:all";
const CACHE_TTL = 60;
const WAIT_TIMEOUT_MS = 9000;
const WAIT_POLL_MS = 100;

export const NewsService = {
    // Helper: 取得當前版本
    async _getCurrentVersion() {
        const v = await redis.get(CACHE_VERSION_KEY);
        return v || "0";
    },

    // 1. 取得所有新聞 (Cache + Lock 機制)
    async getAllNews() {
        let version = await this._getCurrentVersion();
        let key = `news:all:v${version}`;

        // A. 嘗試讀快取
        let cache = await redis.get(key);
        if (cache) return JSON.parse(cache);

        // B. 快取 Miss，嘗試拿鎖
        const lock = new RedisLock(LOCK_KEY);
        const acquired = await lock.tryAcquire();

        if (acquired) {
            try {
                // 拿到鎖：查 DB -> 建快取 -> 解鎖
                const data = await NewsModel.findAll();

                // 升級版本號並寫入新快取
                const newVersion = await redis.incr(CACHE_VERSION_KEY);
                const newKey = `news:all:v${newVersion}`;

                await redis.set(newKey, JSON.stringify(data), { EX: CACHE_TTL });
                return data;
            } finally {
                await lock.release();
            }
        } else {
            // C. 沒拿到鎖：輪詢等待其他 Process 建立快取
            const start = Date.now();
            while (Date.now() - start < WAIT_TIMEOUT_MS) {
                version = await this._getCurrentVersion();
                key = `news:all:v${version}`;
                cache = await redis.get(key);
                if (cache) return JSON.parse(cache);
                await sleep(WAIT_POLL_MS);
            }

            // D. 等太久，Fallback 查 DB
            return await NewsModel.findAll();
        }
    },

    // 2. 取得單筆 (簡單快取)
    async getNewsById(id) {
        const key = `news:${id}`;
        const cache = await redis.get(key);
        if (cache) return JSON.parse(cache);

        const data = await NewsModel.findById(id);
        if (data) {
            await redis.set(key, JSON.stringify(data), { EX: CACHE_TTL });
        }
        return data || {};
    },

    // 3. 建立新聞
    async createNews(data) {
        const id = await NewsModel.create(data);
        // Invalidate: 升級版本號讓列表快取失效
        await redis.incr(CACHE_VERSION_KEY);
        return id;
    },

    // 4. 更新新聞
    async updateNews(id, data) {
        await NewsModel.update(id, data);
        // Invalidate: 升級列表版本 & 刪除單筆快取
        await redis.incr(CACHE_VERSION_KEY);
        await redis.del(`news:${id}`);
    },

    // 5. 刪除新聞
    async deleteNews(id) {
        await NewsModel.delete(id);
        await redis.incr(CACHE_VERSION_KEY);
        await redis.del(`news:${id}`);
    }
};
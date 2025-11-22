import redis from "../config/redis.js";
import { randomUUID } from "crypto";

// 避免死鎖，檢查鎖，避免誤刪
const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export class RedisLock {
    constructor(key, ttlMs = 10000) {
        this.lockKey = key;
        this.ttl = ttlMs;
        this.token = null;
    }

    // 嘗試獲取鎖
    async tryAcquire() {
        this.token = randomUUID();
        // 檢查鎖，uuid避免誤刪鎖
        const ok = await redis.set(this.lockKey, this.token, { NX: true, PX: this.ttl });
        return !!ok; // return boolean
    }

    // 釋放鎖
    async release() {
        if (!this.token) return;
        try {
            await redis.eval(RELEASE_LOCK_SCRIPT, {
                keys: [this.lockKey],
                arguments: [this.token],
            });
            this.token = null;
        } catch (err) {
            console.error("Lock release error:", err);
        }
    }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
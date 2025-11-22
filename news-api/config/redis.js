// connect redis
import { createClient } from "redis";

const redis = createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
});

redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis Error:", err));

// connect redis
export const connectRedis = async () => {
    if (!redis.isOpen) await redis.connect();
};

export default redis;
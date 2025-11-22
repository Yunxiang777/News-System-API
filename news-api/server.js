import "dotenv/config"; // 確保載入 env
import express from "express";
import cors from "cors";
import { connectRedis } from "./config/redis.js";
import newsRouter from "./routes/newsRoutes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Worker PID Header Middleware
app.use((req, res, next) => {
    console.log(`PID ${process.pid} handled: ${req.method} ${req.url}`);
    res.setHeader("X-Worker-PID", process.pid);
    next();
});

// Routes
app.use("/news", newsRouter);

// Start Server
const start = async () => {
    try {
        // 確保 Redis 連線後再啟動 HTTP Server
        await connectRedis();
        // Docker環境，保留 0.0.0.0
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT} with PID ${process.pid}`);
        });
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
};

start();
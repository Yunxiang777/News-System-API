import express from "express";
import cors from "cors";
import newsRouter from "./routes/news.js";

const app = express();
app.use(cors());
app.use(express.json());

// 顯示每次 request 是哪個 cluster worker 處理
app.use((req, res, next) => {
    console.log(`PID ${process.pid} handled: ${req.method} ${req.url}`);
    res.setHeader("X-Worker-PID", process.pid);
    next();
});

// News CRUD API
app.use("/news", newsRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} with PID ${process.pid}`);
});

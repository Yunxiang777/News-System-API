import { NewsService } from "../services/newsService.js";

export const NewsController = {
    // 取得所有新聞
    async getAll(req, res) {
        try {
            const news = await NewsService.getAllNews();
            res.json(news);
        } catch (err) {
            console.error("getAll error:", err);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },

    // 取得單筆
    async getOne(req, res) {
        try {
            const news = await NewsService.getNewsById(req.params.id);
            res.json(news);
        } catch (err) {
            console.error("getOne error:", err);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },

    // 建立新聞
    async create(req, res) {
        try {
            const id = await NewsService.createNews(req.body);
            res.json({ id, message: "News created" });
        } catch (err) {
            console.error("create error:", err);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },

    // 更新新聞
    async update(req, res) {
        try {
            await NewsService.updateNews(req.params.id, req.body);
            res.json({ message: "News updated" });
        } catch (err) {
            console.error("update error:", err);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },

    // 刪除新聞
    async remove(req, res) {
        try {
            await NewsService.deleteNews(req.params.id);
            res.json({ message: "News deleted" });
        } catch (err) {
            console.error("remove error:", err);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
};
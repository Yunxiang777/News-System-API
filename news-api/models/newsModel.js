import pool from "../config/db.js";

export const NewsModel = {
    // 搜尋全部news
    async findAll() {
        const [rows] = await pool.query("SELECT * FROM news ORDER BY created_at DESC");
        return rows;
    },

    // 查詢指令new
    async findById(id) {
        const [rows] = await pool.query("SELECT * FROM news WHERE id = ?", [id]);
        return rows[0] || null;
    },

    // 新增new
    async create({ title, content, category, author }) {
        const [result] = await pool.query(
            "INSERT INTO news (title, content, category, author) VALUES (?, ?, ?, ?)",
            [title, content, category, author]
        );
        return result.insertId;
    },

    // 更新new
    async update(id, { title, content, category, author }) {
        await pool.query(
            "UPDATE news SET title=?, content=?, category=?, author=? WHERE id=?",
            [title, content, category, author, id]
        );
    },

    // 刪除new
    async delete(id) {
        await pool.query("DELETE FROM news WHERE id=?", [id]);
    }
};
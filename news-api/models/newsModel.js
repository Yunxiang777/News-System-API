import pool from "../config/db.js";

export const NewsModel = {
    async findAll() {
        const [rows] = await pool.query("SELECT * FROM news ORDER BY created_at DESC");
        return rows;
    },

    async findById(id) {
        const [rows] = await pool.query("SELECT * FROM news WHERE id = ?", [id]);
        return rows[0] || null;
    },

    async create({ title, content, category, author }) {
        const [result] = await pool.query(
            "INSERT INTO news (title, content, category, author) VALUES (?, ?, ?, ?)",
            [title, content, category, author]
        );
        return result.insertId;
    },

    async update(id, { title, content, category, author }) {
        await pool.query(
            "UPDATE news SET title=?, content=?, category=?, author=? WHERE id=?",
            [title, content, category, author, id]
        );
    },

    async delete(id) {
        await pool.query("DELETE FROM news WHERE id=?", [id]);
    }
};
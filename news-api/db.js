import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: process.env.DB_HOST,     // mysql-news-api
    port: process.env.DB_PORT,     // 3306
    user: process.env.DB_USER,     // root
    password: process.env.DB_PASS, // 123456
    database: process.env.DB_NAME  // news_db
});

export default pool;

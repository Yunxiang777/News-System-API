CREATE DATABASE IF NOT EXISTS news_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE news_system;
CREATE TABLE IF NOT EXISTS news (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50),
  author VARCHAR(50),
  views INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO news (title, content, category, author, views)
VALUES
('颱風即將接近台灣：各地天氣不穩', '氣象局發布最新訊息，提醒民眾注意安全。', 'weather', '中央社', 120),
('台股大漲 300 點，科技股強勢反彈', '市場信心回升，外資大舉買進。', 'finance', '經濟日報', 450),
('新款手機上市，引爆科技圈討論', '最新旗艦手機特色分析與比較。', 'tech', '科技新報', 200);
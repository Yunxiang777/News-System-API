# News System API

高併發設計的新聞 API 服務，採用 Node.js + Express + MySQL + Redis，並搭配 Nginx、Docker、PM2 做到可擴展、高可用、支援快取版本化與分散式鎖的架構。

## 🚀 Features

### 1. 高併發架構
- Redis 作為快取層，降低 MySQL 負載
- Cache versioning（避免 cache invalidation race condition）
- 分散式鎖（Redis-based distributed lock）
- Node.js cluster（PM2）、多 container（Docker）
- Nginx load balancing round-robin

### 2. 完整快取策略
- `/news` 使用版本化快取（key versioning）
- Redis `INCR` 方式管理資料版本
- Fast-fail lock（PX 避免死鎖）
- Cache stampede 保護機制（避免大量 Cache Miss 打爆 DB）

### 3. 可水平擴展
- 全部服務 Docker 化
- Nginx upstream 指向多個 Node container
- Redis、MySQL 皆使用 Docker Compose 管理

### 4. 壓力測試
使用 wrk 測試達到 **1150 req/sec**（100 connections / 4 threads）

## 🧰 Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js, Express |
| Database | MySQL (Connection Pool) |
| Cache | Redis (versioned cache, distributed lock) |
| Web Server | Nginx |
| Process Manager | PM2 |
| Containerization | Docker, Docker Compose |
| OS Env | WSL (Windows) |
| Load Test | wrk |

## 📁 Project Structure

```
news-system-api/
├── routes/
│   └── news.js         # 主新聞 API（含快取、鎖、版本）
├── db.js               # MySQL 連線池
├── redis.js            # Redis 連線
├── server.js           # Express 啟動點
├── Dockerfile          # Node.js Docker 建置
├── nginx.conf          # Nginx load balancer
└── docker-compose.yml  # 全專案一鍵啟動
```

## 🔥 API Endpoints

### GET `/news`
取得最新新聞
- Redis 版本化快取
- 分散式鎖保護
- 防止 cache stampede

### GET `/news/:id`
取得單一新聞
- 單筆 cache
- 更新/刪除會同步移除

### POST `/news`
新增新聞
- 自動 `INCR` cache version
- 使全站快取立即過期

### PUT `/news/:id`
更新新聞
- 升級 cache version
- 刪除單筆快取

### DELETE `/news/:id`
刪除新聞
- 升級 cache version
- 刪除單筆快取

## ⚙️ Core Logic — Versioned Cache + Distributed Lock

### 版本化快取 (Cache Versioning)

使用 Redis key：
```
news:version
news:all:v{version}
```

**優點：**
- ✅ 不需要刪除 key
- ✅ 無 race condition
- ✅ 清晰版本遞增
- ✅ 不會 dirty read

### 分散式鎖（Redis Distributed Lock）

避免多個 Node container 在 cache 過期時同時打 MySQL：

```javascript
await redis.set("lock:news:all", token, { NX: true, PX: 10000 });
```

釋放鎖使用 Lua script：

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
```

## 🐳 Docker Deployment

### 1. Build Image
```bash
docker build -t news-api .
```

### 2. Start Services
```bash
docker compose up -d
```

### 3. Services Architecture

| Service | Port | Role |
|---------|------|------|
| Node API | 3000 | Backend |
| Redis | 6379 | Cache |
| MySQL | 3306 | Database |
| Nginx | 8080 / 9000 | Load Balancer |

## 🌐 Nginx Load Balancer Example

```nginx
events {}

http {
    upstream nodejs_cluster {
        server node-news-api-1:3000;
        server node-news-api-2:3000;
        server node-news-api-3:3000;
    }

    server {
        listen 9000;

        location / {
            proxy_pass http://nodejs_cluster;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

## 📈 Performance Testing (wrk)

**測試指令：**
```bash
docker run --rm williamyeh/wrk -t4 -c100 -d10s http://host.docker.internal:9000/news
```

**測試結果：**

| Metric | Value |
|--------|-------|
| Requests/sec | 1153.40 |
| Latency Avg | ~90ms |
| Errors | 0 |

## 📦 Installation (Local)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Server
```bash
npm start
```

## 🧪 Testing

```bash
curl http://localhost:3000/news
```

## 🛠️ Configuration

請確保以下環境變數已設定：

```env
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=news_db
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3000
```

## 📝 Notes

- 本專案使用 PM2 管理 Node.js 進程
- Redis 和 MySQL 連線池已優化
- 建議在生產環境使用 Docker Compose 部署
- Nginx 配置可根據實際需求調整 upstream 數量

## 🧑‍💻 Author

**Yunxiang Wang**

## 📄 License

MIT

---

⭐ 如果這個專案對你有幫助，歡迎給個 Star！
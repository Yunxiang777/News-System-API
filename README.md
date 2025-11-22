# News System API

高併發設計的新聞 API 服務，採用 Node.js + Express + MySQL + Redis，並搭配 Nginx、Docker、PM2 做到可擴展、高可用、支援快取版本化與分散式鎖的架構。

## 🚀 Features

### 1. 高併發架構
- **Redis 作為快取層**，降低 MySQL 負載
- **Cache versioning**（版本化快取，避免快取競爭條件/Cache Invalidating Race Condition）
- **分散式鎖**（Redis-based Distributed Lock），確保數據一致性
- **Node.js 叢集**（PM2）、多容器（Docker）實現應用程式層水平擴展
- **Nginx 負載平衡** round-robin 策略分散流量

### 2. 完整快取策略
- `/news` 使用版本化快取（key versioning）
- Redis `INCR` 方式管理資料版本
- **Fast-fail lock**（PX 避免死鎖）
- **Cache stampede** 保護機制（避免大量 Cache Miss 打爆 DB）

### 3. 可水平擴展
- 全部服務 Docker 化，實現環境隔離
- Nginx upstream 指向多個 Node container（服務名稱解析）
- Redis、MySQL 皆使用 Docker Compose 管理（單一檔案啟動整個架構）

### 4. 壓力測試
使用 wrk 測試達到 **1150 req/sec**（100 connections / 4 threads）

## 🧰 Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js, Express |
| Database | MySQL (Connection Pool, Auto Data Init) |
| Cache | Redis (versioned cache, distributed lock) |
| Web Server | Nginx |
| Process Manager | PM2 |
| Containerization | Docker, Docker Compose (v2) |
| Load Test | wrk |

## 📁 Project Structure

```
news-system-api/
├── config/
│   ├── db.js                 # MySQL 連線池配置
│   └── redis.js              # Redis 連線配置
├── controllers/
│   └── newsController.js     # 新聞控制器邏輯
├── db_init/
│   └── init.sql              # 🐳 MySQL 初始化資料腳本
├── models/
│   └── newsModel.js          # 新聞資料模型
├── nginx/
│   └── nginx.conf            # Nginx load balancer 配置
├── routes/
│   └── newsRoutes.js         # 新聞路由定義
├── services/
│   └── newsService.js        # 新聞業務邏輯層
├── utils/
│   └── redisLock.js          # Redis 分散式鎖工具
├── .gitignore                # Git 忽略檔案
├── docker-compose.yml        # Docker Compose 配置
├── Dockerfile                # Node.js Docker 映像檔
└── package-lock.json         # NPM 依賴鎖定檔
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

## 🐳 Docker Deployment (推薦啟動方式)

本專案使用 Docker Compose 進行一鍵部署，以確保環境高度一致性和可攜性。

### 1. 首次啟動 (建構映像檔 & 啟動所有服務)

此指令會在背景啟動所有服務，並強制建構 Node.js 映像檔，同時初始化 MySQL 資料庫。

```bash
# 啟動所有服務，並在背景運行
docker compose up -d --build
```

### 2. 日常啟動/重啟 (使用現有映像檔)

如果您沒有修改 Node.js 程式碼，下次可以直接使用此指令快速啟動。

```bash
docker compose up -d
```

### 3. 停止服務 (保留容器與數據)

若需暫時停止容器運行，但保留所有容器實例和配置。

```bash
docker compose stop
```

### 4. 徹底關閉 (移除容器與網路)

關閉並移除容器和網路，但保留命名資料卷 (mysql_data, redis_data)。

```bash
docker compose down
```

### 5. 服務架構概覽

| Service Name | Internal Port | External Port | Role |
|--------------|---------------|---------------|------|
| node-news-api-1/2/3 | 3000 | (N/A) | Backend API |
| redis-news | 6379 | 6380 | Cache |
| mysql-news-api | 3306 | (N/A) | Database (Auto-init) |
| nginx-lb | 8080 | 9000 | Load Balancer |

## 🌐 Nginx Load Balancer 配置

Nginx 使用容器名稱進行服務解析，實現負載均衡。

```nginx
events {}

http {
    upstream nodejs_cluster {
        server node-news-api-1:3000;
        server node-news-api-2:3000;
        server node-news-api-3:3000;
    }

    server {
        listen 8080;

        location / {
            proxy_pass http://nodejs_cluster;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
```

## 📈 Performance Testing (wrk)

### 測試指令

由於服務運行在 Docker 內部，請使用 `host.docker.internal` 或您的主機 IP 進行測試。

```bash
# 確保 wrk 容器可以訪問主機的 9000 Port
docker run --rm williamyeh/wrk -t4 -c100 -d10s http://host.docker.internal:9000/news
```

### 測試結果

| Metric | Value |
|--------|-------|
| Requests/sec | 1153.40 |
| Latency Avg | ~90ms |
| Errors | 0 |

## 📦 Local Development

如果您想在本地環境（非 Docker）運行 Node.js 服務，請確保：

### 1. 配置環境變數

將以下變數放入專案根目錄的 `.env` 檔案中：

```env
# 🚨 注意：如果是在 Docker 外部運行，DB/Redis HOST 必須是 localhost 或 IP
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=news_system
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3000
```

### 2. 啟動 Node.js 服務

```bash
npm install
npm start
```

## 🧪 Testing

### 測試 Nginx 負載平衡

```bash
curl http://localhost:9000/news
```

### 測試後端服務 (Local Only)

```bash
curl http://localhost:3000/news
```

## 📝 Notes

- **環境變數**： Docker 容器內部的 Node.js 服務直接使用 `docker-compose.yml` 中定義的環境變數，並使用服務名稱 (`mysql-news-api` 和 `redis-news`) 作為 HOST。
- 本專案使用 **PM2** 管理 Node.js 進程。
- MySQL 初始化資料腳本位於 `./db_init/init.sql`。

## 🧑‍💻 Author

Yunxiang Wang

## 📄 License

MIT

---

⭐ **如果這個專案對你有幫助，歡迎給個 Star！**

# 生产部署指南（Vercel + Fly.io）

架构：**Vercel 托管前端**，通过 `/api` 反向代理到 **Fly.io 后端**（方案 A，同源 Cookie，无需改前端播放 URL）。

```text
浏览器 → https://xxx.vercel.app
           ├── /          → Vercel 静态资源（React）
           └── /api/*     → 代理 → https://podcast-flow-api.fly.dev/api/*
```

---

## 前置条件

- GitHub 仓库已连接（`lij71116-cell/-BGM-`）
- [Fly.io 账号](https://fly.io) + 已安装 [flyctl](https://fly.io/docs/hands-on/install-flyctl/)
- [Vercel 账号](https://vercel.com) + 已导入同一 GitHub 仓库

---

## 第一步：部署后端（Fly.io）

在项目根目录 `podcast-flow/` 执行：

### 1. 登录 Fly

```bash
fly auth login
```

### 2. 创建应用（若 `podcast-flow-api` 已被占用，换一个唯一名称）

```bash
fly apps create podcast-flow-api
```

若名称被占用，修改 `fly.toml` 第一行 `app = "你的唯一名称"`，并同步修改 `frontend/vercel.json` 中的 Fly 域名。

### 3. 创建持久化 Volume（SQLite + 音频文件）

```bash
fly volumes create podcast_data --region sin --size 1
```

`sin`（新加坡）与 `fly.toml` 中 `primary_region` 一致；可按需改为 `hkg`、`nrt` 等。

### 4. 设置密钥

```bash
# 随机 Session 密钥（示例，请自行生成）
fly secrets set SESSION_SECRET="$(openssl rand -hex 32)"
```

部署完成后，在 Vercel 控制台拿到域名（如 `https://podcast-flow-xxx.vercel.app`），再设置 CORS：

```bash
fly secrets set CORS_ORIGINS="https://你的项目.vercel.app"
```

若 Vercel 有预览域名，可逗号分隔多个 origin。

### 5. 部署

```bash
fly deploy
```

### 6. 验证

```bash
curl https://podcast-flow-api.fly.dev/health
```

应返回健康检查 JSON。

---

## 第二步：部署前端（Vercel）

### 1. 导入 GitHub 仓库

Vercel Dashboard → **Add New Project** → 选择 `-BGM-` 仓库。

### 2. 项目设置

| 项 | 值 |
|----|-----|
| **Root Directory** | `frontend` |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

### 3. 环境变量

在 Vercel → Settings → Environment Variables 添加：

| 变量 | 值 |
|------|-----|
| `VITE_USE_MOCK` | `false` |
| `VITE_API_BASE_URL` | `/api` |

### 4. 确认 API 代理地址

编辑 `frontend/vercel.json`，将 `destination` 中的域名改为你 Fly 应用的实际地址：

```json
"destination": "https://你的-fly-应用名.fly.dev/api/:path*"
```

提交并 push 后 Vercel 会自动重新部署。

### 5. 验证全链路

1. 打开 `https://xxx.vercel.app`
2. 解析小宇宙单集 → 上传 BGM → 生成组合音频
3. 音频库播放正常
4. 开发者工具 Network：`/api/*` 请求走 Vercel 域名，Cookie `podcast_flow_session` 已设置

---

## 环境变量参考

### Fly.io（`fly secrets set` 或 `fly.toml` [env]）

| 变量 | 说明 | 默认（fly.toml） |
|------|------|------------------|
| `HOST` | 监听地址 | `0.0.0.0` |
| `PORT` | Fly 自动注入 | `8080` |
| `DEBUG` | 生产关闭 | `false` |
| `DATABASE_PATH` | SQLite 路径（Volume） | `/data/podcast_flow.db` |
| `STORAGE_ROOT` | 音频存储（Volume） | `/data/storage` |
| `SESSION_SECRET` | Session 签名（必填 secret） | — |
| `CORS_ORIGINS` | 逗号分隔前端域名 | 部署后设置 Vercel URL |
| `FFMPEG_PATH` | FFmpeg 可执行文件 | `ffmpeg` |
| `FFPROBE_PATH` | ffprobe | `ffprobe` |

### Vercel

| 变量 | 说明 |
|------|------|
| `VITE_USE_MOCK` | 必须 `false` |
| `VITE_API_BASE_URL` | 必须 `/api`（走 vercel.json 代理） |

---

## 常见问题

| 现象 | 处理 |
|------|------|
| API 502 / 连接失败 | 确认 Fly 机器已启动：`fly status`；冷启动需数秒 |
| Cookie 未写入 | 确认 `DEBUG=false`（Secure Cookie）；Vercel 必须为 HTTPS |
| CORS 错误 | 直连 Fly 域名时会触发；正常应只访问 Vercel 的 `/api` |
| 合成失败 | Fly 机器需 512MB+ 内存；确认 Volume 已挂载：`fly volumes list` |
| 数据丢失 | 未创建 Volume 或路径未指向 `/data` |

---

## 本地与生产差异

| 项 | 本地 | 生产 |
|----|------|------|
| 前端 API | Vite proxy → localhost:8100 | Vercel rewrite → Fly |
| 数据库 | `backend/data/*.db` | Fly Volume `/data/` |
| FFmpeg | 系统安装 | Docker 镜像内置 |
| 配置来源 | `backend/.env` | Fly secrets + 环境变量 |

本地开发不受影响，仍按 `docs/startup.md` 启动。

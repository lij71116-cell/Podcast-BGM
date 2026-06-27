# Podcast Flow

Web 端播客 BGM 增强工具：输入小宇宙公开单集链接，叠加 BGM 并配置混音参数，由后端 FFmpeg 合成完整组合音频，保存在个人音频库中在线播放。

**MVP V1.0 · 2026-06-25**

> 产品边界：仅提供 Stream 内联播放，**全站不提供下载**；无用户登录，资产按浏览器 Cookie Session 隔离。

---

## 功能概览

| 模块 | 能力 |
|------|------|
| 播客解析 | 小宇宙公开单集链接 → 封面、标题、时长、摘要 |
| BGM | 本地上传 / 公开音频链接 / 汽水音乐分享链接 |
| 混音配置 | 播客与 BGM 独立音量、倍速；BGM 循环；双轨试听 |
| 合成 | 后端 FFmpeg 异步混音，任务进度轮询 |
| 音频库 | 列表、标题搜索、创建时间筛选、分页 |
| 播放 | 全局底部播放器，跨页面连续播放 |
| 详情 | 播客 / BGM / 混音参数完整展示 |
| 删除 | 删除数据库记录与本地合成文件 |

---

## 技术栈

| 层级 | 选型 |
|------|------|
| 前端 | React 19 · TypeScript · Vite · Ant Design · Zustand · React Router |
| 后端 | Python 3.11+ · FastAPI · PyCore · SQLAlchemy · SQLite |
| 音频 | FFmpeg / ffprobe |
| 存储 | 本地文件系统（`backend/storage/`） |

---

## 项目结构

```text
podcast-flow/
├── frontend/          # React 前端（Vite）
├── backend/           # FastAPI 后端
│   ├── src/           # 业务代码（routes / services / repositories）
│   ├── data/          # SQLite 数据库
│   └── storage/       # BGM 与合成音频文件
├── docs/              # PRD、API 契约、开发计划、原型、启动指南
├── pycore/            # 共享 Python 核心库
├── .sdd/              # SDD 任务与项目元数据
└── .venv/             # Python 虚拟环境（项目根目录）
```

---

## 快速开始

### 环境要求

- Python 3.11+（当前开发环境 3.14.5）
- Node.js 18+
- FFmpeg + ffprobe（`ffmpeg -version` 可执行）
- 可访问小宇宙公开单集页（解析播客时）

### 1. 安装依赖

```bash
cd Projects_Repo/podcast-flow

# Python
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt

# 前端
cd frontend && npm install && cd ..
```

### 2. 配置

复制 `backend/.env.example` 为 `backend/.env`，按需修改端口与 CORS。

前端 `frontend/.env`（真实 API 模式）：

```env
VITE_USE_MOCK=false
VITE_API_BASE_URL=/api
VITE_BACKEND_PROXY_TARGET=http://localhost:8100
```

### 3. 启动

```bash
# 终端 1 — 后端
cd backend
PYTHONPATH=..:. ../.venv/bin/python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8100

# 终端 2 — 前端
cd frontend
npm run dev -- --host 127.0.0.1 --port 5201
```

浏览器访问：**http://127.0.0.1:5201**

更完整的启动说明、验收清单与常见问题见 [`docs/startup.md`](docs/startup.md)。

---

## 页面路由

| 路由 | 页面 |
|------|------|
| `/` | 创建组合音频（解析 → BGM → 混音 → 生成） |
| `/library` | 我的组合音频库 |
| `/detail/:id` | 组合音频详情 |

---

## 开发与测试

```bash
# 后端
cd backend
../.venv/bin/ruff check src tests
../.venv/bin/mypy src
PYTHONPATH=..:. ../.venv/bin/python -m pytest tests

# 前端
cd frontend
npm run type-check
npm run lint
npm run build
```

---

## 生产部署（Vercel + Fly.io）

推荐架构：前端 **Vercel**，后端 **Fly.io**（Docker + FFmpeg + 持久 Volume），Vercel 将 `/api/*` 代理到 Fly 后端，浏览器同源访问 Cookie Session 无需额外 CORS 改造。

完整步骤见 **[`docs/deploy.md`](docs/deploy.md)**，概要：

1. **Fly.io**：`fly volumes create` → `fly secrets set SESSION_SECRET=...` → `fly deploy`
2. **Vercel**：Root Directory = `frontend`，环境变量 `VITE_USE_MOCK=false`、`VITE_API_BASE_URL=/api`
3. 将 `frontend/vercel.json` 中的 Fly 域名改为你实际的应用地址

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [`docs/startup.md`](docs/startup.md) | 启动命令、E2E 验收清单、FAQ |
| [`docs/deploy.md`](docs/deploy.md) | Vercel + Fly.io 生产部署 |
| [`docs/PRD.md`](docs/PRD.md) | 产品需求定稿 |
| [`docs/api-contracts.md`](docs/api-contracts.md) | API 契约（唯一权威源） |
| [`docs/Plan.md`](docs/Plan.md) | 开发计划与功能进度 |
| [`docs/prototypes/`](docs/prototypes/) | 静态 HTML 原型 |

---

## 主要 API（摘要）

完整定义见 `docs/api-contracts.md`。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/podcasts/parse` | 解析小宇宙单集 |
| POST | `/api/bgm/upload` | 上传 BGM |
| POST | `/api/bgm/validate-url` | 校验 BGM / 汽水音乐链接 |
| POST | `/api/mixed-audios` | 创建合成任务 |
| GET | `/api/mixed-audios/{id}/task` | 查询合成进度 |
| GET | `/api/mixed-audios` | 音频库列表 |
| GET | `/api/mixed-audios/{id}` | 资产详情 |
| GET | `/api/mixed-audios/{id}/stream` | Stream 播放（支持 Range） |
| DELETE | `/api/mixed-audios/{id}` | 删除资产 |

---

## 设计约束（MVP）

- **无下载**：响应头 `Content-Disposition: inline`，UI 无下载入口
- **无登录**：Cookie Session（`podcast_flow_session`）级资产隔离
- **无云存储**：合成文件存于本地 `backend/storage/mixed/`
- **V1.1 延后**：淡入淡出、重新生成、高级搜索等

---

## 许可证

暂未指定。如需开源发布，请补充 LICENSE 文件。

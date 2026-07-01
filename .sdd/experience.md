# 项目经验

> 当前项目长期有效的经验。  
> Developer / Tester / Bugfix 在任务完成后维护本文件。

---

## Harness 系统经验摘要

新项目开始时，Developer / Tester / Bugfix 需要同时参考：

- 当前项目经验：`.sdd/experience.md`
- 系统级经验：`<Harness 根目录>/memory/harness-experience.md`

---

（项目经验将在开发过程中追加）

## 2026-07-01｜详情页播放器与底部栏同步

- **播放失败根因**：InlinePlayer 与 GlobalPlayerBar 各自维护 `<audio>`，双实例争用 Media Session / stream，详情页点击播放易报错
- **修复**：InlinePlayer 改为 playerStore 控制 UI，仅 GlobalPlayerBar 持有唯一 audio 元素；进度/音量/续播与底部栏共享 `global` 播放记忆
- **兼容**：`loadProgress` 在 `global` 无记录时回退读取历史 `inline` 进度

## 2026-06-29｜T-030 E2E 回归

- 删除未注册的 `backend/src/api/routes/session.py`（V2 已切 JWT，mypy 仍扫描该文件会报错）
- `VITE_USE_MOCK=false` 时 Mock 仅作开发开关保留，不构成 V2 业务路径
- PWA / 后台播放 / Media Session 须 `npm run build` + preview（5176），dev 模式不注册 SW
- InlinePlayer 换 asset 时用 `key={asset.id}` remount，避免 effect 内 setState 触发 react-hooks/set-state-in-effect

## 2026-06-29｜V2 AppShell 统一顶栏

- 顶栏由 `AppShell` + `Outlet` 统一挂载，各页面不再单独引入 `AppHeader`
- Mock 登录态用 `stores/authStore.ts`，T-024 再切真实 API
- Design Tokens 集中在 `frontend/src/styles/tokens.css`，与 `ui-design-spec.md` 对齐
- 创建页 V2 使用 `CreateEventAxis` 三步事件轴（内容上传 / 混音配置 / 确认与生成），内容按 `activeStep` 分 Tab 展示，已完成步骤可点击回看

## 2026-06-29｜V2 音频库 Mock（T-018）

- 列表对齐 `docs/prototypes/v2/library.html`：桌面双列大卡片（16:9 封面 + BGM/日期徽章），移动单列
- 工具栏：搜索 + 日期范围 +「批量管理」；底部分页器（Mock 响应含 `page/page_size/total`）
- 批量模式：卡片 checkbox + 底部浮动条确认删除；删除播放中项需 `playerStore.closeIfCurrent`
- 分页/筛选逻辑复用 `frontend/src/utils/libraryList.ts`；Mock handler 与 `mixedAudioService` 均支持 query；V1 后端无分页字段时 client fallback
- 每页第 3 张卡片使用 `lib-card--featured` 横跨双列（对齐原型第三张特色卡）

## 2026-06-29｜原型对齐审计（T-015~T-018 修正）

- Design Tokens 统一为 Stitch 色值（`#002720` / `#163d35` / `#faf9f5` 等），顶栏高度 60px
- AppHeader 对齐原型：毛玻璃顶栏、Logo 圆点、nav-tab 下划线激活态、注册 pill 按钮；Mock 登录仅在 `VITE_USE_MOCK=true` 显示
- Auth 左栏文案与 `auth.html` 一致
- Create Step1 BGM 提示文案、Step2 淡入淡出默认开启且 slider max=10、倍速 min=0.5；事件轴 CSS 复用 `prototype-chrome.css`
- Library 日期筛选改为「全部日期」按钮 + 下拉 RangePicker；批量底栏改为白底浮动条（对齐 stitch.css）

## 2026-06-29｜V2 详情页 Mock（T-019）

- DetailPage 对齐 `detail.html`：模糊 Hero、单集介绍折叠、背景音轨、混音只读条、`<details>` 重新生成面板
- Mock `POST /mixed-audios/{id}/regenerate` + 任务轮询；无下载按钮；播放走底部 GlobalPlayerBar（与原型一致）

## 2026-06-29｜V2 播放器 + H5 响应式（T-020 · Mock 收官）

- `GlobalPlayerBar` 对齐 `prototype-chrome.css` / `detail.html`：毛玻璃底栏、圆形 `play-btn`、封面 accent 渐变进度条
- 移动 `<1024px`：双行布局（信息 + 全宽进度），播放钮 48px，隐藏音量/关闭区
- Mock 续播：`VITE_USE_MOCK=true` 时从 localStorage 恢复进度，默认 12% 并显示「续播进度」标签
- `PwaInstallBar`：移动视口底部引导条，文案与 ui-design-spec §3.3 一致，sessionStorage 关闭
- 全站 `overflow-x: clip` + 移动内边距收敛，避免 390px 横向滚动

## 2026-06-30｜V2 Mock 验收阻塞 + T-021 Auth

- V2 前端 Mock 验收须 `frontend/.env` 设 `VITE_USE_MOCK=true` 并重启 dev；`false` 时 Tab1 依赖真实 parse/bgm API，后端未完成则无法进入 Tab2/3
- `prototype-chrome.css` 勿在组件 CSS 里 `@import` 链式引入；改在 `main.tsx` 直接 import，避免 postcss-import 路径解析 ENOENT
- T-021：`users` 表 + bcrypt + PyJWT；Cookie 名 `podcast_flow_token`；错误码 40010/40011/40012/40101/40102

## 2026-06-30｜T-022 用户隔离 + Auth 中间件

- `AuthMiddleware` 保护 `/api/*`（公开：register/login/logout/forgot/reset）；移除 `SessionMiddleware` 与 `/api/session`
- 业务表增加 `user_id`（V1 匿名数据 user_id=NULL 不合并）；迁移脚本 `backend/scripts/migrate_v2_user_id.py`
- 仓储/服务全面改为 `user_id` 隔离；跨用户访问详情/删除返回 40301
- 测试统一 `register_test_user()` + `tests/helpers.py` 种子数据

## 2026-06-30｜T-023 修改密码 API

- `POST /api/auth/change-password`：需登录；字段 current/new/new_password_confirm
- 当前密码错误 → 401 / 40102「当前密码错误」；确认不一致 → 40012
- 成功后更新 password_hash 并重新签发 JWT Cookie

## 2026-06-30｜T-024 前端 Auth 真实对接

- `authService` 对接 register/login/logout/me/change-password；`withCredentials` 携带 JWT Cookie
- `ProtectedRoute`：`VITE_USE_MOCK=false` 时未登录跳转 `/auth`；Mock 模式跳过守卫便于 UI 验收
- 启动时 `bootstrap()` 调 `/api/auth/me` 恢复登录态；401 拦截清 user
- 顶栏下拉：真实登出 + 修改密码 Modal

## 2026-06-30｜T-025 创建页真实 API + 淡入淡出

- `MixConfigDTO` 增加 `fade_in`/`fade_out`（0–30 秒）；CreatePage `buildMixConfig()` 随开关传 0 或秒数
- `mix_ffmpeg._bgm_filter_chain` 对 BGM 轨追加 `afade=t=in|out`；Worker/Preview 透传 fade 参数
- CreatePage 已接真实 `parsePodcast`/`uploadBgm`/`createMixedAudio`；任务轮询 2s
- 详情页只读展示 fade 参数；pytest 含 afade 断言

## 2026-06-30｜T-026 列表分页/筛选 + 批量删除

- `GET /api/mixed-audios` 支持 `page`/`page_size`/`q`/`created_date`/`created_from`/`created_to`；响应含分页字段
- `DELETE /api/mixed-audios/batch` 仅删当前用户资产并清理 mixed 文件
- 前端 `LibraryPage` + `mixedAudioService.listMixedAudios`/`deleteMixedAudiosBatch` 已对接；V1 无分页字段时 client fallback 仍保留

## 2026-06-30｜小宇宙解析 500 + 封面缓存

- **500 根因**：V1 SQLite 表 `session_id NOT NULL`，JWT 用户写入 `session_id=NULL` 触发 IntegrityError
- **修复**：`migrate_v2_user_id.py` 重建三表使 `session_id` 可空；本地库已执行迁移
- **封面**：解析成功后下载 og:image 到 `storage/covers/`，`cover_url` 改为 `/api/podcasts/{id}/cover`；CreatePage 从封面取 accent 色

### [T-022]: JWT Auth 中间件测试迁移
- **陷阱**：Session 测试直接 `client.get("/api/session")` 已失效；`register_test_user` 依赖 `/api/auth/register`，若 `auth.py` 漏 import `get_settings` 会导致全部受保护 API 测试 NameError
- **经验**：跨用户隔离断言从 404 改为 403 + code 40301；`tests.helpers.seed_*` 的 `title` 为 keyword-only 必填
- **避坑**：每个调用受保护 API 的测试方法开头先 `register_test_user(client)`；删除 `test_session.py`，由 `test_auth_middleware.py` 覆盖

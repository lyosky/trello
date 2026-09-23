# 看板 · Kanban

一个类似 Trello 的本地优先（local-first）看板应用：数据完整保存在浏览器 OPFS 中的 SQLite 数据库里，完全离线可用，无需任何后端服务。

![Tech](https://img.shields.io/badge/React_19-TypeScript-blue) ![Storage](https://img.shields.io/badge/sql.js-OPFS_SQLite-green)

## 功能特性

- **多看板**：创建 / 切换 / 重命名 / 删除看板，删除时级联清理其列表与卡片
- **列表（列）**：创建 / 重命名 / 删除，支持水平拖拽排序
- **卡片**：创建 / 删除，支持列内上下重排与跨列拖拽（空列也可接收卡片）
- **卡片详情**：弹窗内编辑标题与描述，查看所属列表与创建时间
- **拖拽体验**：`DragOverlay` 跟随光标（轻微倾斜 + 阴影），拖拽过程中实时重排，原位保留占位
- **持久化**：每次写操作即时落盘，刷新 / 关闭浏览器后数据不丢失
- **首次启动**：自动播种一个中文「欢迎看板」，含示例列表与卡片

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端框架 | React 19 + TypeScript（strict 模式） |
| 构建工具 | Vite 7 |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite` 插件，CSS 优先配置） |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| 数据库 | sql.js（SQLite 编译为 WebAssembly） |
| 存储 | OPFS（Origin Private File System）同步句柄 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查 + 生产构建
npm run build

# 预览生产构建（局域网可访问）
npm run preview
```

## 运行构建产物（无需 dev 命令）

> 为什么不能直接双击 `dist/index.html`？ES Module 脚本、模块 Worker、WASM 加载与 OPFS 存储都要求 HTTP 源（`file://` 下会被浏览器拦截），因此构建产物必须通过 HTTP 访问。

**方式一（Windows 双击即用）**：双击项目根目录的 **`启动看板.bat`** —— 首次会自动构建，之后每次直接启动静态服务器并打开浏览器。

**方式二（命令行）**：

```bash
npm run build   # 首次构建
npm start       # node server.js：零依赖静态服务器，监听 0.0.0.0:4173
```

启动后控制台会打印本机与局域网地址，例如：

```
本机访问     http://localhost:4173
局域网访问   http://192.168.x.x:4173
```

同一局域网内的手机 / 其他电脑可通过局域网地址访问（OPFS 数据按浏览器与源隔离，各设备各自独立）。换端口：`PORT=4174 npm start`。

**方式三（任意静态服务器）**：`dist/` 是纯静态产物，nginx、Caddy、`npx serve` 等均可直接托管，无需任何服务端逻辑。

## 架构说明

```
src/
├── db/
│   ├── worker.ts     # 数据库 Web Worker：加载 sql.js，读写 OPFS 中的 trello.sqlite
│   ├── protocol.ts   # 主线程 <-> Worker 的消息协议（query / exec / batch）
│   ├── client.ts     # Worker 通信封装（Promise 化，按 id 匹配请求与响应）
│   └── repo.ts       # 类型化数据访问：实体 CRUD、拖拽落库的批量 op 构建
├── hooks/
│   └── useKanban.ts  # 全部应用状态与操作（乐观更新 + 失败回滚恢复）
├── components/       # TopBar / BoardView / ListColumn / KanbanCard / CardModal 等
└── lib/dndState.ts   # 拖拽结束瞬间的 click 抑制标记
```

### 数据层：sql.js + OPFS

数据库运行在专用的 Web Worker 中（`src/db/worker.ts`）：

1. **初始化**：`navigator.storage.getDirectory()` 获取 OPFS 根目录，打开（必要时创建）`trello.sqlite`，并通过 `createSyncAccessHandle()` 取得同步句柄；文件非空则读入 sql.js 恢复数据库，否则建表并播种示例数据。
2. **读**：`query` 消息用预编译语句执行并返回行数组。
3. **写**：`exec` / `batch` 消息执行 SQL（batch 在事务中运行），完成后立即整库落盘——`truncate(0)` → `write(db.export(), { at: 0 })` → `flush()`。同步句柄只允许在 Worker 中使用，因此不会阻塞主线程；看板数据量小，全量写完全可接受。
4. **失败处理**：OPFS 不可用或句柄被占用时，Worker 上报致命错误，界面显示引导提示而非静默失败。

### 数据模型

```sql
boards (id, title, position, created_at)
lists  (id, board_id, title, position, created_at)
cards  (id, list_id, title, description, position, created_at)
```

排序采用 **REAL position + 固定间隔重编号**：拖拽预览期间用相邻卡片 position 的中点即时换位，`dragEnd` 时对受影响列表按 `(index + 1) * 1024` 统一重编号落库，避免分数无限退化。

### 拖拽实现要点

- 单一 `DndContext`：卡片（垂直 `SortableContext`）与列表（水平 `SortableContext`）共用，靠 `data.current.type` 区分
- 自定义碰撞检测：拖列表时只在列表间碰撞（避免「列落在卡片上」的误排序）；拖卡片时用 `closestCorners`，空列 / 列空白区域也能作为放置目标
- `onDragOver` 实时更新本地状态（跨列移动、列内换位），`onDragEnd` 批量落库，取消 / 落空时从数据库恢复
- `PointerSensor` 6px 激活距离区分「点击打开卡片」与「拖拽」；拖拽结束瞬间抑制 200ms 内误触发的 click

## 浏览器兼容性

需要支持 OPFS 与同步文件句柄的现代浏览器：**Chrome / Edge 102+、Safari 15.2+、Firefox 111+**（建议均使用最新版）。

> ⚠️ `createSyncAccessHandle` 为独占句柄：请避免在多个标签页中同时打开本应用，第二个标签页会收到「数据库初始化失败」的提示。

## 开发备注

- 数据存放在浏览器的 OPFS 中（对页面源不可见，DevTools → Application → Storage 可查看占用）；OPFS 按源（协议 + 主机名 + 端口）隔离，`localhost:5180`（dev）与 `localhost:4173`（构建版）的数据互不相通。如需重置数据，可在控制台执行 `navigator.storage.getDirectory().then(d => d.removeEntry('trello.sqlite'))` 后刷新
- 「当前看板」记忆在 localStorage（`trello.currentBoardId`），看板数据本身全部在 SQLite
- 删除最后一个看板后进入引导页；仅当数据库文件为全新文件时才会重新播种示例数据

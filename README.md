# OpenCode Conversation Manager

基于 OpenCode SDK 的智能对话管理平台，支持多会话并行对话、任务管理、3D 立体界面交互。

## 功能特性

- **任务管理** - 创建、编辑、删除调查任务
- **多会话支持** - 每个任务可创建多个独立对话会话
- **多对话并行** - 3D 立体卡片布局，支持同时开启多个对话
- **AI 对话** - 前端直接集成 OpenCode npm SDK，提供智能对话功能
- **实时响应** - 支持步骤进度和思考过程显示
- **结果展示** - 右侧面板实时展示代码和执行结果
- **可配置部署** - 支持 YAML 配置文件

## 系统要求

- Python 3.10+
- Node.js 18+
- npm 或 pnpm
- SQLite3
- OpenCode 服务（运行于 `localhost:36000` 或自定义端口）

## 技术栈

### 后端
- **FastAPI** - 高性能 Web 框架
- **SQLAlchemy** - ORM
- **SQLite** - 轻量级数据库
- 数据存储服务（会话、任务、消息的持久化）

### 前端
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **TailwindCSS** - 样式
- **Vite** - 构建工具
- **Lucide Icons** - 图标
- **@opencode-ai/sdk** - 前端 OpenCode 通信

## 项目结构

```
project/
├── backend/
│   ├── app/
│   │   ├── routers/          # API 路由
│   │   │   ├── tasks.py     # 任务相关接口
│   │   │   ├── sessions.py  # 会话相关接口
│   │   │   └── messages.py  # 消息相关接口
│   │   ├── services/        # 业务逻辑
│   │   │   └── opencode_service.py  # (简化版，仅存储)
│   │   ├── config.py        # 配置加载
│   │   ├── database.py      # 数据库配置和模型
│   │   ├── models.py        # Pydantic 模型
│   │   └── main.py          # 应用入口
│   ├── config.yaml          # 配置文件
│   ├── database.sql         # 数据库建表SQL
│   ├── requirements.txt
│   └── run.py               # 启动脚本
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # 主应用组件
│   │   ├── hooks/
│   │   │   └── useOpenCode.ts   # OpenCode SDK Hook
│   │   └── ...
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## 架构说明

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户浏览器                               │
├─────────────────────────────────────────────────────────────────┤
│  前端 (React + @opencode-ai/sdk)                               │
│    │                                                           │
│    ├── createOpencodeClient() ──────────────────────────────┐  │
│    ├── session.create() / list() / delete() ───────────────┐ │  │
│    ├── session.prompt() ──────────────────────────────────┐ │  │
│    │                                                        │ │  │
│    └──────────┬────────────────────────────────────────────┘ │  │
│               │                                              │  │
│               ▼                                              │  │
│         OpenCode 服务器                                       │  │
│         (localhost:36000)                                     │  │
└───────────────┬───────────────────────────────────────────────┘  │
                │                                                │
                ▼                                                │
┌─────────────────────────────────────────────────────────────────┐
│  后端 (FastAPI) - 仅用于数据存储                                 │
│    │                                                           │
│    ├── /api/tasks/*    - 任务 CRUD                              │
│    ├── /api/sessions/* - 会话记录                               │
│    └── /api/messages/* - 消息存储                               │
└─────────────────────────────────────────────────────────────────┘
```

**重要变化**：前端直接使用 `@opencode-ai/sdk` 与 OpenCode 服务器通信，后端仅用于数据持久化存储。

## 快速部署

### 1. 准备工作

确保已安装：
- Python 3.10+
- Node.js 18+
- OpenCode CLI（用于启动 OpenCode 服务）

### 2. 初始化数据库

```bash
cd backend

# 使用 SQLite 命令行初始化数据库
sqlite3 opencode_conversation.db < database.sql

# 或在 Python 中自动创建（首次运行时会自动创建表）
python run.py
```

### 3. 配置

编辑 `backend/config.yaml` 修改配置：

```yaml
# 数据库配置
database:
  path: "./opencode_conversation.db"

# 后端服务配置
backend:
  host: "0.0.0.0"
  port: 8000
  reload: false

# CORS 配置
cors:
  allowed_origins: "*"
  allow_credentials: true
  allowed_methods: "*"
  allowed_headers: "*"
```

### 4. 启动 OpenCode 服务

```bash
# 在终端启动 OpenCode 服务
opencode serve --port 36000
```

### 5. 启动后端服务

```bash
cd backend

# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 启动服务
python run.py
```

后端服务运行在 `http://localhost:8000`

### 6. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务运行在 `http://localhost:3000`

访问 `http://localhost:3000` 开始使用。

### 7. 配置 OpenCode 连接（可选）

如需修改 OpenCode 服务器地址或工作目录，编辑 `frontend/src/App.tsx`：

```typescript
const OPENCODE_BASE_URL = 'http://localhost:36000';
const OPENCODE_DIRECTORY = '/your/project/path';
```

## API 接口

### 任务接口

| 方法   | 路径              | 描述           |
|--------|-------------------|----------------|
| POST   | `/api/tasks/`     | 创建任务       |
| GET    | `/api/tasks/`     | 获取任务列表   |
| GET    | `/api/tasks/{id}` | 获取单个任务   |
| PUT    | `/api/tasks/{id}` | 更新任务       |
| DELETE | `/api/tasks/{id}` | 删除任务       |

### 会话接口

| 方法   | 路径                          | 描述             |
|--------|-------------------------------|------------------|
| POST   | `/api/tasks/{task_id}/sessions` | 创建会话       |
| GET    | `/api/tasks/{task_id}/sessions` | 获取任务会话   |
| GET    | `/api/sessions/{id}`          | 获取单个会话     |
| DELETE | `/api/sessions/{id}`          | 删除会话         |

### 消息接口

| 方法   | 路径                          | 描述                 |
|--------|-------------------------------|----------------------|
| POST   | `/api/sessions/{id}/messages` | 保存消息            |
| GET    | `/api/sessions/{id}/messages`  | 获取会话消息列表    |

### 系统接口

| 方法   | 路径        | 描述           |
|--------|-------------|----------------|
| GET    | `/`         | API 信息       |
| GET    | `/health`   | 健康检查       |

## 数据库操作

### 初始化数据库

```bash
cd backend
sqlite3 opencode_conversation.db < database.sql
```

### 删除所有数据

```bash
sqlite3 opencode_conversation.db "DELETE FROM messages; DELETE FROM sessions; DELETE FROM tasks;"
```

### 重建数据库

```bash
sqlite3 opencode_conversation.db < database.sql
```

### 数据库备份

```bash
cp opencode_conversation.db opencode_conversation_backup.db
```

### 恢复数据库

```bash
cp opencode_conversation_backup.db opencode_conversation.db
```

## 界面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  OpenCode 调查系统                              [系统在线]        │
├────────┬─────────────────────────────────────┬──────────────────┤
│        │  ◀  ┌─────────────────────────┐  ▶  │                  │
│ 任务   │     │     任务标题            │     │  [全部][代码][结果]│
│        │     ├─────────────────────────┤     │                  │
│ [新建] │     │  User: 你好             │     │  ┌────────────┐  │
│        │     │  AI: 你好！             │     │  │ Code Block │  │
│ 会话1  │     │                         │     │  └────────────┘  │
│ 会话2  │     ├─────────────────────────┤     │                  │
│        │     │ [输入消息...]  [发送]   │     │  ┌────────────┐  │
│        │     └─────────────────────────┘     │  │ Text Result │  │
│        │     ○ ○ ●                           │  └────────────┘  │
└────────┴─────────────────────────────────────┴──────────────────┘
```

### 3D 对话卡片说明

- **中心卡片** - 当前激活的对话，可输入和发送消息
- **侧边卡片** - 其他对话预览，点击可切换为中心
- **左右箭头** - 切换对话位置
- **底部指示点** - 显示当前对话数量，点击可快速切换

## 开发

### 启动开发模式

```bash
# 终端1: OpenCode 服务
opencode serve --port 36000

# 终端2: 后端
cd backend && python run.py

# 终端3: 前端
cd frontend && npm run dev
```

### 代码检查

```bash
# 后端
cd backend
python -m py_compile app/*.py

# 前端
cd frontend
npx tsc --noEmit
```

## 生产部署

1. 设置 `config.yaml` 中 `backend.reload = false`
2. 使用反向代理（如 nginx）提供前端静态文件
3. 使用 `systemd` 或 `pm2` 管理后端进程
4. 定期备份数据库

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 故障排查

### 后端启动失败

1. 检查 Python 版本：`python --version`（需要 3.10+）
2. 检查依赖安装：`pip list`
3. 检查端口占用：`lsof -i :8000`

### 前端无法连接后端

1. 检查后端是否运行：`curl http://localhost:8000/health`
2. 检查 CORS 配置：`config.yaml` 中的 `cors` 部分
3. 检查 API 代理配置（如果是 nginx 部署）

### OpenCode 连接失败

1. 检查 OpenCode 服务：`curl http://localhost:36000`
2. 确认 OpenCode 服务正在运行
3. 检查 `frontend/src/App.tsx` 中的 `OPENCODE_BASE_URL` 配置

## 许可证

MIT
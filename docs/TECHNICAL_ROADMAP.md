# OpenCode Conversation Manager - 技术路线文档

## 1. 项目概述

**项目名称**: OpenCode Conversation Manager
**项目类型**: 前后端分离的 AI 对话管理系统
**核心功能**: 多会话并行对话、任务管理、3D 立体界面交互、实时 SSE 流式响应

---

## 2. 技术栈总览

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                                  前端技术栈                                    │
├────────────────────────────────────────────────────────────────────────────────┤
│  框架      │  React 18          │  UI 框架                                      │
│  语言      │  TypeScript 5.3     │  类型安全                                     │
│  样式      │  TailwindCSS 3.4   │  原子化 CSS                                  │
│  构建      │  Vite 5.0          │  快速构建工具                                 │
│  图标      │  Lucide React      │  现代图标库                                   │
│  包管理    │  npm/pnpm          │  Node.js 包管理                               │
└────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────┐
│                                  后端技术栈                                    │
├────────────────────────────────────────────────────────────────────────────────┤
│  框架      │  FastAPI           │  高性能异步 Web 框架                           │
│  语言      │  Python 3.10+      │  类型提示 + 异步 I/O                           │
│  ORM       │  SQLAlchemy        │  数据库 ORM                                   │
│  数据库    │  SQLite            │  轻量级关系型数据库                            │
│  HTTP 客户端│  httpx             │  异步 HTTP + SSE 支持                          │
│  验证      │  Pydantic          │  数据模型验证                                  │
└────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────┐
│                                  外部服务                                      │
├────────────────────────────────────────────────────────────────────────────────┤
│  AI 引擎   │  OpenCode Server   │  本地运行的 AI 对话服务                        │
│  协议      │  SSE (Server-Sent  │  服务器推送事件                                │
│           │  Events)           │                                               │
│  端口      │  :36000           │  OpenCode 服务端口                            │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 系统架构

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 用户浏览器 (Browser)                                   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              React 前端应用                                      │  │
│  │                                                                                   │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐               │  │
│  │  │   App.tsx        │  │   useSseProxy    │  │  MessageBubble   │               │  │
│  │  │   (主应用)       │  │   (SSE Hook)     │  │  (消息组件)      │               │  │
│  │  │                  │  │                  │  │                  │               │  │
│  │  │ - 状态管理       │◄─│ - SSE 连接       │◄─│ - 消息渲染       │               │  │
│  │  │ - 3D 卡片布局    │  │ - 事件处理      │  │ - 内容显示      │               │  │
│  │  │ - 多会话路由    │  │ - 消息状态      │  │                  │               │  │
│  │  └──────────────────┘  └────────┬─────────┘  └──────────────────┘               │  │
│  │                                │                                              │  │
│  │                    messagesMap: Record<string, OpenCodeMessage[]>             │  │
│  │                         (每个会话独立的消息存储)                               │  │
│  │                                                                                   │  │
│  └─────────────────────────────────────────────────────────────────────────────────┘  │
│                                          │                                               │
│                              EventSource (SSE)  │  fetch (HTTP)                          │
│                              ───────────────────┼──────────────────────────────────────   │
└───────────────────────────────────────────────│──────────────────────────────────────────┘
                                                │ http://localhost:8000
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              FastAPI 后端服务 (:8000)                                   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │                           SSE Proxy Router (/api/sse/*)                         │  │
│  │                                                                                   │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐               │  │
│  │  │  GET /events    │  │ POST /prompt_async│  │ GET /messages   │               │  │
│  │  │  (SSE 流式)     │  │  (发送消息)      │  │  (获取历史)      │               │  │
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘               │  │
│  │           │                      │                      │                        │  │
│  │  ┌────────▼──────────────────────▼──────────────────────▼────────┐               │  │
│  │  │                    proxy_sse() 透传函数                      │               │  │
│  │  │         (将 SSE 流从 OpenCode 转发到浏览器)                   │               │  │
│  │  └────────────────────────────────┬────────────────────────────────┘               │  │
│  └────────────────────────────────────│──────────────────────────────────────────────┘  │
│                                        │ http://localhost:36000                          │
└────────────────────────────────────────┼──────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           OpenCode Server (:36000)                                      │
│                                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                        │
│  │ /global/event   │  │ /session/{id}/    │  │ /session/{id}/   │                        │
│  │ (SSE 事件流)    │  │ prompt_async      │  │ message         │                        │
│  │                 │  │ (异步处理消息)    │  │ (获取消息历史)  │                        │
│  └────────────────┘  └──────────────────┘  └──────────────────┘                        │
│                                                                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────┐     │
│  │                          OpenCode AI 引擎                                       │     │
│  │                    (处理用户消息，生成 AI 响应)                                  │     │
│  └──────────────────────────────────────────────────────────────────────────────┘     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 前端架构

### 4.1 核心模块

```
frontend/src/
├── App.tsx                    # 主应用组件
│   ├── 状态管理               │  使用 React useState/useRef
│   ├── 3D 卡片布局           │  CSS transform 实现立体效果
│   ├── 多会话渲染            │  activeConversations 数组
│   └── 消息渲染              │  消息列表 + MessageBubble
│
├── hooks/
│   └── useSseProxy.ts         # SSE 通信核心 Hook
│       ├── EventSource 管理  │  浏览器原生 SSE API
│       ├── 事件分发          │  根据 sessionID 路由到正确会话
│       ├── messagesMap       │  Record<string, OpenCodeMessage[]>
│       └── setMessages       │  setMessages(sessionId, updater)
│
└── types/
    └── index.ts              # 共享类型定义
```

### 4.2 前端状态管理

```
useSseProxy Hook 状态
├── initialized: boolean          # SSE 连接已初始化
├── error: string | null           # 错误信息
├── sessions: OpenCodeSession[]   # 会话列表
├── currentSession: string | null # 当前选中会话 ID
├── messagesMap: Record<string, OpenCodeMessage[]> # ⭐ 核心：每个会话独立消息存储
├── sending: boolean               # 是否正在发送
└── step: StepInfo | null         # 当前步骤指示

状态流转:
1. 页面加载 → initialized = true
2. loadSessions() → sessions = [...]
3. selectSession(id) → currentSession = id
4. handleSend(sessionId, content) → sendMessage(content, sessionId) → 消息路由到指定会话
5. SSE 事件到达 → handleSSEEvent → 根据事件 sessionID 路由 → 更新对应 messagesMap[sessionId]
6. React 状态更新触发重新渲染
```

### 4.3 关键技术实现

#### 多会话消息存储 (messagesMap)

```typescript
// 每个会话独立的消息数组
const [messagesMap, setMessagesMap] = useState<Record<string, OpenCodeMessage[]>>({});

// 显式指定 sessionId 更新消息
const setMessages = useCallback((sessionId: string | null, updater: ...) => {
  if (!sessionId) return;
  setMessagesMap(prev => ({
    ...prev,
    [sessionId]: updater(prev[sessionId] || [])
  }));
}, []);
```

#### SSE 事件路由

```typescript
const handleSSEEvent = useCallback((data: any) => {
  const { payload } = data;
  if (!payload) return;

  const { type, properties } = payload;
  const sessionID = properties?.sessionID;

  // ⭐ 关键变化：不再过滤，而是根据 sessionID 路由到正确的会话
  if (!sessionID) return;

  switch (type) {
    case 'message.updated':
      setMessages(sessionID, prev => [...prev, newMsg]);
      break;
    case 'message.part.delta':
      setMessages(sessionID, prev => prev.map(msg => {
        if (msg.id === messageID) {
          return { ...msg, content: msg.content + delta };
        }
        return msg;
      }));
      break;
    // ...
  }
}, []);
```

#### sendMessage 支持显式 sessionId

```typescript
const sendMessage = useCallback(async (content: string, sessionId?: string) => {
  const targetSession = sessionId || currentSession;
  if (!targetSession || sending) return;

  // 消息添加到正确的会话
  setMessages(targetSession, prev => [...prev, userMsg]);

  // 发送到后端
  await fetch(`${baseUrl}/api/sse/session/${targetSession}/prompt_async`, ...);
}, [currentSession, sending, baseUrl]);
```

#### 3D 卡片布局 (App.tsx)

```typescript
// CSS transform 实现 3D 效果
style={{
  transform: `
    ${isCenter ? '' : isLeft ? 'rotateY(20deg)' : 'rotateY(-20deg)'}
    translateX(${isCenter ? '0%' : isLeft ? '-40%' : '40%'})
    translateZ(${isCenter ? '0px' : '-80px'})
    scale(${isCenter ? 1 : 0.9})
  `
}}
```

---

## 5. 后端架构

### 5.1 核心模块

```
backend/app/
├── main.py                    # FastAPI 应用入口
├── config.py                  # 配置管理 (YAML)
├── database.py               # 数据库连接 + 初始化
├── models.py                 # Pydantic 模型
│
├── routers/                  # API 路由
│   ├── tasks.py             # 任务管理 CRUD
│   ├── sessions.py          # 会话管理 CRUD
│   ├── messages.py          # 消息持久化
│   └── sse_proxy.py         # SSE 代理 (核心)
│
└── services/
    └── opencode_service.py  # OpenCode 服务封装
```

### 5.2 API 路由设计

#### SSE 代理 (sse_proxy.py)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/sse/events` | 全局 SSE 事件流 (透传到 OpenCode /global/event) |
| POST | `/api/sse/session/{id}/prompt_async` | 发送消息到 OpenCode |
| GET | `/api/sse/session/{id}/messages` | 获取会话消息历史 |
| GET | `/api/sse/session/list` | 列出所有会话 |
| POST | `/api/sse/session/create` | 创建新会话 |
| DELETE | `/api/sse/session/{id}` | 删除会话 |

#### 任务管理 (tasks.py)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/tasks/` | 创建任务 |
| GET | `/api/tasks/` | 获取任务列表 |
| GET | `/api/tasks/{id}` | 获取单个任务 |
| PUT | `/api/tasks/{id}` | 更新任务 |
| DELETE | `/api/tasks/{id}` | 删除任务 |

### 5.3 SSE 代理核心实现

```python
async def proxy_sse(url: str, headers: dict, timeout: float = 300.0):
    """透明代理 SSE 请求到 OpenCode"""
    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
        async with client.stream("GET", url, headers=headers) as response:
            async for line in response.aiter_lines():
                yield f"{line}\n".encode()  # 透传每一行
```

**关键点**:
- 使用 `httpx.AsyncClient.stream()` 进行流式请求
- 使用 `StreamingResponse` 返回给前端
- 透传所有行，包括空行 (SSE 事件分隔符)

---

## 6. 数据流

### 6.1 用户发送消息流程

```
┌─────────┐     1. 输入消息      ┌─────────┐     2. HTTP POST     ┌─────────┐
│  用户   │ ───────────────────▶ │  前端   │ ──────────────────▶  │  后端   │
└─────────┘                      └─────────┘                      └────┬────┘
   │                                    │                                │
   │                                    │    3. /session/{id}/          │
   │                                    │       prompt_async             │
   │                                    │                                │
   │                                    │    4. HTTP POST               │
   │                                    └──────────────────────────────▶│
   │                                                                              │
   │                      ┌──────────────────────────────────────────────────┘
   │                      ▼
   │               ┌─────────────┐
   │               │  OpenCode   │
   │               │   Server    │
   │               └──────┬──────┘
   │                      │
   │                      │ 5. SSE 事件流开始
   │                      │    - message.updated (AI 消息创建)
   │                      │    - message.part.delta (流式内容)
   │                      │    - session.status (状态变化)
   │                      ▼
   │               ┌─────────────┐
   │               │  SSE Proxy  │
   │               │  (透传)     │
   │               └──────┬──────┘
   │                      │
   │                      │ 6. SSE 事件流 (包含 sessionID)
   │                      ▼
   │               ┌─────────────┐
   │               │  前端       │
   │               │ EventSource │
   │               └──────┬──────┘
   │                      │
   │                      │ 7. handleSSEEvent(data)
   │                      │    根据 sessionID 路由到正确会话
   │                      ▼
   │               ┌─────────────┐
   │               │  更新状态   │
   │               │ messagesMap │
   │               │ [sessionID] │
   │               └──────┬──────┘
   │                      │
   │                      │ 8. React 重新渲染
   │                      ▼
   │               ┌─────────────┐
   │               │ UI 显示消息 │
   │               └─────────────┘
```

### 6.2 多会话并行处理

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         多会话并行对话流程                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  会话 A (卡片1)              会话 B (卡片2)              会话 C (卡片3)      │
│  ┌─────────────┐            ┌─────────────┐            ┌─────────────┐      │
│  │ 用户: 你好  │            │ 用户: 天气   │            │ 用户: 代码  │      │
│  │ AI: 你好！ │            │ AI: 晴朗   │            │ AI: 已查看 │      │
│  └─────────────┘            └─────────────┘            └─────────────┘      │
│        │                          │                          │               │
│        └──────────────────────────┼──────────────────────────┘               │
│                                   │                                          │
│                     SSE 事件根据 sessionID 路由                             │
│                                   │                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐      │
│  │                     messagesMap 结构                                │      │
│  │  {                                                                 │      │
│  │    "ses_A": [msg1, msg2, msg3, ...],  ←─── 独立的消息数组            │      │
│  │    "ses_B": [msg1, msg2, msg3, ...],  ←─── 独立的消息数组            │      │
│  │    "ses_C": [msg1, msg2, msg3, ...]   ←─── 独立的消息数组            │      │
│  │  }                                                                 │      │
│  └──────────────────────────────────────────────────────────────────────┘      │
│                                   │                                          │
│                     每个卡片的 handleSend 携带 sessionId                    │
│                     setMessages(sessionId, ...) 直接路由                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 SSE 事件类型详解

| 事件类型 | 触发时机 | 处理逻辑 | 数据结构 |
|---------|---------|---------|----------|
| `message.updated` | AI 创建新消息时 | 创建消息空壳，content 为空 | `{ info: { id, role, time } }` |
| `message.part.updated` | 消息内容完整时 | 填充空消息的内容 | `{ part: { type: 'text', text, messageID } }` |
| `message.part.delta` | 消息内容增量时 | 追加到现有内容 | `{ field: 'text', delta, messageID }` |
| `session.status` | 状态变化时 | 更新 step 指示器 | `{ status: { type: 'busy'/'idle' } }` |
| `session.idle` | 对话完成时 | 清除 step 指示器 | - |

---

## 7. 技术决策记录

### 7.1 为什么使用 SSE 而不是 WebSocket？

| 对比项 | SSE | WebSocket |
|-------|-----|-----------|
| 复杂度 | 简单，单向 | 复杂，全双工 |
| 兼容性 | 良好 | 需要降级处理 |
| 断线重连 | 自动 | 需要手动实现 |
| HTTP/2 | 良好支持 | 需要额外配置 |
| 场景契合度 | ✓ 单向服务器推送 | ✗ 不需要双向通信 |

**结论**: SSE 更适合本项目的单向服务器推送场景

### 7.2 为什么使用 SQLite 而不是 PostgreSQL？

| 对比项 | SQLite | PostgreSQL |
|-------|--------|-----------|
| 部署复杂度 | 零配置 | 需要独立进程 |
| 并发支持 | 有限 | 强大 |
| 数据量 | 小型项目足够 | 大型企业级 |
| 迁移 | 文件拷贝 | SQL 迁移工具 |

**结论**: 项目规模小，SQLite 足够，且部署简单

### 7.3 为什么使用 httpx 而不是 requests？

| 对比项 | httpx | requests |
|-------|-------|----------|
| 异步支持 | ✓ 原生异步 | ✗ 同步 |
| SSE 支持 | ✓ stream 支持 | ✗ 不支持 |
| 性能 | 更高 | 标准 |

**结论**: SSE 流式响应需要异步支持

### 7.4 为什么使用 EventSource 而不是 fetch + ReadableStream？

| 对比项 | EventSource | fetch + ReadableStream |
|-------|------------|------------------------|
| API 复杂度 | 简单 | 复杂 |
| 自动重连 | ✓ 内置 | ✗ 需要手动实现 |
| 浏览兼容 | 良好 | 需要 polyfill |

**结论**: EventSource 更适合 SSE 场景，API 更简洁

### 7.5 多会话架构设计决策

| 设计 | 选择 | 原因 |
|------|------|------|
| 消息存储 | `messagesMap: Record<string, OpenCodeMessage[]>` | 每个会话独立消息数组，互不干扰 |
| 消息路由 | `setMessages(sessionId, ...)` 显式路由 | 不依赖 `currentSession` 隐式状态 |
| SSE 事件 | 根据事件自身 `sessionID` 路由 | 支持多会话并行接收事件 |
| sendMessage | `sendMessage(content, sessionId?)` | 可选参数，灵活指定目标会话 |

---

## 8. 性能优化策略

### 8.1 前端

| 优化项 | 方案 | 效果 |
|-------|------|------|
| 消息渲染 | React.memo + key 优化 | 避免不必要重渲染 |
| SSE 事件 | useCallback 缓存处理器 | 减少闭包创建 |
| 状态更新 | 函数式 setState | 确保状态连续性 |
| 多会话 | messagesMap 分离更新 | 只有变化的会话触发重渲染 |
| 大列表 | 虚拟滚动 (未来) | 处理大量消息 |

### 8.2 后端

| 优化项 | 方案 | 效果 |
|-------|------|------|
| SSE 代理 | 异步流式转发 | 低内存占用 |
| 数据库 | SQLAlchemy session 管理 | 连接池复用 |
| 并发 | 异步框架 FastAPI | 高并发支持 |

---

## 9. 安全性考虑

### 9.1 当前安全措施

| 措施 | 实现 | 说明 |
|------|------|------|
| CORS | FastAPI middleware | 防止跨域攻击 |
| 输入验证 | Pydantic models | 类型安全 |
| SQL 注入 | SQLAlchemy ORM | 参数化查询 |
| 错误处理 | 全局异常捕获 | 避免信息泄露 |

### 9.2 待加强项

| 项 | 说明 |
|----|------|
| 认证 | 当前无用户认证，需添加 JWT/Session |
| 限流 | 防止 API 滥用 |
| 日志审计 | 记录关键操作 |
| 敏感信息 | 配置文件中的密钥管理 |

---

## 10. 扩展性考虑

### 10.1 短期扩展

- [ ] 添加用户认证系统
- [ ] 支持多 OpenCode 实例
- [ ] 添加消息搜索功能
- [ ] 导出对话记录

### 10.2 长期扩展

- [ ] WebSocket 支持 (双向通信)
- [ ] PostgreSQL 迁移 (高并发)
- [ ] Docker 部署
- [ ] Kubernetes 部署
- [ ] AI 模型切换 (支持不同 LLM)

---

## 11. 开发规范

### 11.1 前端规范

- 使用 TypeScript 严格模式
- 组件使用 PascalCase
- Hooks 使用 camelCase 以 `use` 开头
- CSS 类名使用 kebab-case
- 状态更新使用函数式 setState
- 消息路由使用显式 sessionId

### 11.2 后端规范

- 使用 Python type hints
- 异步函数使用 `async/await`
- API 路由遵循 RESTful 规范
- 错误处理返回合适的 HTTP 状态码
- 日志使用 `logging` 模块

### 11.3 Git 规范

```
<type>: <description>

type: feat | fix | refactor | docs | test | chore | perf | ci
```

---

## 12. 故障排查

### 12.1 常见问题

| 问题 | 症状 | 解决方案 |
|------|------|----------|
| SSE 连接失败 | 控制台无 `[SSE] Connected` | 检查后端运行状态 |
| 消息不显示 | 事件收到但不渲染 | 检查 sessionID 路由是否正确 |
| 内容重复 | 消息内容被覆盖 | 区分 part.updated 和 part.delta |
| 会话消息混乱 | 消息出现在错误的会话 | 确认 handleSend 传递了正确的 sessionId |
| OpenCode 连接失败 | 502 错误 | 检查 OpenCode 服务端口 |

### 12.2 调试命令

```bash
# 检查端口占用
lsof -i :8000
lsof -i :36000

# 测试 SSE 流
curl -N http://localhost:8000/api/sse/events

# 检查后端日志
tail -f /tmp/backend_sse.log

# 前端类型检查
cd frontend && npx tsc --noEmit
```

---

## 13. 文档索引

| 文档 | 位置 | 说明 |
|------|------|------|
| 项目 README | README.md | 项目概述和快速开始 |
| 工作流详解 | docs/WORKFLOW.md | SSE 事件流和调试指南 |
| 技术路线 | docs/TECHNICAL_ROADMAP.md | 本文档，详细技术架构 |
| 数据库 Schema | backend/database.sql | 数据库表结构 |

---

*本文档最后更新: 2026-05-28*
# OpenCode Conversation Manager - 工作流与架构

## 1. 系统架构总览

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

## 2. SSE 连接建立

```
浏览器 ──GET /api/sse/events──▶ FastAPI ──GET /global/event──▶ OpenCode
         EventSource 建立           │                          │
                                    │  StreamingResponse      │
                                    ▼                          │
                              返回 SSE 流 ◄─────────────────────┘
```

## 3. 多会话消息发送流程

```
用户输入 "你好" ──▶ App.tsx (handleSend)
                          │
                          ▼
              handleSend(sessionId, "你好")
                          │
                          ▼
              sendMessage(content, sessionId)
                          │
                          ▼
              fetch POST /api/sse/session/{sessionId}/prompt_async
                          │
                          ▼
              FastAPI ──POST /session/{sessionId}/prompt_async──▶ OpenCode
                                                               │
                                  OpenCode 返回 204 (已接受) ◄──┘
                                  然后 SSE 开始推送事件 ◄────────┘
```

**关键点**: `handleSend` 直接传递 `sessionId` 给 `sendMessage`，不依赖 `currentSession` 状态

## 4. SSE 事件处理流程

```
OpenCode SSE 事件 ──▶ FastAPI proxy_sse() ──▶ 浏览器 EventSource
                                                      │
                                                      ▼
                                             useSseProxy.handleSSEEvent()
                                                      │
                                                      ▼
                                        ┌─────────────────────────────────────┐
                                        │       事件类型分发                  │
                                        │                                     │
                                        │  message.updated ──────▶ setMessages(sessionID, ...) │
                                        │  message.part.updated ───▶ setMessages(sessionID, ...) │
                                        │  message.part.delta ────▶ setMessages(sessionID, ...) │
                                        │  session.status ─────────▶ setStep()              │
                                        │  session.idle ───────────▶ setStep(null)          │
                                        └─────────────────────────────────────┘
                                                      │
                                                      ▼
                                             setMessages(sessionId, prev => [...])
                                                      │
                                                      ▼
                                             React 状态更新触发重新渲染
                                                      │
                                                      ▼
                                             MessageBubble 显示内容
```

**关键变化**: 不再使用 `currentSessionRef` 过滤事件，而是根据事件自身的 `sessionID` 路由到正确的会话

## 5. 多会话并行架构

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
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6. 消息状态机

```
用户发送消息 (在卡片 A 输入)
      │
      ▼
handleSend(sessionId="A", content)
      │
      ▼
sendMessage(content, sessionId="A")
      │
      ▼
setMessages("A", prev => [...prev, userMsg])  ←─── 消息直接添加到会话 A
      │
      ▼
fetch POST /session/A/prompt_async
      │
      ▼
AI 开始处理，会话 A 发送 SSE 事件
      │
      ▼
SSE 事件到达 (sessionID="A")
      │
      ▼
setMessages("A", prev => [..., newMsg])  ←─── 消息添加到会话 A，不影响其他会话
```

## 7. 核心文件说明

### 前端

| 文件 | 职责 |
|------|------|
| `useSseProxy.ts` | SSE 连接管理、事件处理、**显式 sessionId 路由** |
| `App.tsx` | 主应用组件、3D 卡片布局、多会话渲染 |
| `MessageBubble.tsx` | 单条消息的渲染组件 |

### 后端

| 文件 | 职责 |
|------|------|
| `sse_proxy.py` | SSE 代理核心，透传 OpenCode 事件 |
| `sessions.py` | 会话管理 API |
| `messages.py` | 消息持久化 API |
| `main.py` | FastAPI 应用入口 |

## 8. 问题排查指南

### 问题：消息不显示

排查步骤：

1. **检查 SSE 连接**
   - 控制台是否有 `[SSE] Connected successfully`
   - 如果没有 → 后端 SSE 代理未正常连接 OpenCode

2. **检查事件接收**
   - 控制台是否有 `[SSE] Raw event received:`
   - 如果没有 → SSE 流未建立或被阻断

3. **检查 sessionID 路由**
   - 事件是否包含 `sessionID` 字段
   - `setMessages(sessionID, ...)` 是否正确调用

4. **检查消息状态**
   - 控制台 `[SSE] message.updated` 是否出现
   - 控制台 `[SSE] message.part.delta` 是否出现

5. **检查 React 渲染**
   - App 组件的 `messagesMap[sessionId]` 是否有增加
   - MessageBubble 是否被渲染

### 问题：会话消息混乱

原因：`handleSend` 没有传递正确的 `sessionId`

解决：
1. 确认每个卡片的 `handleSend(sessionId, content)` 传递了正确的 sessionId
2. 确认 `sendMessage(content, sessionId)` 第二个参数有效

### 问题：消息内容重复

原因：`message.part.updated` 和 `message.part.delta` 同时更新同一消息

解决：只使用 `message.part.delta` 追加内容，`message.part.updated` 只填充空消息

```typescript
// message.part.updated: 只填充空消息
if (msg.id === messageID && msg.content === '') {
  return { ...msg, content: newText };
}

// message.part.delta: 追加到任何消息
if (msg.id === messageID) {
  return { ...msg, content: msg.content + delta };
}
```

## 9. 开发调试

### 前端调试

在 `useSseProxy.ts` 中添加日志：

```typescript
eventSource.onmessage = (event) => {
  console.log('[SSE] Raw event:', event.data.substring(0, 100));
  // ...
};

switch (type) {
  case 'message.updated':
    console.log('[SSE] message.updated:', info.id, 'role:', info.role, 'sessionID:', sessionID);
    // ...
}
```

### 后端调试

在 `sse_proxy.py` 中添加日志：

```python
async def proxy_sse(url: str, headers: dict, timeout: float = 300.0):
    print(f"[SSE Proxy] Opening proxy connection to: {url}")
    async for line in response.aiter_lines():
        print(f"[SSE Proxy] Forwarding: {line[:80]}")
        yield f"{line}\n".encode()
```

### 测试 SSE 流

```bash
# 测试后端 SSE 代理
curl -N http://localhost:8000/api/sse/events

# 测试 OpenCode SSE
curl -N http://localhost:36000/global/event
```

## 10. 生产环境注意事项

1. **SSE 超时**：配置合适的超时时间，避免连接断开
2. **重连机制**：EventSource 自动断开后需要手动重连
3. **消息去重**：使用消息 ID 避免重复添加
4. **内容覆盖**：区分 `part.updated`（完整内容）和 `part.delta`（增量）
5. **多会话路由**：使用显式 sessionId 路由，不依赖隐式状态

---

*本文档最后更新: 2026-05-28*
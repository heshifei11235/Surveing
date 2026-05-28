import { useState, useCallback, useRef, useEffect } from 'react';

export interface OpenCodeMessage {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface OpenCodeSession {
  id: string;
  title?: string;
  directory?: string;
  created_at?: string;
}

export interface StepInfo {
  step: string;
  progress: number;
}

interface UseSseProxyOptions {
  baseUrl: string;
  directory?: string;
}

/**
 * Hook for SSE-based communication with OpenCode via backend proxy
 *
 * Architecture:
 * ┌─────────────────┐     HTTP/SSE      ┌─────────────────┐     HTTP/SSE      ┌─────────────────┐
 * │   Vue 前端      │ ◄──────────────► │  FastAPI 后端   │ ◄──────────────► │   OpenCode      │
 * │   (聊天界面)    │   SSE 流式响应    │  (透传代理)     │   prompt_async   │   Server        │
 * └─────────────────┘                   └─────────────────┘   /global/event   └─────────────────┘
 */
export function useSseProxy({ baseUrl, directory }: UseSseProxyOptions) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<OpenCodeSession[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  // Messages are stored per-session to support multiple open conversations
  const [messagesMap, setMessagesMap] = useState<Record<string, OpenCodeMessage[]>>({});
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<StepInfo | null>(null);

  // Helper to update messages for a specific session
  const setMessages = useCallback((sessionId: string | null, updater: (prev: OpenCodeMessage[]) => OpenCodeMessage[]) => {
    if (!sessionId) return;
    setMessagesMap(prev => ({
      ...prev,
      [sessionId]: updater(prev[sessionId] || [])
    }));
  }, []);

  // EventSource for global events (not session-specific)
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseConnectedRef = useRef<boolean>(false);
  // Use ref to track current session for SSE callback (avoids stale closure)
  const currentSessionRef = useRef<string | null>(null);
  // Fallback polling timer
  const fallbackPollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  // Initialize and connect to SSE events
  useEffect(() => {
    setInitialized(true);
    console.log('SSE Proxy initialized:', baseUrl);

    // Connect to global SSE events for real-time updates
    connectSSE();

    return () => {
      cleanup();
    };
  }, [baseUrl]);

  // Connect to SSE events endpoint
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${baseUrl}/api/sse/events`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] Connected successfully');
      setError(null);
      sseConnectedRef.current = true;
      // Clear any fallback polling
      if (fallbackPollingRef.current) {
        clearInterval(fallbackPollingRef.current);
        fallbackPollingRef.current = null;
      }
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(data);
      } catch (err) {
        console.error('[SSE] Parse error:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[SSE] EventSource error:', err);
      sseConnectedRef.current = false;

      // Close EventSource
      eventSource.close();
      eventSourceRef.current = null;

      // Start fallback polling if not already running
      if (!fallbackPollingRef.current && currentSessionRef.current) {
        fallbackPollingRef.current = setInterval(() => {
          if (currentSessionRef.current && !sseConnectedRef.current) {
            fetchMessagesForSession(currentSessionRef.current);
          }
        }, 3000);
      }
    };
  }, [baseUrl, directory]);

  // Handle incoming SSE events
  const handleSSEEvent = useCallback((data: any) => {
    const { payload } = data;
    if (!payload) return;

    const { type, properties } = payload;
    const sessionID = properties?.sessionID;

    // Route event to the correct session based on event's sessionID
    if (!sessionID) return;

    switch (type) {
      case 'message.updated': {
        // New or updated message
        const info = properties.info;
        if (!info) return;

        const newMsg: OpenCodeMessage = {
          id: info.id || `msg-${Date.now()}`,
          sessionID,
          role: info.role === 'user' ? 'user' : 'assistant',
          content: '', // Content comes in part events
          created_at: info.time?.created
            ? new Date(info.time.created).toISOString()
            : new Date().toISOString(),
        };

        setMessages(sessionID, prev => {
          // Check if message already exists - don't add duplicates
          const existingIndex = prev.findIndex(m => m.id === newMsg.id);
          if (existingIndex >= 0) {
            return prev;
          }
          return [...prev, newMsg];
        });
        break;
      }

      case 'message.part.updated': {
        // Text part updated - this contains the complete text for the message
        // Only use it to FILL empty messages, don't overwrite delta-updated content
        const part = properties.part;
        if (!part || part.type !== 'text') return;

        setMessages(sessionID, prev => {
          const messageID = part.messageID;
          const newText = part.text || '';

          // Only fill empty messages - don't overwrite content that was built via delta
          return prev.map(msg => {
            if (msg.id === messageID && msg.content === '') {
              return { ...msg, content: newText };
            }
            return msg;
          });
        });
        break;
      }

      case 'session.status': {
        const status = properties.status;
        if (status?.type === 'busy') {
          setStep({ step: 'AI 正在思考...', progress: 0.5 });
        } else if (status?.type === 'done' || status?.type === 'idle') {
          setStep(null);
        }
        break;
      }

      case 'message.part.delta': {
        const { field, delta, messageID } = properties;
        if (field === 'text' && delta && messageID && sessionID) {
          setMessages(sessionID, prev => prev.map(msg => {
            if (msg.id === messageID) {
              return { ...msg, content: msg.content + delta };
            }
            return msg;
          }));
        }
        break;
      }

      case 'session.idle': {
        setStep(null);
        break;
      }

      case 'step-start': {
        setStep({ step: '开始执行...', progress: 0.3 });
        break;
      }

      case 'step-finish': {
        setStep(null);
        break;
      }

      default:
        break;
    }
  }, []); // No dependencies - uses currentSessionRef.current

  // Clean up connections
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (fallbackPollingRef.current) {
      clearInterval(fallbackPollingRef.current);
      fallbackPollingRef.current = null;
    }
  }, []);

  // Fetch messages for a session (used by polling fallback)
  const fetchMessagesForSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(
        `${baseUrl}/api/sse/session/${sessionId}/messages?limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        const messageList = Array.isArray(data) ? data : data.data || [];

        if (messageList.length > 0) {
          const msgs = messageList.map((msg: any) => {
            const info = msg.info || msg;
            return {
              id: info.id || `msg-${Date.now()}-${Math.random()}`,
              sessionID: sessionId,
              role: info.role === 'user' ? 'user' : 'assistant',
              content: extractContent(msg),
              created_at: info.time?.created
                ? new Date(info.time.created).toISOString()
                : new Date().toISOString(),
            };
          });

          setMessages(sessionId, prev => {
            const existingIds = new Set(prev.map(msg => msg.id));
            const newMsgs = msgs.filter((msg: OpenCodeMessage) => !existingIds.has(msg.id));
            if (newMsgs.length === 0) return prev;
            return [...prev, ...newMsgs];
          });
        }
      }
    } catch (e) {
      console.error('[Polling] Fetch failed:', e);
    }
  }, [baseUrl]);

  // Load sessions from backend proxy
  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(`${baseUrl}/api/sse/session/list?limit=20`);
      if (!response.ok) {
        throw new Error(`Failed to load sessions: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Sessions loaded:', data);

      const sessionList = Array.isArray(data) ? data : data.data || [];
      setSessions(sessionList.map((s: any) => ({
        id: s.id || s.sessionID,
        title: s.title || `Session ${(s.id || '').slice(-6) || 'unknown'}`,
        directory: s.directory,
        created_at: s.time?.created ? new Date(s.time.created).toISOString() : new Date().toISOString(),
      })));
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    }
  }, [baseUrl, directory]);

  // Create new session
  const createSession = useCallback(async (title?: string) => {
    try {
      const response = await fetch(`${baseUrl}/api/sse/session/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),  // Don't send directory
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Session created:', data);

      const session = Array.isArray(data) ? data[0] : data.data || data;
      const newSession: OpenCodeSession = {
        id: session.id || session.sessionID,
        title: session.title || title || `Session ${(session.id || '').slice(-6)}`,
        directory: session.directory || directory,
        created_at: session.time?.created
          ? new Date(session.time.created).toISOString()
          : new Date().toISOString(),
      };

      const newSessionId = session.id || session.sessionID;
      currentSessionRef.current = newSessionId; // Sync ref FIRST
      setCurrentSession(newSessionId);
      // Initialize empty messages map for this session
      setMessagesMap(prev => ({
        ...prev,
        [newSessionId]: []
      }));

      return newSession;
    } catch (err) {
      console.error('Failed to create session:', err);
      setError(err instanceof Error ? err.message : 'Failed to create session');
      return null;
    }
  }, [baseUrl, directory]);

  // Select session and load messages
  const selectSession = useCallback(async (sessionId: string) => {
    currentSessionRef.current = sessionId; // Sync ref FIRST to avoid race condition
    setCurrentSession(sessionId);

    // If we already have messages for this session, just switch
    if (messagesMap[sessionId] && messagesMap[sessionId].length > 0) {
      return;
    }

    // Load existing messages from the session
    try {
      const response = await fetch(
        `${baseUrl}/api/sse/session/${sessionId}/messages?limit=50`
      );

      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.statusText}`);
      }

      const data = await response.json();
      const messageList = Array.isArray(data) ? data : data.data || [];

      const msgs: OpenCodeMessage[] = messageList.map((msg: any) => {
        const info = msg.info || msg;
        return {
          id: info.id || `msg-${Date.now()}-${Math.random()}`,
          sessionID: sessionId,
          role: info.role === 'user' ? 'user' : 'assistant',
          content: extractContent(msg),
          created_at: info.time?.created
            ? new Date(info.time.created).toISOString()
            : new Date().toISOString(),
        };
      });

      // Sort messages by creation time
      msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Store messages for this session
      setMessagesMap(prev => ({
        ...prev,
        [sessionId]: msgs
      }));
    } catch (err) {
      console.error('Failed to load messages:', err);
    }

    // Note: SSE connection is shared across all sessions
    // When a message arrives via SSE, we filter by currentSession
  }, [baseUrl, directory, messagesMap]);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(
        `${baseUrl}/api/sse/session/${sessionId}?directory=${directory || ''}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.statusText}`);
      }

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession === sessionId) {
        setCurrentSession(null);
        setMessagesMap(prev => {
          const next = { ...prev };
          delete next[sessionId];
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    }
  }, [baseUrl, directory, currentSession]);

  // Send message using prompt_async
  const sendMessage = useCallback(async (content: string, sessionId?: string) => {
    const targetSession = sessionId || currentSession;
    if (!targetSession || sending) {
      return;
    }

    setSending(true);
    setStep({ step: '正在发送...', progress: 0.2 });

    // Add user message immediately (optimistic update)
    const userMsg: OpenCodeMessage = {
      id: `temp-${Date.now()}`,
      sessionID: targetSession,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(targetSession, prev => [...prev, userMsg]);

    try {
      const response = await fetch(
        `${baseUrl}/api/sse/session/${targetSession}/prompt_async`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parts: [{ type: 'text', text: content }]
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      setStep({ step: 'AI 正在思考...', progress: 0.5 });

    } catch (err) {
      console.error('Send message error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove optimistic update on error
      setMessages(targetSession, prev => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setSending(false);
    }
  }, [currentSession, sending, baseUrl]);

  // Cleanup on unmount
  // (handled by the main useEffect return above)

  return {
    initialized,
    error,
    sessions,
    currentSession,
    messagesMap,
    sending,
    step,
    loadSessions,
    createSession,
    selectSession,
    deleteSession,
    sendMessage,
  };
}

// Helper to extract text content from a message
function extractContent(msg: any): string {
  // Handle v1 API format: { info: {...}, parts: [...] }
  if (msg.info && msg.parts && Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('');
  }

  // Handle simple message format
  if (msg.parts && Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('');
  }

  return msg.summary?.title || msg.content || '';
}
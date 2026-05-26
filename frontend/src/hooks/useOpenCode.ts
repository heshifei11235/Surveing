import { useState, useCallback, useRef, useEffect } from 'react';
import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk';

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

interface UseOpenCodeOptions {
  baseUrl: string;
  directory?: string;
}

export function useOpenCode({ baseUrl, directory }: UseOpenCodeOptions) {
  const clientRef = useRef<OpencodeClient | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<OpenCodeSession[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<OpenCodeMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<StepInfo | null>(null);

  // Initialize client
  useEffect(() => {
    try {
      clientRef.current = createOpencodeClient({
        baseUrl,
        directory,
      });
      setInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize OpenCode client');
    }
  }, [baseUrl, directory]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      const result = await clientRef.current.session.list({
        query: { directory },
      });
      setSessions(result.data || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, [directory]);

  // Create new session
  const createSession = useCallback(async (title?: string) => {
    if (!clientRef.current) return null;
    try {
      const result = await clientRef.current.session.create({
        body: { title },
        query: { directory },
      });
      const session = result.data;
      if (session) {
        setSessions(prev => [session, ...prev]);
        setCurrentSession(session.id);
        setMessages([]);
      }
      return session;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
      return null;
    }
  }, [directory]);

  // Select session and load messages
  const selectSession = useCallback(async (sessionId: string) => {
    if (!clientRef.current) return;
    setCurrentSession(sessionId);
    try {
      const result = await clientRef.current.session.messages({
        path: { id: sessionId },
        query: { directory },
      });
      const msgs: OpenCodeMessage[] = (result.data || []).map((msg: any) => ({
        id: msg.id,
        sessionID: msg.sessionID,
        role: msg.role,
        content: extractContent(msg),
        created_at: new Date(msg.time?.created || Date.now()).toISOString(),
      }));
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([]);
    }
  }, [directory]);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!clientRef.current) return;
    try {
      await clientRef.current.session.delete({
        path: { id: sessionId },
        query: { directory },
      });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    }
  }, [directory, currentSession]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!clientRef.current || !currentSession || sending) return;

    setSending(true);
    setStep(null);

    // Add user message immediately
    const userMsg: OpenCodeMessage = {
      id: `temp-${Date.now()}`,
      sessionID: currentSession,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Add placeholder for assistant
    const assistantMsgId = `temp-${Date.now()}-ai`;
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      sessionID: currentSession,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }]);

    try {
      // Send message
      const result = await clientRef.current.session.prompt({
        path: { id: currentSession },
        body: {
          parts: [{ type: 'text', text: content }],
        },
        query: { directory },
      });

      // Process the response
      const info = result.data?.info;
      const parts = result.data?.parts || [];

      // Process parts and update messages
      let fullContent = '';
      for (const part of parts) {
        if (part.type === 'text') {
          fullContent += part.text;
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId ? { ...m, content: fullContent } : m
          ));
        } else if (part.type === 'reasoning') {
          fullContent += `\n[思考] ${part.text}`;
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId ? { ...m, content: fullContent } : m
          ));
        } else if (part.type === 'step-start') {
          setStep({ step: '开始步骤...', progress: 0.3 });
        } else if (part.type === 'step-finish') {
          setStep({ step: `完成: ${part.reason}`, progress: 1 });
        }
      }

      // Update with final message info
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? {
          ...m,
          content: fullContent,
          created_at: new Date(info?.time?.created || Date.now()).toISOString(),
        } : m
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove failed messages
      setMessages(prev => prev.filter(m => m.id !== userMsg.id && m.id !== assistantMsgId));
    } finally {
      setSending(false);
      setStep(null);
    }
  }, [currentSession, sending, directory]);

  return {
    initialized,
    error,
    sessions,
    currentSession,
    messages,
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
  if (msg.role === 'user') {
    return msg.summary?.title || '';
  }

  // For assistant messages, reconstruct from parts
  if (msg.parts && Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('');
  }

  return msg.summary?.title || '';
}
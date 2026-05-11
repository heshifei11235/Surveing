import { useState, useCallback } from 'react';
import type {
  Task,
  Session,
  Message,
  ConversationResponse,
  CreateTaskRequest,
  UpdateTaskRequest,
  SendMessageRequest,
} from '../types';

const API_BASE = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  if (response.status === 204) {
    return null as T;
  }
  return response.json();
}

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Task APIs
  const createTask = useCallback(async (data: CreateTaskRequest): Promise<Task> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/tasks/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await handleResponse<Task>(response);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const listTasks = useCallback(async (): Promise<Task[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/tasks/`);
      return await handleResponse<Task[]>(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list tasks';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTask = useCallback(async (taskId: number): Promise<Task> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`);
      return await handleResponse<Task>(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get task';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTask = useCallback(async (taskId: number, data: UpdateTaskRequest): Promise<Task> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return await handleResponse<Task>(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update task';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTask = useCallback(async (taskId: number): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'DELETE',
      });
      await handleResponse<void>(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete task';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Session APIs
  const createSession = useCallback(async (taskId: number): Promise<Session> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await handleResponse<Session>(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const listTaskSessions = useCallback(async (taskId: number): Promise<Session[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/sessions`);
      return await handleResponse<Session[]>(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list sessions';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSession = useCallback(async (sessionId: number): Promise<Session> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`);
      return await handleResponse<Session>(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get session';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: number): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      await handleResponse<void>(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Message APIs
  const sendMessage = useCallback(async (sessionId: number, data: SendMessageRequest): Promise<Message> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return await handleResponse<Message>(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getMessages = useCallback(async (sessionId: number): Promise<Message[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/messages`);
      return await handleResponse<Message[]>(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get messages';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getConversation = useCallback(async (sessionId: number): Promise<ConversationResponse> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/conversation`);
      return await handleResponse<ConversationResponse>(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get conversation';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    clearError,
    // Tasks
    createTask,
    listTasks,
    getTask,
    updateTask,
    deleteTask,
    // Sessions
    createSession,
    listTaskSessions,
    getSession,
    deleteSession,
    // Messages
    sendMessage,
    getMessages,
    getConversation,
  };
}

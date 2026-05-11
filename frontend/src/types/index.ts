export interface Task {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: number;
  task_id: number;
  mode: string;
  opencode_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ConversationResponse {
  messages: Message[];
  session: Session;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
}

export interface SendMessageRequest {
  content: string;
}

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import type { Task, Session, Message } from '../types';

interface ConversationPanelProps {
  task: Task | null;
  session: Session | null;
  onSendMessage: (content: string) => Promise<void>;
}

export default function ConversationPanel({ task, session, onSendMessage }: ConversationPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (session) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [session?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    if (!session) return;
    try {
      const response = await fetch(`/api/sessions/${session.id}/messages`);
      const data = await response.json();
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !session || sending) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);

    // Optimistic update - add user message immediately
    const tempMessage: Message = {
      id: Date.now(),
      session_id: session.id,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      await onSendMessage(userMessage);
      // Fetch updated messages after sending
      await fetchMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
      // Remove optimistic update on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  if (!task) {
    return (
      <div className="h-full flex flex-col items-center justify-center glass rounded-xl">
        <div className="text-center px-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1.5">欢迎使用 OpenCode</h3>
          <p className="text-gray-400 text-sm">从左侧选择一个任务开始对话</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-full flex flex-col items-center justify-center glass rounded-xl">
        <div className="text-center px-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1.5">{task.title}</h3>
          <p className="text-gray-400 text-sm">点击 + 开始新对话</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col glass rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">{task.title}</h3>
            <p className="text-[10px] text-gray-500">#{session.id} · {messages.length} 条消息</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary-400" />
              </div>
              <p className="text-gray-400 text-sm">开始对话吧！</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${
                message.role === 'user'
                  ? 'bg-primary-500'
                  : 'bg-gradient-to-br from-purple-500 to-pink-500'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-3 h-3 text-white" />
                ) : (
                  <Bot className="w-3 h-3 text-white" />
                )}
              </div>

              {/* Message Bubble */}
              <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block px-3 py-2 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-primary-500 text-white rounded-tr-md'
                    : 'bg-white/10 text-gray-100 rounded-tl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                </div>
                <p className="text-[10px] text-gray-600 mt-0.5 px-1">
                  {formatTime(message.created_at)}
                </p>
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {sending && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="inline-block px-3 py-2 rounded-2xl bg-white/10">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-xs">思考中...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送)"
              rows={1}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-primary-500/50 focus:bg-white/10 transition-all"
              style={{ maxHeight: '100px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 p-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all glow-primary-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

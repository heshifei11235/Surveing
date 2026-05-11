import { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, Send, MessageSquare, User, Code, FileText, Terminal, Copy, GripVertical, Play, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Task, Session, Message } from './types';

// ============ API Functions ============
const API_BASE = '/api';

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }
  return res.json();
}

async function createTask(title: string, description?: string): Promise<Task> {
  return apiFetch('/tasks/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  });
}

async function createSession(taskId: number, mode: string): Promise<Session> {
  return apiFetch(`/tasks/${taskId}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
}

async function fetchSessions(taskId: number): Promise<Session[]> {
  return apiFetch(`/tasks/${taskId}/sessions`);
}

async function fetchMessages(sessionId: number): Promise<Message[]> {
  return apiFetch(`/sessions/${sessionId}/messages`);
}

// ============ Task Input Component ============
function TaskInput({
  value,
  onChange,
  onStart,
  mode,
  onModeChange,
  disabled
}: {
  value: string;
  onChange: (v: string) => void;
  onStart: () => void;
  mode: 'semi_auto' | 'full_auto';
  onModeChange: (m: 'semi_auto' | 'full_auto') => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      {/* Task Name */}
      <div>
        <label className="block text-xs text-gray-400 mb-2">任务名称</label>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="输入调查任务名称..."
          disabled={disabled}
          className="w-full px-3 py-2.5 rounded-xl text-xs text-white placeholder-gray-500 bg-white/5 border border-white/10 focus:border-blue-500/50 focus:outline-none transition-colors disabled:opacity-50"
        />
      </div>

      {/* Survey Mode */}
      <div>
        <label className="block text-xs text-gray-400 mb-2">调查模式</label>
        <div className="space-y-2">
          <ModeOption
            mode="semi_auto"
            label="半自动模式"
            desc="AI 逐步引导，每次等待用户确认"
            selected={mode === 'semi_auto'}
            onSelect={() => onModeChange('semi_auto')}
            disabled={disabled}
          />
          <ModeOption
            mode="full_auto"
            label="全自动模式"
            desc="AI 自动深度分析，一键生成报告"
            selected={mode === 'full_auto'}
            onSelect={() => onModeChange('full_auto')}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={onStart}
        disabled={!value.trim() || disabled}
        className="w-full py-3 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
      >
        {disabled ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>创建中...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            <span>开始调查</span>
          </>
        )}
      </button>
    </div>
  );
}

function ModeOption({
  mode,
  label,
  desc,
  selected,
  onSelect,
  disabled
}: {
  mode: 'semi_auto' | 'full_auto';
  label: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const colors = mode === 'semi_auto'
    ? { border: 'blue', bg: 'rgba(59,130,246,0.12)' }
    : { border: 'emerald', bg: 'rgba(16,185,129,0.12)' };

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${
        selected ? `border-${colors.border}-500/50` : 'border-transparent'
      } ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
      style={{ background: selected ? colors.bg : 'rgba(255,255,255,0.03)' }}
    >
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center border-${colors.border}-500`}>
        {selected && <div className={`w-2 h-2 rounded-full bg-${colors.border}-500`} />}
      </div>
      <div className="text-left">
        <div className="text-xs font-medium text-white">{label}</div>
        <div className="text-[10px] text-gray-500 mt-0.5">{desc}</div>
      </div>
    </button>
  );
}

// ============ Session List Component ============
function SessionList({
  sessions,
  taskMap,
  selectedId,
  onSelect
}: {
  sessions: Session[];
  taskMap: Record<number, Task>;
  selectedId: number | null;
  onSelect: (s: Session) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">会话历史</div>
      {sessions.length === 0 ? (
        <div className="text-center py-4 text-gray-600 text-xs">暂无会话</div>
      ) : (
        sessions.map(s => {
          const task = taskMap[s.task_id];
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className={`w-full flex flex-col items-start gap-1 px-3 py-2 rounded-lg text-left text-[10px] transition-all ${
                selectedId === s.id
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 w-full">
                <div className={`w-1.5 h-1.5 rounded-full ${selectedId === s.id ? 'bg-blue-400' : 'bg-gray-600'}`} />
                <span className="truncate font-medium">{task?.title || `任务 #${s.task_id}`}</span>
                <span className="ml-auto text-gray-600">{new Date(s.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</span>
              </div>
              <div className="text-gray-600 ml-3.5">
                {s.mode === 'semi_auto' ? '半自动' : '全自动'} · 会话 #{s.id}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

// ============ Message Bubble ============
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
        isUser
          ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30'
          : 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30'
      }`}>
        {isUser ? <User className="w-3.5 h-3.5 text-white" /> : <Bot className="w-3.5 h-3.5 text-white" />}
      </div>
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block px-3 py-2 rounded-2xl text-xs leading-relaxed ${
          isUser
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-tr-sm shadow-lg shadow-blue-500/30'
            : 'bg-white/8 text-gray-200 rounded-tl-sm border border-white/10'
        }`}>
          {msg.content}
        </div>
        <p className="text-[10px] text-gray-600 mt-0.5 px-1">
          {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

// ============ Typing Indicator ============
function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-1">
          {[0, 150, 300].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-blue-400"
              style={{ animation: `bounce 1s infinite`, animationDelay: `${i}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ Resizable Panels ============
function ResizablePanels({ children }: { children: [React.ReactNode, React.ReactNode, React.ReactNode] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(10);
  const [rightWidth, setRightWidth] = useState(50);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const leftMin = 10, leftMax = 20;
  const middleMin = 30;
  const rightMin = 30, rightMax = 70;

  const handleMouseDown = useCallback((e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault();
    setDragging(side);
    startXRef.current = e.clientX;
    startWidthRef.current = side === 'left' ? leftWidth : rightWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftWidth, rightWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging || !containerRef.current) return;
      const containerWidth = containerRef.current.getBoundingClientRect().width;
      const deltaX = e.clientX - startXRef.current;
      const deltaPercent = (deltaX / containerWidth) * 100;

      if (dragging === 'left') {
        const maxLeft = 100 - middleMin - rightMin;
        const newLeft = startWidthRef.current + deltaPercent;
        setLeftWidth(Math.max(leftMin, Math.min(Math.min(leftMax, maxLeft), newLeft)));
      } else {
        const maxRight = 100 - middleMin - leftMin;
        const newRight = startWidthRef.current - deltaPercent;
        setRightWidth(Math.max(rightMin, Math.min(Math.min(rightMax, maxRight), newRight)));
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  const middleWidth = 100 - leftWidth - rightWidth;

  return (
    <div ref={containerRef} className="flex h-full w-full gap-2">
      <div style={{ width: `${leftWidth}%` }} className="h-full flex-shrink-0">
        {children[0]}
      </div>
      <Divider dragging={dragging === 'left'} onMouseDown={(e) => handleMouseDown(e, 'left')} />
      <div style={{ width: `${middleWidth}%` }} className="h-full flex-shrink-0">
        {children[1]}
      </div>
      <Divider dragging={dragging === 'right'} onMouseDown={(e) => handleMouseDown(e, 'right')} />
      <div style={{ width: `${rightWidth}%` }} className="h-full flex-shrink-0">
        {children[2]}
      </div>
    </div>
  );
}

function Divider({ dragging, onMouseDown }: { dragging: boolean; onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      className={`w-1.5 flex-shrink-0 rounded-full cursor-col-resize flex items-center justify-center transition-colors ${
        dragging ? 'bg-blue-500' : 'bg-white/10 hover:bg-blue-500/50'
      }`}
      onMouseDown={onMouseDown}
    >
      <div className="w-3 h-6 rounded-full bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
        <GripVertical className="w-2 h-2 text-white/70" />
      </div>
    </div>
  );
}

// ============ Panel Card ============
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full rounded-2xl border border-white/10 overflow-hidden flex flex-col"
      style={{
        background: 'linear-gradient(165deg, rgba(30,35,48,0.98) 0%, rgba(22,27,38,0.99) 100%)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {children}
    </div>
  );
}

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-white/5"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)' }}
    >
      {children}
    </div>
  );
}

// ============ Main App ============
export default function App() {
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [taskMap, setTaskMap] = useState<Record<number, Task>>({});
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<number, Message[]>>({});
  const [inputMap, setInputMap] = useState<Record<number, string>>({});
  const [sendingMap, setSendingMap] = useState<Record<number, boolean>>({});
  const [activeConversations, setActiveConversations] = useState<number[]>([]);

  // Survey form state
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyMode, setSurveyMode] = useState<'semi_auto' | 'full_auto'>('semi_auto');
  const [loadingSurvey, setLoadingSurvey] = useState(false);

  // Result tab
  const [activeResultTab, setActiveResultTab] = useState<'all' | 'code' | 'results'>('all');

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, []);

  // Load messages when session changes
  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession.id);
    }
  }, [selectedSession?.id]);

  const loadTasks = async () => {
    try {
      const tasks: Task[] = await apiFetch('/tasks/');
      const newTaskMap: Record<number, Task> = {};
      const allSess: Session[] = [];

      for (const task of tasks) {
        newTaskMap[task.id] = task;
        const sessions = await fetchSessions(task.id);
        allSess.push(...sessions);
      }

      setTaskMap(newTaskMap);
      // Sort sessions by creation date, newest first
      allSess.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAllSessions(allSess);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  const loadMessages = async (sessionId: number) => {
    try {
      const data = await fetchMessages(sessionId);
      setMessagesMap(prev => ({ ...prev, [sessionId]: data }));
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessagesMap(prev => ({ ...prev, [sessionId]: [] }));
    }
  };

  const handleStartSurvey = async () => {
    if (!surveyTitle.trim() || loadingSurvey) return;

    setLoadingSurvey(true);
    try {
      const task = await createTask(surveyTitle, `调查模式: ${surveyMode === 'semi_auto' ? '半自动' : '全自动'}`);
      const session = await createSession(task.id, surveyMode);

      setTaskMap(prev => ({ ...prev, [task.id]: task }));
      setAllSessions(prev => [session, ...prev]);
      setSelectedSession(session);
      setActiveConversations(prev => [session.id, ...prev.filter(id => id !== session.id)]);
      setSurveyTitle('');
      setMessagesMap(prev => ({ ...prev, [session.id]: [] }));
    } catch (err) {
      console.error('Failed to start survey:', err);
    } finally {
      setLoadingSurvey(false);
    }
  };

  const handleSend = async (sessionId: number) => {
    const content = (inputMap[sessionId] || '').trim();
    if (!content || sendingMap[sessionId]) return;

    setSendingMap(prev => ({ ...prev, [sessionId]: true }));
    setInputMap(prev => ({ ...prev, [sessionId]: '' }));

    const tempMsg: Message = {
      id: Date.now(),
      session_id: sessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessagesMap(prev => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), tempMsg]
    }));

    // Create placeholder for AI response
    const aiMsg: Message = {
      id: Date.now() + 1,
      session_id: sessionId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };
    setMessagesMap(prev => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), aiMsg]
    }));

    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/messages/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                setMessagesMap(prev => ({
                  ...prev,
                  [sessionId]: (prev[sessionId] || []).map(m =>
                    m.id === aiMsg.id ? { ...m, content: m.content + data.chunk } : m
                  )
                }));
              }
              if (data.done) {
                // Reload messages to get the persisted version
                await loadMessages(sessionId);
              }
              if (data.error) {
                console.error('Stream error:', data.error);
              }
            } catch (e) {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }
    } catch (err) {
      console.error('Send failed:', err);
      setMessagesMap(prev => ({
        ...prev,
        [sessionId]: (prev[sessionId] || []).filter(m => m.id !== tempMsg.id && m.id !== aiMsg.id)
      }));
    } finally {
      setSendingMap(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  
  const parseContent = (text: string) => {
    const parts: { type: string; content: string; lang?: string }[] = [];
    const codeBlock = /```(\w+)?\n([\s\S]*?)```/g;
    let last = 0;
    let m;
    while ((m = codeBlock.exec(text)) !== null) {
      if (m.index > last) parts.push({ type: 'text', content: text.slice(last, m.index).trim() });
      parts.push({ type: 'code', lang: m[1] || 'text', content: m[2].trim() });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ type: 'text', content: text.slice(last).trim() });
    if (!parts.length && text.trim()) parts.push({ type: 'text', content: text.trim() });
    return parts;
  };

  const latestAi = activeConversations.length > 0
    ? (messagesMap[activeConversations[0]] || []).filter((m: Message) => m.role === 'assistant').pop()
    : undefined;
  const resultParts = latestAi ? parseContent(latestAi.content) : [];
  const filtered = resultParts.filter(p =>
    activeResultTab === 'all' ||
    (activeResultTab === 'code' && p.type === 'code') ||
    (activeResultTab === 'results' && p.type === 'code')
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(165deg, #0d1117 0%, #0a0f17 50%, #0c1220 100%)' }}
    >
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-white/5 flex-shrink-0"
        style={{
          background: 'linear-gradient(180deg, rgba(25,30,42,0.99) 0%, rgba(20,25,35,0.98) 100%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 flex items-center justify-center"
              style={{ boxShadow: '0 4px 20px rgba(59,130,246,0.4)' }}>
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#1c2333]" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight">OpenCode 调查系统</h1>
            <p className="text-[10px] text-gray-500">智能对话调查助手</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20"
          style={{ boxShadow: '0 0 25px rgba(16,185,129,0.1)' }}
        >
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-60" />
          </div>
          <span className="text-xs font-medium text-emerald-400">系统在线</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex overflow-hidden p-4">
        <ResizablePanels>
          {/* Left Sidebar */}
          <Panel>
            <PanelHeader>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-amber-500/25 flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">调查任务</span>
              </div>
            </PanelHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 上面：创建调查表单 - 始终显示 */}
              <TaskInput
                value={surveyTitle}
                onChange={setSurveyTitle}
                onStart={handleStartSurvey}
                mode={surveyMode}
                onModeChange={setSurveyMode}
                disabled={loadingSurvey}
              />

              {/* 下面：会话历史列表 - 始终显示 */}
              <SessionList
                sessions={allSessions}
                taskMap={taskMap}
                selectedId={selectedSession?.id ?? null}
                onSelect={(s) => {
                  setSelectedSession(s);
                  setActiveConversations(prev => [s.id, ...prev.filter(id => id !== s.id)]);
                  loadMessages(s.id);
                }}
              />
            </div>
          </Panel>

          {/* Middle Chat - 3D Carousel */}
          <div className="h-full relative">
            {activeConversations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/15 via-cyan-500/10 to-purple-500/15 flex items-center justify-center mb-5"
                  style={{ boxShadow: '0 0 80px rgba(59,130,246,0.15)' }}
                >
                  <Bot className="w-10 h-10 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">OpenCode 调查系统</h2>
                <p className="text-sm text-gray-500 mb-6">创建调查任务开始智能分析</p>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
                    <span>输入任务名称</span>
                  </div>
                  <div className="w-6 h-px bg-gray-700" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
                    <span>选择模式</span>
                  </div>
                  <div className="w-6 h-px bg-gray-700" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
                    <span>开始调查</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* 3D Carousel Container */}
                <div className="h-full flex items-center justify-center perspective-1000">
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Left Nav Button */}
                    <button
                      onClick={() => setActiveConversations(prev => {
                        if (prev.length <= 1) return prev;
                        return [prev[prev.length - 1], ...prev.slice(0, -1)];
                      })}
                      className="absolute left-4 z-30 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-all shadow-lg"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    {/* Cards */}
                    <div className="relative w-full h-full flex items-center justify-center px-16">
                      {activeConversations.map((sessionId, idx) => {
                        const session = allSessions.find(s => s.id === sessionId);
                        const task = session ? taskMap[session.task_id] : null;
                        const messages = messagesMap[sessionId] || [];
                        const input = inputMap[sessionId] || '';
                        const sending = sendingMap[sessionId] || false;
                        if (!session) return null;

                        const isCenter = idx === 0;
                        const isLeft = idx === activeConversations.length - 1;
                        const isRight = idx === 1 && activeConversations.length > 1;

                        return (
                          <div
                            key={sessionId}
                            onClick={() => {
                              if (!isCenter) {
                                setActiveConversations(prev => {
                                  const arr = prev.filter(id => id !== sessionId);
                                  return [sessionId, ...arr];
                                });
                              }
                            }}
                            className={`absolute h-[90%] rounded-2xl border border-white/20 overflow-hidden flex flex-col transition-all duration-500 ease-out cursor-pointer ${
                              isCenter
                                ? 'w-[80%] z-20 shadow-2xl shadow-purple-500/20'
                                : 'w-[55%] z-10 opacity-80 hover:opacity-100'
                            }`}
                            style={{
                              background: 'linear-gradient(165deg, rgba(30,35,48,0.98) 0%, rgba(22,27,38,0.99) 100%)',
                              transform: `
                                ${isCenter ? '' : isLeft ? 'rotateY(20deg)' : 'rotateY(-20deg)'}
                                translateX(${
                                  isCenter ? '0%' :
                                  isLeft ? '-40%' :
                                  isRight ? '40%' :
                                  '0%'
                                })
                                translateZ(${isCenter ? '0px' : '-80px'})
                                scale(${isCenter ? 1 : 0.9})
                              `,
                              display: (idx > 2 || idx < 0) ? 'none' : 'flex',
                            }}
                          >
                            {/* Card Header */}
                            <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2"
                              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)' }}
                            >
                              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                                <Bot className="w-3 h-3 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-xs font-medium text-white truncate">{task?.title || `任务 #${session.task_id}`}</h3>
                                <p className="text-[9px] text-gray-500">
                                  #{session.id} · {session.mode === 'semi_auto' ? '半自动' : '全自动'}
                                </p>
                              </div>
                              {isCenter && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveConversations(prev => prev.filter(id => id !== sessionId));
                                  }}
                                  className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                              {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                  <Bot className="w-6 h-6 mb-2 opacity-30" />
                                  <p className="text-xs">开始发送消息</p>
                                </div>
                              ) : (
                                messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
                              )}
                              {sending && <TypingIndicator />}
                            </div>

                            {/* Input */}
                            <div className="px-4 py-2.5 border-t border-white/10"
                              style={{ background: 'linear-gradient(0deg, rgba(255,255,255,0.02) 0%, transparent 100%)' }}
                            >
                              <div className="flex items-center gap-2">
                                <textarea
                                  value={input}
                                  onChange={(e) => setInputMap(prev => ({ ...prev, [sessionId]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSend(sessionId);
                                    }
                                  }}
                                  placeholder="输入消息，Enter 发送..."
                                  rows={1}
                                  className="flex-1 px-3 py-2 rounded-lg text-xs text-white placeholder-gray-500 resize-none bg-white/5 border border-white/10 focus:border-blue-500/50 focus:outline-none transition-colors"
                                />
                                <button
                                  onClick={() => handleSend(sessionId)}
                                  disabled={!input.trim() || sending}
                                  className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30"
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right Nav Button */}
                    <button
                      onClick={() => setActiveConversations(prev => {
                        if (prev.length <= 1) return prev;
                        return [...prev.slice(1), prev[0]];
                      })}
                      className="absolute right-4 z-30 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-all shadow-lg"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Dots Indicator */}
                {activeConversations.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm">
                    {activeConversations.map((sessionId, idx) => (
                        <button
                          key={sessionId}
                          onClick={() => {
                            setActiveConversations(prev => {
                              const arr = prev.filter(id => id !== sessionId);
                              return [sessionId, ...arr];
                            });
                          }}
                          className={`transition-all rounded-full ${
                            idx === 0
                              ? 'w-8 h-3 bg-blue-500'
                              : 'w-2 h-2 bg-white/40 hover:bg-white/60'
                          }`}
                        />
                      ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Panel */}
          <Panel>
            <PanelHeader>
              <h2 className="text-sm font-medium text-white flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-500/25 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                结果展示
              </h2>
            </PanelHeader>

            <div className="flex gap-1.5 px-3 py-2 border-b border-white/5">
              {([
                { key: 'all', label: '全部', icon: FileText },
                { key: 'code', label: '代码', icon: Code },
                { key: 'results', label: '结果', icon: Terminal },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveResultTab(tab.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={
                    activeResultTab === tab.key
                      ? { background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd', boxShadow: '0 2px 10px rgba(59,130,246,0.1)' }
                      : { color: '#6b7280', border: '1px solid transparent' }
                  }
                >
                  <tab.icon className="w-3 h-3" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!latestAi ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center mb-3"
                    style={{ boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)' }}
                  >
                    <Terminal className="w-7 h-7 opacity-25" />
                  </div>
                  <p className="text-xs">对话结果将展示在这里</p>
                  <p className="text-[10px] text-gray-600 mt-1">AI 响应内容将格式化显示</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-xs">该分类下暂无内容</p>
                </div>
              ) : (
                filtered.map((part, i) =>
                  part.type === 'code' ? (
                    <div key={i} className="rounded-xl overflow-hidden"
                      style={{ background: 'rgba(22,27,34,0.95)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
                    >
                      <div className="flex items-center justify-between px-3 py-2 bg-white/3 border-b border-white/5">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{part.lang}</span>
                        <button className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="p-3 overflow-x-auto"><code className="text-[11px] font-mono text-gray-300 leading-relaxed">{part.content}</code></pre>
                    </div>
                  ) : (
                    <div key={i} className="rounded-xl p-3 bg-white/3 border border-white/6"
                      style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}
                    >
                      <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">{part.content}</p>
                    </div>
                  )
                )
              )}
            </div>

            {latestAi && (
              <div className="px-3 py-2 border-t border-white/5 bg-white/1">
                <p className="text-[10px] text-gray-600 text-center">
                  更新于 {new Date(latestAi.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
          </Panel>
        </ResizablePanels>
      </main>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}

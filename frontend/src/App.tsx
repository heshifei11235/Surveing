import { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, Send, MessageSquare, User, Code, FileText, Terminal, Copy, GripVertical, Play, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useOpenCode, type OpenCodeSession, type OpenCodeMessage, type StepInfo } from './hooks/useOpenCode';

// OpenCode server URL - change this to your OpenCode server address
const OPENCODE_BASE_URL = 'http://localhost:36000';
const OPENCODE_DIRECTORY = '/Users/heshifei/Desktop/project';

// ============ Task Input Component ============
function TaskInput({
  value,
  onChange,
  onStart,
  disabled
}: {
  value: string;
  onChange: (v: string) => void;
  onStart: () => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
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

      <button
        onClick={onStart}
        disabled={!value.trim() || disabled}
        className="w-full py-3 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
      >
        {disabled ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>连接中...</span>
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

// ============ Session List Component ============
function SessionList({
  sessions,
  selectedId,
  onSelect
}: {
  sessions: OpenCodeSession[];
  selectedId: string | null;
  onSelect: (s: OpenCodeSession) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">会话历史</div>
      {sessions.length === 0 ? (
        <div className="text-center py-4 text-gray-600 text-xs">暂无会话</div>
      ) : (
        sessions.map(s => (
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
              <span className="truncate font-medium">{s.title || `会话 #${s.id}`}</span>
            </div>
            <div className="text-gray-600 ml-3.5">OpenCode 会话</div>
          </button>
        ))
      )}
    </div>
  );
}

// ============ Message Bubble ============
function MessageBubble({ msg }: { msg: OpenCodeMessage }) {
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
function TypingIndicator({ step }: { step?: StepInfo }) {
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10">
        {step ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs text-blue-300">{step.step}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {[0, 150, 300].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-blue-400"
                style={{ animation: `bounce 1s infinite`, animationDelay: `${i}ms` }}
              />
            ))}
          </div>
        )}
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
  const [taskTitle, setTaskTitle] = useState('');
  const [activeConversations, setActiveConversations] = useState<string[]>([]);

  // Use OpenCode hook directly
  const {
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
    sendMessage,
  } = useOpenCode({
    baseUrl: OPENCODE_BASE_URL,
    directory: OPENCODE_DIRECTORY,
  });

  // Load sessions on mount
  useEffect(() => {
    if (initialized) {
      loadSessions();
    }
  }, [initialized, loadSessions]);

  // Handle start survey
  const handleStartSurvey = useCallback(async () => {
    if (!taskTitle.trim() || !initialized) return;

    const session = await createSession(taskTitle);
    if (session) {
      setActiveConversations(prev => [session.id, ...prev.filter(id => id !== session.id)]);
      setTaskTitle('');
    }
  }, [taskTitle, initialized, createSession]);

  // Handle send message
  const handleSend = useCallback(async (_sessionId: string, content: string) => {
    if (!content.trim() || sending) return;
    await sendMessage(content);
  }, [sending, sendMessage]);

  // Input state per session
  const [inputMap, setInputMap] = useState<Record<string, string>>({});

  // Result tab
  const [activeResultTab, setActiveResultTab] = useState<'all' | 'code' | 'results'>('all');

  // Get latest AI message for result panel
  const latestAi = messages.filter(m => m.role === 'assistant').pop();

  // Parse content for result display
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

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-500/20 border-b border-red-500/30 text-xs text-red-300">
          {error}
        </div>
      )}

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
              <TaskInput
                value={taskTitle}
                onChange={setTaskTitle}
                onStart={handleStartSurvey}
                disabled={!initialized}
              />

              <SessionList
                sessions={sessions}
                selectedId={currentSession}
                onSelect={(s) => {
                  selectSession(s.id);
                  setActiveConversations(prev => [s.id, ...prev.filter(id => id !== s.id)]);
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
                <div className="h-full flex items-center justify-center perspective-1000">
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Left Nav */}
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
                        const session = sessions.find(s => s.id === sessionId);
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
                                <h3 className="text-xs font-medium text-white truncate">{session?.title || `会话 #${sessionId}`}</h3>
                                <p className="text-[9px] text-gray-500 flex items-center gap-1">
                                  OpenCode 会话
                                  {step && isCenter && (
                                    <span className="text-blue-400 ml-1">• {step.step}</span>
                                  )}
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
                              {sending && isCenter && <TypingIndicator step={step || undefined} />}
                            </div>

                            {/* Input */}
                            <div className="px-4 py-2.5 border-t border-white/10"
                              style={{ background: 'linear-gradient(0deg, rgba(255,255,255,0.02) 0%, transparent 100%)' }}
                            >
                              <div className="flex items-center gap-2">
                                <textarea
                                  value={inputMap[sessionId] || ''}
                                  onChange={(e) => setInputMap(prev => ({ ...prev, [sessionId]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSend(sessionId, inputMap[sessionId] || '');
                                      setInputMap(prev => ({ ...prev, [sessionId]: '' }));
                                    }
                                  }}
                                  placeholder="输入消息，Enter 发送..."
                                  rows={1}
                                  className="flex-1 px-3 py-2 rounded-lg text-xs text-white placeholder-gray-500 resize-none bg-white/5 border border-white/10 focus:border-blue-500/50 focus:outline-none transition-colors"
                                />
                                <button
                                  onClick={() => {
                                    handleSend(sessionId, inputMap[sessionId] || '');
                                    setInputMap(prev => ({ ...prev, [sessionId]: '' }));
                                  }}
                                  disabled={!inputMap[sessionId]?.trim() || sending}
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

                    {/* Right Nav */}
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
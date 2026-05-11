import { useState, useEffect } from 'react';
import { Plus, Trash2, MessageSquare, Calendar, ChevronRight } from 'lucide-react';
import type { Task, Session } from '../types';

interface TaskPanelProps {
  onTaskSelect: (task: Task, session: Session | null) => void;
  selectedTaskId: number | null;
  selectedSessionId: number | null;
}

export default function TaskPanel({ onTaskSelect, selectedTaskId, selectedSessionId }: TaskPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [taskSessions, setTaskSessions] = useState<Record<number, Session[]>>({});

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks/');
      const data = await response.json();
      setTasks(data);
      // Fetch sessions for each task
      data.forEach((task: Task) => fetchSessions(task.id));
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  const fetchSessions = async (taskId: number) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/sessions`);
      const sessions = await response.json();
      setTaskSessions(prev => ({ ...prev, [taskId]: sessions }));
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/tasks/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      const newTask = await response.json();
      setTasks(prev => [newTask, ...prev]);
      setTaskSessions(prev => ({ ...prev, [newTask.id]: [] }));
      setTitle('');
      setDescription('');
      setShowForm(false);
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this task and all its sessions?')) return;

    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (selectedTaskId === taskId) {
        onTaskSelect(tasks[0] || {} as Task, null);
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleStartConversation = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await fetch(`/api/tasks/${task.id}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const newSession = await response.json();
      setTaskSessions(prev => ({
        ...prev,
        [task.id]: [newSession, ...(prev[task.id] || [])]
      }));
      onTaskSelect(task, newSession);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleSelectSession = (task: Task, session: Session) => {
    onTaskSelect(task, session);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col glass rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary-400" />
            任务中心
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="p-1.5 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Create Task Form */}
        {showForm && (
          <form onSubmit={handleCreateTask} className="space-y-2 mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="任务标题..."
              className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-primary-500/50 focus:bg-white/10 transition-all"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="任务描述（可选）..."
              rows={2}
              className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-primary-500/50 focus:bg-white/10 transition-all resize-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="flex-1 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? '创建中...' : '创建'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs hover:bg-white/10 transition-all"
              >
                取消
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">暂无任务</p>
            <p className="text-[10px] mt-0.5">点击 + 创建</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id}>
              {/* Task Item */}
              <div
                onClick={() => {
                  const sessions = taskSessions[task.id] || [];
                  onTaskSelect(task, sessions[0] || null);
                }}
                className={`p-2.5 rounded-lg cursor-pointer transition-all group ${
                  selectedTaskId === task.id
                    ? 'bg-primary-500/20 border border-primary-500/30'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-xs font-medium truncate ${
                      selectedTaskId === task.id ? 'text-primary-300' : 'text-white'
                    }`}>
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-600 flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {formatDate(task.created_at)}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {(taskSessions[task.id] || []).length} 会话
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleStartConversation(task, e)}
                      className="p-1 rounded bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-all"
                      title="开始新对话"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteTask(task.id, e)}
                      className="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sessions List */}
              {selectedTaskId === task.id && (taskSessions[task.id] || []).length > 0 && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                  {(taskSessions[task.id] || []).map((session) => (
                    <div
                      key={session.id}
                      onClick={() => handleSelectSession(task, session)}
                      className={`p-1.5 rounded cursor-pointer transition-all flex items-center gap-1.5 ${
                        selectedSessionId === session.id
                          ? 'bg-primary-500/15 text-primary-300'
                          : 'text-gray-500 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <ChevronRight className="w-2.5 h-2.5 flex-shrink-0" />
                      <span className="text-[10px] truncate">
                        #{session.id} · {formatDate(session.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

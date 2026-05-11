import { useState } from 'react';
import { Code, FileText, Terminal, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import type { Message } from '../types';

interface ResultPanelProps {
  messages: Message[];
}

interface ParsedContent {
  type: 'text' | 'code' | 'result' | 'error';
  content: string;
  language?: string;
}

export default function ResultPanel({ messages }: ResultPanelProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'code' | 'results'>('all');

  const parseContent = (content: string): ParsedContent[] => {
    const sections: ParsedContent[] = [];

    // Try to parse code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        sections.push({
          type: 'text',
          content: content.slice(lastIndex, match.index).trim(),
        });
      }

      sections.push({
        type: 'code',
        language: match[1] || 'plaintext',
        content: match[2].trim(),
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      const remaining = content.slice(lastIndex).trim();
      if (remaining) {
        sections.push({
          type: 'text',
          content: remaining,
        });
      }
    }

    // If no sections were found, treat as plain text
    if (sections.length === 0 && content.trim()) {
      sections.push({
        type: 'text',
        content: content.trim(),
      });
    }

    return sections;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const latestAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
  const parsedSections = latestAssistantMessage ? parseContent(latestAssistantMessage.content) : [];

  const filteredSections = parsedSections.filter(section => {
    if (activeTab === 'all') return true;
    if (activeTab === 'code') return section.type === 'code';
    if (activeTab === 'results') return section.type === 'result' || section.type === 'error';
    return true;
  });

  if (!latestAssistantMessage) {
    return (
      <div className="h-full flex flex-col glass rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-400" />
            结果展示
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-400" />
            </div>
            <p className="text-gray-400 text-sm">对话结果将在这里展示</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col glass rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-primary-400" />
          结果展示
        </h2>

        {/* Tabs */}
        <div className="flex gap-1.5">
          {[
            { key: 'all', label: '全部', icon: FileText },
            { key: 'code', label: '代码', icon: Code },
            { key: 'results', label: '结果', icon: Terminal },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === key
                  ? 'bg-primary-500/20 text-primary-300'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredSections.map((section, index) => {
          if (section.type === 'code') {
            return (
              <div key={index} className="rounded-lg bg-dark-400 border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10">
                  <div className="flex items-center gap-1.5">
                    <Code className="w-3 h-3 text-primary-400" />
                    <span className="text-[10px] font-medium text-gray-400 uppercase">
                      {section.language}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(section.content)}
                    className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                    title="复制"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <pre className="p-3 overflow-x-auto">
                  <code className="text-xs font-mono text-gray-300">{section.content}</code>
                </pre>
              </div>
            );
          }

          if (section.type === 'result') {
            return (
              <div key={index} className="rounded-lg bg-green-500/10 border border-green-500/20 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border-b border-green-500/20">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] font-medium text-green-400">执行结果</span>
                </div>
                <pre className="p-3 overflow-x-auto">
                  <code className="text-xs font-mono text-green-300">{section.content}</code>
                </pre>
              </div>
            );
          }

          if (section.type === 'error') {
            return (
              <div key={index} className="rounded-lg bg-red-500/10 border border-red-500/20 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border-b border-red-500/20">
                  <AlertCircle className="w-3 h-3 text-red-400" />
                  <span className="text-[10px] font-medium text-red-400">错误</span>
                </div>
                <pre className="p-3 overflow-x-auto">
                  <code className="text-xs font-mono text-red-300">{section.content}</code>
                </pre>
              </div>
            );
          }

          // Text content
          return (
            <div key={index} className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                {section.content}
              </p>
            </div>
          );
        })}

        {filteredSections.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <p className="text-xs">该分类下没有内容</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-white/10">
        <p className="text-[10px] text-gray-600 text-center">
          更新: {new Date(latestAssistantMessage.created_at).toLocaleString('zh-CN')}
        </p>
      </div>
    </div>
  );
}

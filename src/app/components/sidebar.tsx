'use client';

import { AlertCircle, Loader2, Menu, MessageSquare, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Chat {
  id: string;
  title: string;
  updatedAt: string;
}

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  isLoading?: boolean;
  deletingChatId?: string | null;
  error?: string | null;
  onRetry?: () => void;
}

export function Sidebar({
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  isLoading = false,
  deletingChatId = null,
  error = null,
  onRetry,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const sidebarContent = (
    <>
      <div className="flex items-center justify-end border-b border-neutral-800 p-4">
        <button
          onClick={() => {
            onNewChat();
            setIsOpen(false);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-700 transition-colors hover:bg-neutral-800"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {error ? (
          // Error state
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-neutral-400">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 rounded-lg bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            )}
          </div>
        ) : isLoading ? (
          // Skeleton loading
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2">
              <div className="h-4 w-4 animate-pulse rounded bg-neutral-700" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-700" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-700" />
              </div>
            </div>
          ))
        ) : chats.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <MessageSquare className="h-8 w-8 text-neutral-600" />
            <p className="text-sm text-neutral-500">No chats yet</p>
            <p className="text-xs text-neutral-600">Click + to start a new conversation</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={cn(
                'group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-neutral-800',
                activeChatId === chat.id && 'bg-neutral-800',
                deletingChatId === chat.id && 'opacity-50 pointer-events-none'
              )}
              onClick={() => {
                onSelectChat(chat.id);
                setIsOpen(false);
              }}
            >
              <span className="text-neutral-500">*</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-200">{chat.title}</p>
                <p className="text-xs text-neutral-500">{formatTime(chat.updatedAt)}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
                disabled={deletingChatId === chat.id}
                className="rounded p-1 opacity-0 transition-opacity hover:bg-neutral-700 group-hover:opacity-100 disabled:opacity-100"
              >
                {deletingChatId === chat.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 text-neutral-400" />
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-50 rounded-lg border border-neutral-700 bg-neutral-900 p-1 md:hidden"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setIsOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r border-neutral-800 bg-neutral-900 transition-transform md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

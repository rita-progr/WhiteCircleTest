'use client';

import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Chat } from './components/chat';
import { Sidebar } from './components/sidebar';
import type { UIMessage } from 'ai';

interface ChatItem {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatWithMessages extends ChatItem {
  messages: Array<{
    id: string;
    role: string;
    content: string;
  }>;
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
});

export default function Home() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Restore activeChatId from localStorage after hydration
  useEffect(() => {
    const savedChatId = localStorage.getItem('activeChatId');
    if (savedChatId) {
      setActiveChatId(savedChatId);
    }
    setIsHydrated(true);
  }, []);

  // SWR for chat list - cached and revalidated automatically
  const {
    data: chats = [],
    error: chatsError,
    isLoading: isLoadingChats,
  } = useSWR<ChatItem[]>('/api/chats', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

  // SWR for active chat messages
  const {
    data: activeChat,
    error: messagesError,
    isLoading: isLoadingMessages,
  } = useSWR<ChatWithMessages>(
    activeChatId ? `/api/chats/${activeChatId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  // Update initialMessages when activeChat changes
  useEffect(() => {
    if (activeChat?.messages) {
      const uiMessages: UIMessage[] = activeChat.messages.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        parts: [{ type: 'text' as const, text: msg.content }],
        createdAt: new Date(),
      }));
      setInitialMessages(uiMessages);
    }
  }, [activeChat]);

  // Save activeChatId to localStorage
  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem('activeChatId', activeChatId);
    } else {
      localStorage.removeItem('activeChatId');
    }
  }, [activeChatId]);

  // Clear activeChatId if chat no longer exists
  useEffect(() => {
    if (!isLoadingChats && activeChatId && chats.length > 0) {
      const chatExists = chats.some((c) => c.id === activeChatId);
      if (!chatExists) {
        setActiveChatId(null);
        setInitialMessages([]);
      }
    }
  }, [isLoadingChats, chats, activeChatId]);

  const handleNewChat = async () => {
    try {
      const res = await fetch('/api/chats', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create chat');
      const newChat = await res.json();
      // Optimistically update cache
      mutate('/api/chats', [newChat, ...chats], false);
      setActiveChatId(newChat.id);
      setInitialMessages([]);
      return newChat.id;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const handleCreateChat = async (): Promise<string> => {
    const res = await fetch('/api/chats', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to create chat');
    const newChat = await res.json();
    mutate('/api/chats', [newChat, ...chats], false);
    setInitialMessages([]);
    setActiveChatId(newChat.id);
    return newChat.id;
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
  };

  const handleDeleteChat = async (id: string) => {
    setDeletingChatId(id);
    try {
      const res = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete chat');
      // Optimistically update cache
      mutate('/api/chats', chats.filter((c) => c.id !== id), false);
      if (activeChatId === id) {
        setActiveChatId(null);
        setInitialMessages([]);
      }
    } catch (err) {
      console.error(err);
      // Revalidate on error
      mutate('/api/chats');
    } finally {
      setDeletingChatId(null);
    }
  };

  const handleMessageSent = () => {
    // Revalidate chats to update titles
    setTimeout(() => mutate('/api/chats'), 2000);
  };

  const error = chatsError?.message || messagesError?.message || null;

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        isLoading={isLoadingChats}
        deletingChatId={deletingChatId}
        error={error}
        onRetry={() => mutate('/api/chats')}
      />
      <Chat
        key={activeChatId ?? 'new'}
        chatId={activeChatId}
        initialMessages={initialMessages}
        onMessageSent={handleMessageSent}
        onCreateChat={handleCreateChat}
        isLoadingMessages={isLoadingMessages}
      />
    </div>
  );
}

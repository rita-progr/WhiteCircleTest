'use client';

import { useCallback, useEffect, useState } from 'react';
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

export default function Home() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  const loadChats = useCallback(async () => {
    setIsLoadingChats(true);
    setError(null);
    try {
      const res = await fetch('/api/chats');
      if (!res.ok) throw new Error('Failed to load chats');
      const data = await res.json();
      setChats(data);
    } catch (err) {
      setError('Failed to load chats. Please try again.');
      console.error(err);
    } finally {
      setIsLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const handleNewChat = async () => {
    setError(null);
    try {
      const res = await fetch('/api/chats', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create chat');
      const newChat = await res.json();
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(newChat.id);
      setInitialMessages([]);
      return newChat.id;
    } catch (err) {
      setError('Failed to create chat. Please try again.');
      console.error(err);
      return null;
    }
  };

  const handleCreateChat = async (): Promise<string> => {
    setError(null);
    try {
      const res = await fetch('/api/chats', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create chat');
      const newChat = await res.json();
      setChats((prev) => [newChat, ...prev]);
      setInitialMessages([]);
      setActiveChatId(newChat.id);
      return newChat.id;
    } catch (err) {
      setError('Failed to create chat. Please try again.');
      console.error(err);
      throw err;
    }
  };

  const handleSelectChat = async (id: string) => {
    setActiveChatId(id);
    setIsLoadingMessages(true);
    setError(null);
    try {
      const res = await fetch(`/api/chats/${id}`);
      if (!res.ok) throw new Error('Failed to load messages');
      const chat: ChatWithMessages = await res.json();

      const uiMessages: UIMessage[] = chat.messages.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        parts: [{ type: 'text' as const, text: msg.content }],
        createdAt: new Date(),
      }));

      setInitialMessages(uiMessages);
    } catch (err) {
      setError('Failed to load messages. Please try again.');
      console.error(err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleDeleteChat = async (id: string) => {
    setDeletingChatId(id);
    setError(null);
    try {
      const res = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete chat');
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
        setInitialMessages([]);
      }
    } catch (err) {
      setError('Failed to delete chat. Please try again.');
      console.error(err);
    } finally {
      setDeletingChatId(null);
    }
  };

  const handleMessageSent = () => {
    setTimeout(loadChats, 2000);
  };

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
        onRetry={loadChats}
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

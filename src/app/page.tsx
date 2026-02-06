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

  const loadChats = useCallback(async () => {
    setIsLoadingChats(true);
    const res = await fetch('/api/chats');
    const data = await res.json();
    setChats(data);
    setIsLoadingChats(false);
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const handleNewChat = async () => {
    const res = await fetch('/api/chats', { method: 'POST' });
    const newChat = await res.json();
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setInitialMessages([]);
    return newChat.id;
  };

  const handleCreateChat = async (): Promise<string> => {
    const res = await fetch('/api/chats', { method: 'POST' });
    const newChat = await res.json();
    setChats((prev) => [newChat, ...prev]);
    setInitialMessages([]);
    setActiveChatId(newChat.id);
    return newChat.id;
  };

  const handleSelectChat = async (id: string) => {
    setActiveChatId(id);
    setIsLoadingMessages(true);
    const res = await fetch(`/api/chats/${id}`);
    const chat: ChatWithMessages = await res.json();

    const uiMessages: UIMessage[] = chat.messages.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: msg.content }],
      createdAt: new Date(),
    }));

    setInitialMessages(uiMessages);
    setIsLoadingMessages(false);
  };

  const handleDeleteChat = async (id: string) => {
    await fetch(`/api/chats/${id}`, { method: 'DELETE' });
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) {
      setActiveChatId(null);
      setInitialMessages([]);
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

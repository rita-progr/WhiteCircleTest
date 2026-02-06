'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { AlertCircle, ArrowUp, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { UIMessage } from 'ai';
import { ChatMessage } from './chat-message';

interface ChatProps {
  chatId: string | null;
  initialMessages?: UIMessage[];
  onMessageSent?: () => void;
  onCreateChat?: () => Promise<string>;
  isLoadingMessages?: boolean;
}

export function Chat({ chatId, initialMessages = [], onMessageSent, onCreateChat, isLoadingMessages = false }: ChatProps) {
  const [input, setInput] = useState('');
  const [localChatId, setLocalChatId] = useState<string | null>(chatId);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const pendingMessageRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync localChatId with prop
  useEffect(() => {
    setLocalChatId(chatId);
  }, [chatId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { chatId: localChatId },
      }),
    [localChatId]
  );

  const { messages, sendMessage, status, setMessages, error: chatError } = useChat({
    id: localChatId ?? 'new-chat',
    transport,
  });

  // Handle chat errors
  useEffect(() => {
    if (chatError) {
      setSendError('Failed to send message. Please try again.');
    }
  }, [chatError]);

  // Set initial messages when initialMessages change
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, setMessages]);

  // Auto-scroll to new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send pending message after chat is created
  useEffect(() => {
    if (localChatId && pendingMessageRef.current && !isCreatingChat) {
      const message = pendingMessageRef.current;
      pendingMessageRef.current = null;
      sendMessage({ text: message });
      onMessageSent?.();
    }
  }, [localChatId, isCreatingChat, sendMessage, onMessageSent]);

  const isLoading = status === 'streaming' || status === 'submitted' || isCreatingChat;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const messageText = input;
    setInput('');
    setSendError(null);
    setLastFailedMessage(null);

    if (!localChatId && onCreateChat) {
      setIsCreatingChat(true);
      pendingMessageRef.current = messageText;
      try {
        const newChatId = await onCreateChat();
        setLocalChatId(newChatId);
      } catch {
        setSendError('Failed to create chat. Please try again.');
        setLastFailedMessage(messageText);
        setInput(messageText);
      } finally {
        setIsCreatingChat(false);
      }
      return;
    }

    if (!localChatId) return;

    try {
      setLastFailedMessage(messageText);
      await sendMessage({ text: messageText });
      setLastFailedMessage(null);
      onMessageSent?.();
    } catch {
      setSendError('Failed to send message. Please try again.');
      setInput(messageText);
    }
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      setInput(lastFailedMessage);
      setSendError(null);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-neutral-950 md:ml-64">
      <div className="flex-1 overflow-y-auto p-4 pt-16 md:pt-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center pt-32">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
            </div>
          ) : messages.length === 0 ? (
            <p className="pt-32 text-center text-neutral-500">Start a new conversation</p>
          ) : null}
          {!isLoadingMessages && messages.map((message, index) => {
            const messageContent = message.parts
              .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
              .map((part) => part.text)
              .join('');

            // Check if this is the last assistant message and still streaming
            const isLastAssistantMessage =
              message.role === 'assistant' &&
              index === messages.length - 1;
            const isMessageStreaming = isLastAssistantMessage && status === 'streaming';

            return (
              <div
                key={`${message.id}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.role === 'user' ? 'bg-neutral-800' : 'bg-neutral-900'
                  }`}
                >
                  <ChatMessage
                    content={messageContent}
                    role={message.role as 'user' | 'assistant'}
                    isStreaming={isMessageStreaming}
                  />
                </div>
              </div>
            );
          })}
          {status === 'submitted' && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-neutral-900 px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-500 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-500 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-500" />
                </div>
                <span className="text-sm text-neutral-500">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4">
        {sendError && (
          <div className="mx-auto mb-3 flex max-w-2xl items-center justify-between rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {sendError}
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="flex items-center gap-1 rounded bg-red-800/50 px-2 py-1 text-xs transition-colors hover:bg-red-800"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-700 transition-colors hover:bg-neutral-600 disabled:opacity-50"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

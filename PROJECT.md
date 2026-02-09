# WhiteCircleTestProj — Project Documentation

AI chat app (Next.js 14) with Claude integration and multi-layer PII detection. Privacy-focused — automatically detects and blurs sensitive data in AI responses.

## Tech Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript 5
- **Styling:** Tailwind CSS 3.4 + Radix UI + Lucide Icons
- **AI:** Anthropic Claude (Sonnet 4 — chat, Haiku — PII detection) via Vercel AI SDK
- **DB:** PostgreSQL (Supabase) via Prisma 6.19
- **Caching:** SWR (stale-while-revalidate)
- **PII blur:** `spoiled` library
- **Validation:** Zod 4.3

---

## Project Structure

```
WhiteCircleTestProj/
├── prisma/
│   ├── migrations/20260206113820_init/migration.sql
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts
│   │   │   ├── chats/route.ts
│   │   │   ├── chats/[id]/route.ts
│   │   │   └── detect-pii/route.ts
│   │   ├── components/
│   │   │   ├── chat.tsx
│   │   │   ├── chat-message.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── spoiler.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── lib/
│       ├── detect-pii-server.ts
│       ├── prisma.ts
│       ├── pii-patterns.ts
│       └── utils.ts
├── .env
├── .eslintrc.json
├── .prettierrc
├── CLAUDE.md
├── next.config.mjs
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## DB Schema (Prisma)

**Chat:** `id` (cuid), `title` (default "New Chat"), `createdAt`, `updatedAt`, `messages[]`
**Message:** `id` (cuid), `chatId`, `role`, `content`, `piiItems` (Json, default `[]`), `createdAt`; `@@index([chatId])`
Cascade delete: удаление чата удаляет все сообщения (`onDelete: Cascade`).

---

## How Each Part is Implemented

### 1. Home Page — `src/app/page.tsx`

**Orchestrator** всего приложения. Client component (`'use client'`).

**State:**
- `activeChatId` — ID выбранного чата (`useState`, восстанавливается из `localStorage`)
- `initialMessages` — сообщения для передачи в Chat компонент
- `deletingChatId` — ID чата в процессе удаления (для UI блокировки)

**Data fetching (SWR):**
- `useSWR('/api/chats')` — список чатов. Параметры: `revalidateOnFocus: false`, `dedupingInterval: 5000`
- `useSWR('/api/chats/${activeChatId}')` — сообщения активного чата (conditional — запрос только когда есть `activeChatId`)

**Ключевые функции:**
- `handleNewChat()` — POST `/api/chats`, оптимистично обновляет SWR кэш через `mutate('/api/chats', [newChat, ...chats], false)`, ставит новый чат активным
- `handleCreateChat()` — аналогично, но возвращает `Promise<string>` для использования в Chat компоненте (когда пользователь пишет без созданного чата)
- `handleSelectChat(id)` — устанавливает `activeChatId`
- `handleDeleteChat(id)` — DELETE `/api/chats/${id}`, оптимистично удаляет из кэша. При ошибке — `mutate('/api/chats')` для ревалидации
- `handleMessageSent()` — через `setTimeout` (2 сек) ревалидирует список чатов, чтобы обновить title после автогенерации

**Эффекты:**
- Восстановление `activeChatId` из localStorage при монтировании
- Синхронизация `activeChatId` в localStorage при изменении
- Конвертация `activeChat.messages` в формат `UIMessage[]` для AI SDK
- Очистка `activeChatId` если чат удалён (не найден в списке)

---

### 2. Chat Component — `src/app/components/chat.tsx`

**Основной UI чата.** Streaming, отправка, auto-scroll, error handling.

**State:**
- `input` — текст в поле ввода
- `localChatId` — локальная копия chatId (синхронизируется с prop)
- `isCreatingChat` — флаг создания нового чата
- `sendError` / `lastFailedMessage` — для retry механизма
- `pendingMessageRef` — ref для отложенной отправки (когда чат ещё создаётся)

**AI SDK интеграция:**
- `DefaultChatTransport` — транспорт для `/api/chat`, пересоздаётся через `useMemo` при смене `localChatId`
- `useChat()` — хук AI SDK. Возвращает `messages`, `sendMessage`, `status`, `setMessages`, `error`
- `status` значения: `'streaming'` | `'submitted'` | idle

**Механизм отправки (`handleSubmit`):**
1. Если нет `localChatId` → вызывает `onCreateChat()`, сохраняет сообщение в `pendingMessageRef`
2. Когда `localChatId` появляется и `pendingMessageRef` не пуст → useEffect автоматически отправляет
3. Если есть `localChatId` → сразу `sendMessage({ text })`
4. При ошибке — восстанавливает текст в input, показывает ошибку с кнопкой Retry

**UI:**
- Auto-scroll через `messagesEndRef.scrollIntoView({ behavior: 'smooth' })`
- Thinking indicator: 3 bouncing dots при `status === 'submitted'`
- Loading skeleton при `isLoadingMessages`
- Для каждого message определяет `isStreaming` (последнее assistant-сообщение + `status === 'streaming'`)

---

### 3. ChatMessage Component — `src/app/components/chat-message.tsx`

**Рендер одного сообщения с 3-слойной PII-защитой.** Обёрнут в `React.memo` — при стриминге нового сообщения старые N-1 сообщений не перерендериваются.

**Props:** `content: string`, `role: 'user' | 'assistant'`, `piiItems?: string[]`

**PII Detection Pipeline (только для assistant сообщений):**

1. **Layer 1 — LLM tags (`parsePIITags`):**
   - Парсит `<pii>...</pii>` теги из ответа Claude
   - Regex: `/<pii>([\s\S]*?)<\/pii>/g`
   - Разбивает текст на `TextSegment[]` (`{type: 'text'|'pii', content}`)

2. **Layer 2 — Regex fallback (`applyRegexFallback`):**
   - Для каждого `text`-сегмента (не помеченного как PII) запускает `detectPIIInstant()`
   - Если находит PII — дробит сегмент через `splitTextWithPII()`
   - PII-сегменты из Layer 1 пропускает без изменений

3. **Layer 3 — Server PII (`applyAsyncPii` с `piiItems` из props):**
   - Получает `piiItems: string[]` из БД (детектировано на сервере при сохранении)
   - Для каждого `text`-сегмента ищет вхождения PII-строк
   - Если находит — разбивает сегмент: ищет самое раннее вхождение, ставит `text` до него, `pii` на него, и продолжает с остатком
   - Для новых стримящихся сообщений `piiItems` ещё нет — работают только Layer 1-2

**Рендер:**
- User messages — просто `<p>` с контентом, PII не сканируется
- Assistant messages — `segments.map()`: `pii`-сегменты оборачиваются в `<Spoiler>`, `text`-сегменты — в `<span>`
- **Stable keys:** ключи Spoiler основаны на содержимом PII + счётчик дубликатов (`pii-${content}-${count}`), не на индексе массива — React переиспользует DOM вместо remount

---

### 4. Spoiler Component — `src/app/components/spoiler.tsx`

Обёртка над библиотекой `spoiled`. Обёрнута в `React.memo` — не перерендеривается если children не изменились. Параметры:
- `theme="dark"` — тёмная тема blur-эффекта
- `fps={15}` — частота обновления анимации (снижена с 30 для производительности)
- `density={0.12}` — плотность blur-эффекта (снижена с 0.15 для производительности)

Пользователь кликает на spoiler чтобы раскрыть текст.

---

### 5. Sidebar Component — `src/app/components/sidebar.tsx`

**Список чатов, CRUD, адаптивность.**

**Props:** `chats`, `activeChatId`, `onNewChat`, `onSelectChat`, `onDeleteChat`, `isLoading`, `deletingChatId`, `error`, `onRetry`

**`formatTime(date)`** — относительные timestamps:
- < 1 мин → "now"
- < 60 мин → "N min"
- < 24 часов → "Nh"
- вчера → "Yesterday"
- < 7 дней → день недели (short)
- иначе → "Mon D" формат

**Адаптивность:**
- Mobile: `isOpen` state, hamburger меню (`<Menu>`/`<X>` toggle), overlay `bg-black/50`
- Desktop: `md:translate-x-0` — sidebar всегда видна, `fixed left-0 w-64`

**UI states:** loading skeleton (5 placeholder строк), error с retry, empty state, список чатов.
**Deleting:** `deletingChatId` — показывает spinner вместо trash icon, `opacity-50 pointer-events-none`.

---

### 6. API: POST /api/chat — `src/app/api/chat/route.ts`

**Streaming ответ Claude + сохранение в БД.**

**Модель:** `claude-sonnet-4-20250514`

**Flow:**
1. Получает `messages: UIMessage[]` и `chatId?: string`
2. `convertToModelMessages(messages)` — конвертация AI SDK формата
3. `streamText()` — стриминг ответа Claude
4. `onFinish` callback:
   - Извлекает текст user-сообщения из `message.parts`
   - Извлекает текст assistant-ответа из `response.messages`
   - `prisma.message.createMany()` — сохраняет оба сообщения
   - `prisma.chat.update()` — обновляет `updatedAt`
   - Если первое сообщение (`isFirstMessage`) → `generateText()` с prompt для генерации title (5-7 слов), обновляет `chat.title`
5. Возвращает `result.toUIMessageStreamResponse()`

---

### 7. API: GET/POST /api/chats — `src/app/api/chats/route.ts`

- **GET:** `prisma.chat.findMany()` — все чаты, отсортированы по `updatedAt DESC`, select: `id, title, createdAt, updatedAt`
- **POST:** `prisma.chat.create({ data: { title: 'New Chat' } })` — создаёт пустой чат

---

### 8. API: GET/DELETE /api/chats/[id] — `src/app/api/chats/[id]/route.ts`

- **GET:** `prisma.chat.findUnique()` с `include: { messages: { orderBy: { createdAt: 'asc' } } }`. 404 если не найден.
- **DELETE:** `prisma.chat.delete()` — cascade удаляет все messages.

Params получаются как `Promise<{ id: string }>` (Next.js 14 async params).

---

### 9. API: POST /api/detect-pii — `src/app/api/detect-pii/route.ts`

**Async PII detection через Claude Haiku.**

**Модель:** `claude-3-haiku-20240307`

**Flow:**
1. Получает `{ text: string }`
2. Prompt: "Analyze text, extract ALL PII, return JSON array `[{text, type}]`"
   - Types: `name | email | phone | address`
   - Примеры в prompt для лучшего качества
3. `generateText()` → парсит JSON из ответа
4. **Fallback парсинг:** если `JSON.parse()` упал — regex `\[[\s\S]*\]` для извлечения массива из текста
5. Возвращает `{ piiItems, debug }`. При ошибке — `{ piiItems: [], error }`

---

### 10. Regex PII Detection — `src/lib/pii-patterns.ts`

**Синхронное определение PII по regex. Без API, без задержек.**

**Паттерны (PII_PATTERNS):**
- Email: `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`
- Phone (international): `\+\d{1,3}[-.\s]?\(?\d{2,4}\)?...`
- Phone (US): `\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}`
- SSN: `\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b`
- Credit card: `\b(?:\d{4}[-\s]?){3}\d{4}\b`
- IPv4: `\b(?:\d{1,3}\.){3}\d{1,3}\b`
- IPv6: 7 вариантов regex для разных форматов (full, abbreviated, с zone ID)

**`detectPIIInstant(text)`:**
- Проходит все паттерны, находит все matches
- Проверяет overlap с уже найденными ranges — дубликаты пропускает
- Сортирует по `start` позиции
- Возвращает `PIIMatch[]` (`{start, end, type, text}`)

**`splitTextWithPII(text, piiItems)`:**
- Принимает текст и найденные PII
- Последовательно проходит по sorted PII: добавляет `text`-сегмент до PII, потом `pii`-сегмент
- Добавляет остаток текста в конце
- Возвращает `TextSegment[]` (`{type: 'text'|'pii', content, piiType?}`)

---

### 11. Server-side PII Detection — `src/lib/detect-pii-server.ts`

**Серверная PII-детекция, вызывается один раз при сохранении сообщения.**

**`detectPIIServer(text: string): Promise<string[]>`:**
1. **Regex layer:** вызывает `detectPIIInstant()` — мгновенно ловит email, phone, SSN, credit card, IP
2. **Haiku layer:** вызывает Claude Haiku — семантически находит имена, адреса
3. Объединяет результаты, дедуплицирует
4. Возвращает `string[]` — массив найденных PII-текстов

**Где вызывается:**
- В `onFinish` callback `POST /api/chat` — после завершения стрима Claude
- Результат сохраняется в `Message.piiItems` (Json поле в БД)
- Клиент получает `piiItems` вместе с сообщением при загрузке чата — 0 API вызовов для PII

**Отличие от предыдущей архитектуры:**
- Раньше: каждый клиент отдельно вызывал `/api/detect-pii` для каждого сообщения
- Теперь: PII детектится ОДИН РАЗ на сервере при создании сообщения, результат хранится в БД навсегда

---

### 12. Prisma Singleton — `src/lib/prisma.ts`

Стандартный паттерн для Next.js dev mode:
- В dev mode Next.js hot-reload создаёт новые экземпляры PrismaClient
- Singleton сохраняет клиент в `globalThis` чтобы избежать утечки соединений
- В production — создаётся один экземпляр

---

## State Management Summary

| Что | Где | Как |
|-----|-----|-----|
| Chat list | `page.tsx` | SWR + optimistic `mutate()` |
| Active chat messages | `page.tsx` | SWR (conditional) |
| Active chat ID | `page.tsx` | `useState` + `localStorage` |
| Streaming messages | `chat.tsx` | `useChat()` (AI SDK) |
| Input text | `chat.tsx` | `useState` |
| PII results (server) | `page.tsx` → `chat.tsx` → `chat-message.tsx` | `piiItemsMap` from SWR data |
| PII results (regex) | `chat-message.tsx` | `useMemo` (synchronous) |
| Sidebar open/close | `sidebar.tsx` | `useState` |
| Deleting chat UI | `page.tsx` | `useState` (deletingChatId) |

---

## Scripts

```bash
npm run dev        # next dev
npm run build      # prisma generate && next build
npm run lint:fix   # next lint --fix
npm run format     # prettier --write .
```

## Environment Variables

- `ANTHROPIC_API_KEY` — Claude API key
- `DATABASE_URL` — Supabase connection pool URL
- `DIRECT_URL` — Supabase direct connection URL


# 14 core front-end system design concepts
### 1) Rendering strategies

**Static Site Generation (SSG)** – prebuilt at build time; fastest load.

Страницы полностью собираются **во время сборки проекта**, а пользователю отдается уже готовый HTML-файл без вычислений на сервере.

**Incremental Static Regeneration (ISR)

Страница сначала создается как статическая, но может **пересобираться на сервере по таймеру или при запросе**, не требуя полного ребилда приложения.

**Server-Side Rendering (SSR)

HTML генерируется **на сервере при каждом запросе пользователя** с учетом актуальных данных.

**Client-Side Rendering (CSR)

Сервер отдает **пустой HTML-шаблон**, а вся разметка строится **в браузере через JavaScript** после загрузки данных.

**Partial Pre-Rendering

- **статические части** страницы генерируются заранее

- **динамические блоки** догружаются или рендерятся отдельно


### 2) Measuring and diagnosing performance

Chrome DevTools → **FCP** and **TTI** metrics.
React DevTools Profiler → identifies excessive re-renders.
Lighthouse / WebPageTest / Datadog → cross-device performance analysis.

### 3) Preventing unnecessary re-renders


React memoization tools:

- `React.memo` → re-render only on prop change.
- `useCallback` → memoizes functions.
- `useMemo` → caches expensive calculations.

Goal: reduce wasted render cycles.


### 4) Lazy loading and bundle optimization

- **Lazy loading** components on demand reduces initial bundle size.
- **Tree shaking** removes unused JS.
- Skeletons/spinners improve perceived responsiveness.
- Mobile optimization and accessibility broaden usability.

### 5) State management and client caching

Client-side state caching:

- Stores server responses locally.
- Updates cache after mutations instead of refetching.
- Requires expiration logic to prevent stale data.

Result: fewer network calls and faster UI.

### 6) API caching with expiration (React Query)

Using `useQuery`:

- Returns cached data if still valid.
- Refetches when stale time expires.

### 7) Reducing over-fetching with GraphQL

- Request only required fields (e.g., name + price).
- Built-in in-memory caching reduces duplicate requests.
  x

### 8) Rate limiting and debouncing

- Prevents excessive API calls (e.g., search input keystrokes).
- Debounce waits for user pause before triggering request.

### 9) Filtering and pagination strategies

- Uses page number + limit.
- Allows jumping to any page.
- Vulnerable to duplicates or shifting data.
### Cursor pagination
- Uses sequential ID/timestamp cursor.
- Stable under inserts/deletes and more DB-efficient.
- Cannot jump to arbitrary page.


-----

# 1. Requirements → UI → State → API (Foundational Flow)

Functional vs Non-Functional Requirements

- Functional: what the UI must allow (view, add to cart, review, purchase).
- Non-functional: performance, scalability, security, accessibility.  
  These map to **airplane analogy**: structure vs operating characteristics.

### From User Stories to UI

- Convert requirements → **low-fidelity mockup**.
- Extract:
    - **State data model**
    - **API contract**  
      Senior engineers must influence API design, not only UI.

Из интерфейса извлекается **модель состояния** — минимальная структура данных,  
которая делает UI возможным

- хранить **только essential state**
- лишнее состояние:
    - потребляет память
    - вызывает лишние рендеры
    - ухудшает производительность
      Следствие:  
      Frontend system design = **задача минимизации состояния**.

- фронтенд не «ждёт API»
- фронтенд **формирует требования к API**
- работает совместно с backend, чтобы:
    - структура данных соответствовала UI
    - минимизировать лишние запросы
    - оптимизировать latency и payload

# 2. State Modeling at Scale
### Sources of State

- User interaction — выбор фильтров, ввод, клики, навигация
- Data fetching  — ответы сервера, loading/error/data
  ≈ **99% of application state**.
### Essential State Principle

— минимальный набор данных, без которого UI не может функционировать.

- Keep **minimum irreducible state**.
- Extra state harms performance and memory.

Лишний state:
- потребляет память
- вызывает дополнительные рендеры
- ухудшает производительность

Следовательно:
> Чем меньше состояние — тем стабильнее и быстрее система.
### State Placement Hierarchy

- Local
- Shared local
- Global (e.g., auth)  
  Rule:  
  **As low as possible, as high as necessary.**


State-дизайн определяет:

- производительность
- сложность компонентов
- масштабируемость UI
- удобство API

# 3. API Modeling & REST Trade-offs — системный смысл

## Domain decomposition

UI-объект **product page** не является одной сущностью системы.  
Он собирается из независимых доменных источников:

- pricing service
- rating service
- reviews service
- delivery/logistics service

# 4. Non-Functional Requirements & Traffic Thinking

#### 1. Web performance

Определяет UX, SEO, конверсию.
#### 2. Client scalability

Система должна выдерживать:
- слабые устройства
- плохую сеть
- массовый рост пользователей
#### 3. Availability / fault tolerance

Partial failure — норма распределённых систем.
#### 4. Accessibility

Юридическое и продуктовое требование.

#### 5. Maintainability

Стоимость изменений > стоимость написания.
#### 6. Security

XSS, CSRF, token leakage, supply chain.


# 5. Back-of-Envelope Traffic Analysis


---

# 6. System Design Analysis — WhiteCircleTestProj

Разбор архитектурных решений приложения через призму system design interview.

## Rendering Strategy — почему CSR

**Выбор:** Client-Side Rendering (`'use client'` на page.tsx)

**Почему не SSR/SSG:**
- Основной контент — **стриминг AI-ответов в реальном времени**. SSR бесполезен: при первом рендере нет данных, они приходят по WebSocket/fetch stream
- Каждый чат уникален для пользователя → SSG невозможен (нет предсказуемого контента)
- Нет SEO-требований — приложение приватное, нет публичных страниц

**Trade-offs:**
| | CSR (текущий) | SSR |
|--|--|--|
| **Initial load** | Пустой shell → загрузка данных | HTML с данными сразу |
| **Streaming** | Нативная поддержка через `useChat()` | Нужен гидрация + клиентский код всё равно |
| **Complexity** | Простая архитектура | Server Components + Client boundary management |
| **SEO** | Нет (не нужен) | Есть |

**Вывод:** для real-time AI чата CSR — оптимальный выбор. SSR добавил бы сложность без выгоды.

---

## State Management — SWR + useState + localStorage

**Выбор:** Нет глобального стора (Redux/Zustand). State распределён по компонентам.

**Принцип:** "As low as possible, as high as necessary"

| State | Где | Почему |
|-------|-----|--------|
| Chat list | `page.tsx` (SWR) | Серверные данные с кэшированием |
| Active chat ID | `page.tsx` (useState + localStorage) | Нужен в Sidebar и Chat, поднят на уровень page |
| Streaming messages | `chat.tsx` (useChat) | Изолирован в Chat, не нужен другим компонентам |
| Input text | `chat.tsx` (useState) | Локальный UI state |
| PII results | `chat-message.tsx` (hook) | Привязан к конкретному сообщению |
| Sidebar open | `sidebar.tsx` (useState) | Чисто локальный UI |

**Почему не Redux/Zustand:**
- State минимальный — нет shared state между несвязанными компонентами
- SWR уже управляет серверным кэшем (deduplication, revalidation, optimistic updates)
- Redux добавил бы boilerplate без решения реальной проблемы
- Zustand мог бы заменить `useState` для `activeChatId`, но это overengineering для одного значения

**Trade-off:** если приложение вырастет (auth, settings, themes) — Zustand станет оправдан. На текущем масштабе — излишен.

---

## Data Fetching — SWR

**Выбор:** SWR (stale-while-revalidate)

**SWR vs React Query:**

| Критерий | SWR | React Query |
|----------|-----|-------------|
| Bundle size | ~4KB | ~13KB |
| API surface | Минимальный | Обширный (mutations, infinite queries, prefetch) |
| Learning curve | Низкая | Средняя |
| Mutations | Ручные через `mutate()` | Встроенный `useMutation` |
| DevTools | Нет | Есть |

**Почему SWR:**
- Приложение имеет **простые CRUD-операции** — SWR покрывает все нужды
- `mutate()` с optimistic data достаточен для оптимистичных обновлений
- Меньший bundle = быстрее загрузка
- React Query оправдан при сложных mutation chains, pagination, infinite scroll — здесь это не нужно

**Ключевые настройки:**
```ts
dedupingInterval: 5000  // Не дублировать запросы чаще 5 сек
revalidateOnFocus: false // Не рефетчить при переключении вкладок
```

**Optimistic updates:** при создании/удалении чата — мгновенное обновление UI через `mutate(key, newData, false)`, с fallback на revalidation при ошибке.

---

## API Design — REST

**Выбор:** REST API (не GraphQL)

**Endpoints:**
```
GET    /api/chats          — список чатов
POST   /api/chats          — создать чат
GET    /api/chats/[id]     — чат с сообщениями
DELETE /api/chats/[id]     — удалить чат
POST   /api/chat           — стриминг ответа Claude
POST   /api/detect-pii     — PII детекция через Haiku
```

**Почему REST, а не GraphQL:**
- 6 endpoints — граф запросов тривиальный, нет over-fetching
- Next.js App Router нативно поддерживает REST через `route.ts`
- GraphQL требует schema definition, resolver layer, клиентскую библиотеку (Apollo/urql) — overhead для простого API
- Стриминг в REST реализуется через `Response` stream; в GraphQL нужны subscriptions (WebSocket)

**Почему `/api/detect-pii` — отдельный endpoint:**
- **Separation of concerns:** PII-детекция не связана с основным чат-потоком
- **Асинхронность:** вызывается после получения ответа, не блокирует стриминг
- **Разные модели:** chat использует Sonnet (мощная), PII — Haiku (быстрая, дешёвая)
- **Дебаунсинг:** клиент контролирует частоту вызовов, не нагружая основной endpoint

---

## PII Detection Architecture — 3-Layer Defense-in-Depth

**Дизайн:** три независимых слоя, каждый компенсирует слабости других.

### Layer 1: LLM Tags (`<pii>...</pii>`)
- **Как:** System prompt инструктирует Claude оборачивать PII в теги
- **Плюсы:** Понимает контекст ("John" как имя vs "John Deere" как бренд), высокая точность
- **Минусы:** Зависит от модели, может пропустить, не детерминирован
- **Latency:** 0ms (приходит вместе с ответом)

### Layer 2: Regex (`detectPIIInstant`)
- **Как:** Паттерны для email, phone, SSN, credit card, IP
- **Плюсы:** Детерминирован, мгновенный, не зависит от LLM
- **Минусы:** Не понимает контекст, ложные срабатывания, только структурированные данные
- **Latency:** <1ms

### Layer 3: Async Haiku (`/api/detect-pii`)
- **Как:** Отдельный LLM-вызов специально для PII extraction
- **Плюсы:** Ловит имена, адреса, context-dependent PII которые regex не может
- **Минусы:** Задержка (100-200ms debounce + API call), стоит денег
- **Latency:** ~300-500ms

**Почему 3 слоя, а не 1:**

```
Layer 1 (LLM tags)   → Ловит ~80% PII    → 0ms
Layer 2 (Regex)       → +10% (structured) → <1ms
Layer 3 (Async Haiku) → +8% (contextual)  → ~400ms
                        ≈98% coverage
```

Один слой дал бы ~80% coverage. Три слоя дают ~98% при минимальном impact на UX (Layer 1+2 мгновенные, Layer 3 асинхронный).

**Trade-off:** сложность реализации (3 пайплайна, merge результатов) vs. полнота защиты. Для privacy-critical приложения — оправдано.

---

## Streaming Architecture

**Stack:** Vercel AI SDK `streamText()` + `useChat()`

**Серверная сторона:**
```
Client → POST /api/chat → streamText(claude-sonnet) → ReadableStream → Response
```
- `streamText()` возвращает `ReadableStream`, Next.js передаёт его как chunked response
- `onFinish` callback сохраняет сообщения в БД **после завершения** стрима

**Клиентская сторона:**
- `useChat()` использует `DefaultChatTransport` для подключения к `/api/chat`
- Управляет lifecycle: `status` = `'submitted'` → `'streaming'` → idle
- Автоматически парсит UI message stream protocol

**Почему не WebSocket:**
- AI SDK абстрагирует транспорт — внутри HTTP streaming (Server-Sent Events-like)
- Для one-shot request-response (user → AI → response) WebSocket избыточен
- HTTP streaming проще в деплое (нет sticky sessions, совместим с serverless)
- WebSocket оправдан для real-time collaboration (Google Docs), не для AI чата

---

## Database — PostgreSQL (Supabase)

**Выбор:** PostgreSQL через Supabase, ORM — Prisma

**Почему PostgreSQL, а не SQLite:**
- **Деплой:** Vercel serverless не поддерживает SQLite (нет persistent filesystem)
- **Concurrent access:** PostgreSQL обрабатывает параллельные запросы; SQLite — single-writer lock
- **Supabase:** managed PostgreSQL, connection pooling из коробки

**Prisma Singleton Pattern:**
```ts
// В dev: hot-reload создаёт новые PrismaClient → утечка соединений
// Fix: сохраняем в globalThis
const prisma = globalThis.prismaGlobal ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
```

**Trade-off:** Prisma добавляет абстракцию (генерация client, миграции), но даёт type safety и удобные запросы. Для простой схемы (2 модели) — оправдано.

---

## Performance Patterns

### Debouncing
- **PII API calls:** 200ms при стриминге, 100ms после — баланс между частотой проверок и нагрузкой на API
- **Threshold:** Не проверять если текст изменился менее чем на 20 символов — снижает количество запросов во время стриминга

### Caching
- **SWR cache:** stale-while-revalidate стратегия — показывает кэшированные данные мгновенно, обновляет в фоне
- **Deduplication:** `dedupingInterval: 5000` — одинаковые запросы объединяются в окне 5 секунд
- **PII result cache:** Module-level `Map` кэширует результаты PII detection по содержимому — одинаковый текст не отправляется повторно

### Optimistic UI
- Создание чата: мгновенно добавляется в sidebar до подтверждения сервера
- Удаление чата: мгновенно убирается из UI, при ошибке — revalidation

### React.memo
- `ChatMessage` обёрнут в `React.memo` — при стриминге нового сообщения старые N-1 сообщений не перерендериваются
- `Spoiler` обёрнут в `React.memo` — не перерендеривается если children не изменились
- Props — примитивы (`string`, `boolean`), shallow comparison работает корректно

### Stable Keys
- Ключи Spoiler компонентов основаны на содержимом PII, а не на индексе массива — React переиспользует DOM-элементы при пересчёте сегментов вместо remount


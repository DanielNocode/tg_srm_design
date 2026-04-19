# TG-CRM Frontend — брифинг для редизайна

## О проекте

**TG-CRM** — внутренний инструмент для операторов, работающих с клиентами в Telegram через несколько управляемых аккаунтов.

## Стек (нельзя менять)

- **React 18** + **TypeScript**
- **Vite** (сборка)
- **Zustand** (state management)
- **axios** (HTTP клиент)
- **react-router-dom** (роутинг)
- Нет UI-библиотеки — все стили кастомные. Можно подключить что-то лёгкое (shadcn/ui, Radix UI, Tailwind), если улучшит результат.

## Сценарии UI

### 1. Логин (`/login`)
- Email + пароль
- После login — редирект в `/`

### 2. Диалоги (`/`)
- **Sidebar слева**: фильтры по папкам + по аккаунтам, список диалогов (последние сообщения, бейджи непрочитанного)
- **Центр — ChatPanel**: шапка (инфо о собеседнике), список сообщений, поле ввода + прикрепление медиа, кнопка шаблона, эмодзи
- **Справа — DetailsPanel**: подробности о собеседнике, его тэги, история
- Мобильная версия: есть класс `show-chat` — переключает между списком и чатом

### 3. Админка (`/admin`)
- **Таб "Аккаунты"**: таблица Telegram-аккаунтов (phone, label, username, статус, подключение, прокси-IP, last dialog, live-status) + кнопка **"+ Добавить аккаунт"** (3-шаговая форма: данные → SMS-код → 2FA) + кнопка **Live-check** (тест отправки)
- **Таб "Прокси"**: таблица 22 BY-VPS прокси (IP, порт, label, статус, кому привязан)
- Dropdown в строке аккаунта для смены прокси

## Структура данных (из Zustand store)

См. `src/store/index.ts` для полных типов. Основные:

```ts
type Dialog = {
  id: number; tg_chat_id: number; title: string;
  account_id: number; assigned_to: number | null;
  last_msg_text: string | null; last_msg_at: string | null;
  unread_count: number; type: 'private' | 'group' | ...
}
type MsgData = {
  id: number; text: string | null;
  direction: 'in' | 'out'; sent_at: string;
  from_name: string; operator_id: number | null;
  // + медиа-поля
}
type Account = {
  id: number; phone: string; label: string; color: string;
  is_active: boolean; status: string; connected: boolean;
}
```

## API endpoints (не трогать имена)

- `POST /auth/login` → {token, operatorId, name, role}
- `GET /dialogs` → список
- `GET /dialogs/{id}` → один
- `GET /messages/{dialog_id}` → сообщения
- `GET /accounts` → аккаунты
- `POST /accounts/authorize/request-code` → SMS
- `POST /accounts/authorize/confirm-code` → подтвердить код (может вернуть {status: "need_2fa"})
- `POST /accounts/authorize/confirm-2fa` → 2FA
- `PATCH /admin/accounts/{id}/proxy` → сменить прокси
- `POST /admin/accounts/live-check?test_send=true` → диагностика
- `GET /admin/proxies` → список BY-прокси
- WebSocket: `/ws?token=...` — новые сообщения

## Что хочется от редизайна

1. **Современный тёмный UI** (текущие цвета: акцент синий, тёмно-серый фон — можно переопределить)
2. **Чистая Админка** — сейчас она кустарная, нужна красивая таблица аккаунтов с понятными бейджами статуса
3. **Адаптивность** — ноутбук + мобильный
4. **Декомпозиция** — разнести компоненты по папкам `components/` и `pages/` (сейчас всё в одном `App.tsx`, 1098 строк)
5. **Формы** — форма добавления аккаунта (3 шага) должна быть красивой, с индикатором шагов
6. **Диалоги** — список + чат + детали, как в Телеграме, но на 3 колонки

## Что НЕЛЬЗЯ менять

- API endpoints и их параметры
- Названия полей в данных (dialog_id, tg_chat_id, sent_at, etc.)
- Роутинг верхнего уровня (`/login`, `/admin`, `/` → Layout)
- Zustand store interface (можно расширять, но не ломать существующие поля)
- WebSocket-формат сообщений (`data.type === 'new_message'`, `data.type === 'read_outbox'`, `data.type === 'dialog_read_crm'`)

## Файлы

- `src/App.tsx` (1098 строк) — вся UI-логика
- `src/App.css` — текущие стили
- `src/index.css` — CSS-переменные (--acc, --bg0, --bg1, --t1, --t2, --bd2)
- `src/store/index.ts` — Zustand + типы
- `src/api/client.ts` — axios с interceptor'ом токена
- `src/main.tsx` — entry point
- `package.json` — зависимости

## Текущее состояние

Интерфейс рабочий, но минимальный. Админка сделана набыстро в том же `App.tsx`, без декомпозиции. Диалоги — стилизованы руками, без UI-kit'а.

## Результат, который я хочу получить от AI

Переписанный фронтенд (лучше всего — с декомпозицией на компоненты) с сохранением **всей логики и API-контрактов**. Можешь подключить Tailwind или shadcn/ui если хочешь, только обозначь это в зависимостях.

# Панель турниров CS2 на базе MatchZy

## Мастер-контекст
Проект: «Панель турниров CS2 на базе MatchZy».
Цель: принимать HTTP-события и демки от MatchZy, агрегировать live-статистику, подтверждать финалы по CSV/БД MatchZy; давать панель (Live/History/Match/Servers/Disk/Settings) и Telegram-бота (пушит только финальные результаты); ставиться на один VDS Ubuntu 24.04 (минимальный бюджет).
Стек: Node/NestJS+Fastify; NATS JetStream; PostgreSQL; Redis; Next.js; Telegraf; Caddy; Docker/Compose.
Каналы:
- /ingest/matchzy — HTTP POST JSON (MatchZy шлёт на корень URL; можно добавить кастомный заголовок для auth; retry/dedupe в MatchZy нет — делать идемпотентность у нас).
- /ingest/demo — HTTP загрузка ZIP демки; все заголовки запроса сохраняем как есть (meta_headers JSON). В MatchZy гарантированы: MatchZy-FileName, MatchZy-MapNumber (0-индекс), MatchZy-MatchId.
- (опц.) matchzy_loadmatch_url — загрузка матча; может передавать пару [header name] [header value].
Жизненный цикл: ingest → JetStream → workers (идемпотентность) → live UI → «финальная сверка» по CSV/БД MatchZy → История/Экспорт/Бот.
Диск/GC: баннер при ≥90% (сворачиваемый); Emergency-GC (OFF по умолчанию): при ≥97% удаляем по одной самой старой доступной демке до <95% (audit_log).
Режимы запуска: с доменом (Caddy Auto-HTTPS) / без домена (HTTP:80; Auto-HTTPS выключен).
Роли: админы (полный доступ, TRUNCATE/удаление БД с подтверждением), стримеры/клиенты (read-only).
Экспорт/Импорт/Бэкапы: CSV/XLSX/SQLite; импорт с dry-run/diff; pg_dump/pg_restore.
Анти-выдумывание (обязательно): не придумывать поля/заголовки/CLI/флаги во внешних системах. Всё строго сверять по оф. документации; непонятное помечать TODO(need-confirmation) + безопасная заглушка. В каждом шаге обновлять /PROGRESS.md, /MANIFEST.json, /CHECKLIST.md.

## Верификация
- MatchZy Events & Forwards: https://shobhit-pathak.github.io/MatchZy/events.html
- MatchZy GOTV & Demos: https://shobhit-pathak.github.io/MatchZy/gotv/
- MatchZy Match Setup: https://shobhit-pathak.github.io/MatchZy/match_setup/
- MatchZy (README, CSV/SQLite/MySQL): https://github.com/shobhit-pathak/MatchZy
- Caddy Auto-HTTPS: https://caddyserver.com/docs/json/apps/http/servers/automatic_https/
- NATS JetStream Monitoring: https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream
- NATS JetStream Streams: https://docs.nats.io/using-nats/developer/develop_jetstream/jetstream_streams
- Docker Engine Ubuntu: https://docs.docker.com/engine/install/ubuntu/
- PostgreSQL pg_dump: https://www.postgresql.org/docs/current/app-pgdump.html
- PostgreSQL pg_restore: https://www.postgresql.org/docs/current/app-pgrestore.html
- Telegram Bots FAQ: https://core.telegram.org/bots/faq

## Развёртывание
1. Установите зависимости и запустите стек скриптом `scripts/install.sh`, который повторяет официальную инструкцию Docker для Ubuntu 24.04 (https://docs.docker.com/engine/install/ubuntu/).
2. Выберите режим:
   - **С доменом и Auto-HTTPS**: `./scripts/install.sh --mode domain --domain example.com`
     - Скрипт создаст `deploy/.env` с `CADDY_SITE_ADDRESS=example.com` и оставит автоматическую выдачу сертификатов включённой.
   - **Без домена (HTTP:80)**: `./scripts/install.sh --mode http`
     - `deploy/.env` получит `CADDY_SITE_ADDRESS=:80` и `CADDY_AUTO_HTTPS_DIRECTIVE="auto_https off"`, что соответствует требованиям отключения Auto-HTTPS согласно https://caddyserver.com/docs/json/apps/http/servers/automatic_https/.
3. После выполнения `docker compose up -d` стек будет доступен:
   - Caddy (80/443) проксирует запросы к фронтенду и API.
   - API (порт 3000) обслуживает ingest-пути `/ingest/matchzy`, `/ingest/demo` и `/api/*`.
   - Workers/бот/NATS/PostgreSQL/Redis запускаются как фоновые сервисы. JetStream активирован ключом `-js`, что соответствует рекомендациям https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream.

### Переменные окружения
| Переменная | Где используется | Назначение |
|------------|------------------|------------|
| `CADDY_SITE_ADDRESS` | `deploy/Caddyfile`, `docker-compose` | Хост/порт Caddy (домен или `:80`). |
| `CADDY_AUTO_HTTPS_DIRECTIVE` | `deploy/Caddyfile`, `docker-compose` | Управление Auto-HTTPS (`auto_https off` в HTTP-режиме). |
| `FRONTEND_UPSTREAM` | `deploy/Caddyfile`, `docker-compose` | Адрес фронтенда (по умолчанию `frontend:3000`). |
| `API_UPSTREAM` | `deploy/Caddyfile`, `docker-compose` | Адрес API (по умолчанию `api:3000`). |
| `NODE_ENV` | API/Workers/Frontend/Bot | Режим запуска Node-приложений. |
| `DATABASE_URL` | API/Workers | Строка подключения к PostgreSQL. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | PostgreSQL | Параметры БД по умолчанию. |
| `REDIS_URL` | API/Workers | Подключение к Redis (по умолчанию `redis://redis:6379/0`). |
| `NATS_URL` | API/Workers/Bot | Подключение к NATS JetStream (по умолчанию `nats://nats:4222`). |
| `NATS_MONITOR_UPSTREAM` | Caddy | Внутренний адрес мониторинга JetStream `/jsz` (по умолчанию `nats:8222`, см. https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream). |
| `NATS_DURABLE_NAME` | Workers | Имя долговечного консьюмера JetStream (по умолчанию `matchzy-workers`). |
| `JSZ_BASIC_AUTH_USER` | Caddy | Пользователь Basic Auth для прокси `/jsz`. |
| `JSZ_BASIC_AUTH_PASSHASH` | Caddy | Хеш пароля Basic Auth (сгенерировать `caddy hash-password --plaintext 'secret'`). |
| `MATCHZY_STREAM_MAX_BYTES` | `scripts/nats-init.sh` | Лимит хранения Stream `MATCHZY.EVENTS` в байтах (5–10 ГиБ по https://docs.nats.io/using-nats/developer/develop_jetstream/jetstream_streams). |
| `MATCHZY_STREAM_MAX_AGE` | `scripts/nats-init.sh` | Максимальный возраст сообщений Stream (по умолчанию `48h`). |
| `API_ORIGIN` | Frontend/Bot | Базовый URL API для клиентских запросов. |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | Публичный базовый путь API для браузерных запросов (по умолчанию `/api`, проксируется через Caddy). |
| `INTERNAL_API_BASE_URL` | Frontend | Внутренний URL API для server-side запросов Next.js (по умолчанию `http://api:3000`). |
| `TELEGRAM_BOT_TOKEN` | Bot | Токен Telegram-бота (см. лимиты https://core.telegram.org/bots/faq). |
| `TELEGRAM_WEBHOOK_URL` | Bot | (Опц.) Вебхук Telegram. |
| `LOG_LEVEL` | Workers | Уровень логирования воркеров (по умолчанию `info`). |
| `JSZ_MONITOR_URL` | Backend | Внутренний URL для чтения JetStream `/jsz` (проксируется Caddy, см. https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream). |
| `ALLOW_DB_DROP` | Backend | Разрешение на сброс схемы через API настроек (по умолчанию `false`, включайте вручную перед выполнением опасных операций). |

Скрипт можно запускать повторно — если Docker уже установлен, блок установки будет пропущен. Для изменения режима достаточно обновить `.env` и снова выполнить `docker compose up -d` в каталоге `deploy/`.

### JetStream Stream и мониторинг
1. После запуска стека создайте (или проверьте существование) Stream `MATCHZY.EVENTS` с помощью `scripts/nats-init.sh` — скрипт использует `nats-box` CLI и настройки из https://docs.nats.io/using-nats/developer/develop_jetstream/jetstream_streams.
   ```bash
   MATCHZY_STREAM_MAX_BYTES=6442450944 ./scripts/nats-init.sh
   ```
   Значение `MATCHZY_STREAM_MAX_BYTES` допускает диапазон 5–10 ГиБ и вместе с `MATCHZY_STREAM_MAX_AGE` определяет Retention=Limits (макс. возраст по умолчанию `48h`).
2. Для smoke-проверки публикации/чтения используйте `scripts/nats-smoke.sh`:
   ```bash
   ./scripts/nats-smoke.sh
   ```
   Скрипт публикует сообщение в subject `matchzy.events.smoke` и читает последнюю запись потока, чтобы убедиться в доставке.
3. Мониторинг JetStream (`/jsz`) проксируется через Caddy с Basic Auth (https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream).
   - Сгенерируйте хеш пароля: `caddy hash-password --plaintext 'strong-secret'`.
   - Установите переменные `JSZ_BASIC_AUTH_USER` и `JSZ_BASIC_AUTH_PASSHASH`, после чего `/jsz` будет доступен по адресу `https://<ваш_домен>/jsz`. По умолчанию используется пара `nats/changeme` (хеш `JSZ_BASIC_AUTH_PASSHASH` уже задан в `docker-compose.yml`) — обязательно замените на собственные значения.
   - Для HTTP-режима Auto-HTTPS отключается директивой `auto_https off` (https://caddyserver.com/docs/json/apps/http/servers/automatic_https/).

## Backend ingest API (NestJS + Fastify)

### Подготовка окружения
1. Установите зависимости:
   ```bash
   cd backend
   npm install
   ```
2. Скопируйте `.env.example` и задайте значения (токен, подключения к PostgreSQL и NATS):
   ```bash
   cp .env.example .env
   ```
3. Локальный запуск:
   ```bash
   npm run start:dev
   ```
4. Запуск тестов (CI-режим):
   ```bash
   CI=true npm test
   ```

### Примеры ingest-запросов
- `/ingest/matchzy` принимает любой JSON и требует `Authorization: Bearer <SERVER_TOKEN>`; события публикуются в NATS subject `matchzy.events.raw` (см. [MatchZy Events & Forwards](https://shobhit-pathak.github.io/MatchZy/events.html) и [NATS JetStream мониторинг](https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream)).

  ```bash
  curl -X POST "http://localhost:3000/ingest/matchzy" \
    -H "Authorization: Bearer ${SERVER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"event":"match_started","matchId":"123"}'
  ```

- `/ingest/demo` принимает поток RAW ZIP и сохраняет все заголовки в `meta_headers` без модификаций (см. [MatchZy GOTV & Demos](https://shobhit-pathak.github.io/MatchZy/gotv/)).

  ```bash
  curl -X POST "http://localhost:3000/ingest/demo" \
    -H "MatchZy-FileName: sample.zip" \
    -H "MatchZy-MapNumber: 0" \
    -H "MatchZy-MatchId: abc" \
    --data-binary @demo.zip
  ```

### Основные переменные окружения API
| Переменная | Назначение |
|------------|------------|
| `SERVER_TOKEN` | Токен авторизации для `/ingest/matchzy` (MatchZy Events & Forwards). |
| `DEMO_STORAGE_PATH` | Каталог для сохранения загруженных демо. |
| `NATS_URL`, `NATS_SUBJECT_MATCHZY_EVENTS` | Подключение и subject публикации событий в NATS JetStream. |
| `POSTGRES_*` | Параметры подключения к PostgreSQL для хранения таблиц `files`, `events_raw`, статистики и справочников. |
| `JSZ_MONITOR_URL` | URL мониторинга JetStream `/jsz` (используется API для раздела Disk, см. https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream). |
| `ALLOW_DB_DROP` | Флаг, разрешающий опасную операцию «Drop database» в разделе Settings. |

## Frontend (Next.js UI)

- Проект `frontend/` построен на Next.js 14 c Tailwind CSS. Навигация включает страницы **Live**, **History**, **Match**, **Servers**, **Disk** и **Settings** (см. мастер-контекст).
- Все запросы выполняются через Caddy `/api/*`, причём серверные компоненты используют `INTERNAL_API_BASE_URL`, а браузер — `NEXT_PUBLIC_API_BASE_URL`.

### Страница Live
- Использует SSE (`/live/stream`) для обновления списка матчей в реальном времени и агрегатов событий MatchZy (см. [MatchZy Events & Forwards](https://shobhit-pathak.github.io/MatchZy/events.html)).
- Отображает текущие карты, суммарные счёты и счётчики `map_event_aggregates`.

### Страница History
- Позволяет фильтровать завершённые матчи по турниру, команде, диапазону дат и строке поиска.
- Экспорт истории в CSV использует данные финальной сверки (`/matches/history/export`).

### Страница Match
- Отображает детальный боксскор финального матча, таймлайн `events_raw` и список загруженных демо (метаданные получаются из MatchZy GOTV, см. [документацию](https://shobhit-pathak.github.io/MatchZy/gotv/)).

### Страница Servers
- Управление игровыми серверами: регистрация, активация/деактивация и выдача токенов с SHA-256 хешированием. Токены отображаются один раз — храните безопасно.
- Статус «last seen» обновляется воркером при поступлении событий MatchZy.

### Страница Disk
- Показывает использование хранилища демо (`DEMO_STORAGE_PATH`), размер базы (`pg_database_size`) и состояние JetStream `/jsz` (см. [документацию NATS](https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream)).
- При загрузке ≥90% отображается сворачиваемый баннер с переходом к управлению демками.

### Страница Settings
- Разделяет функции по управлению данными, резервным копиям и настройкам бота.
- Кнопка Truncate требует ввода `DELETE` и вызывает SQL-скрипт `truncate_tournament_data.sql` (без удаления серверов).
- Кнопка Drop database требует двойного подтверждения (`DELETE` и `DROP DATABASE`) и активного `ALLOW_DB_DROP`. Перед использованием выполняйте бэкап (`pg_dump`, `pg_restore`).
- Раздел Telegram напоминает о лимитах Telegram Bot API ([FAQ](https://core.telegram.org/bots/faq)).

## База данных и миграции

- Миграции TypeORM создают таблицы `tournaments`, `servers`, `teams`, `players`, `matches`, `maps`, `player_stats`, `events_raw`, `files`, `audit_log`, `bot_subscriptions`, `map_event_aggregates`, `event_offsets` и поддерживают уникальный `idempotency_key` для сырых событий MatchZy (см. [MatchZy Events & Forwards](https://shobhit-pathak.github.io/MatchZy/events.html)).
- Выполнить миграции: `cd backend && npm run migration:run`. Для отката последнего шага — `npm run migration:revert`.
- Бэкапы и восстановление проверяются штатными инструментами PostgreSQL ([pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)).
- Скрипт `scripts/truncate_tournament_data.sql` очищает турнирные данные (матчи, карты, статистику, файлы, события, подписки) и не затрагивает таблицу `servers`.

### Таблицы

| Таблица | Назначение |
|---------|------------|
| `tournaments` | Турниры и метаданные (название, slug, внешний идентификатор). |
| `servers` | Выделенные игровые серверы; остаются нетронутыми при очистке. |
| `teams` | Команды турнира, связаны с `tournaments`. |
| `players` | Игроки (Steam ID, страна, принадлежность к команде/турниру). |
| `matches` | Матчи с привязкой к турниру, серверу и командам. |
| `maps` | Карты матча, хранят MatchZy map number (0-индекс). |
| `player_stats` | Статистика игроков по картам (K/D/A, рейтинг, ADR и др.). |
| `events_raw` | Сырые события MatchZy с уникальным `idempotency_key`, вычисленным по `server_id`, `match_id`, `map_no`, `event_type`, `event_ts` и подмножеству полезной нагрузки. |
| `files` | Сохранённые демо-файлы и их заголовки из MatchZy GOTV ([документация](https://shobhit-pathak.github.io/MatchZy/gotv/)). |
| `audit_log` | Журнал действий (GC, админские операции и т.п.). |
| `bot_subscriptions` | Подписки Telegram-бота на финальные результаты турниров. |
| `map_event_aggregates` | Агрегированные счётчики событий по связке сервер/матч/карта/тип события. |
| `event_offsets` | Отслеживание последней JetStream последовательности для каждой связки сервер/матч/карта. |

## Workers и агрегация

- Воркеры (`workers/`) подключаются к JetStream subject `matchzy.events.raw`, используя долговечного консьюмера и ручные подтверждения согласно рекомендациям NATS ([документация JetStream](https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream)).
- Для каждого события вычисляется `idempotency_key` по формуле `hash(server_id|match_id|map_no|event_type|event_ts|payload_subset)`; это гарантирует, что повторные доставки из MatchZy (см. [Events & Forwards](https://shobhit-pathak.github.io/MatchZy/events.html)) не изменяют агрегаты.
- Новые события сохраняются в `events_raw`, счётчики в `map_event_aggregates` увеличиваются детерминированно, а смещения JetStream фиксируются в `event_offsets` (per-server/match/map offset).
- При повторной доставке воркер обновляет только `event_offsets`, не меняя агрегаты — поведение покрыто юнит-тестом `workers/src/__tests__/aggregator.spec.ts`.
- Запуск тестов воркера: `cd workers && npm test`.

### Финальная сверка по CSV MatchZy

- MatchZy после завершения карты сохраняет CSV в `csgo/MatchZy_Stats/match_data_map{mapNumber}_{matchId}.csv`; содержимое соответствует таблице `matchzy_stats_players` (см. [MatchZy README](https://github.com/shobhit-pathak/MatchZy) — раздел Database Stats и CSV описание).
- Воркеры отслеживают события `map_result` и `series_end` ([Events & Forwards](https://shobhit-pathak.github.io/MatchZy/events.html)). При `map_result` CSV читается из каталога `MATCHZY_STATS_PATH` (по умолчанию `/matchzy_stats` внутри контейнера), после чего:
  - обновляются `maps.team1_score/team2_score/winner_team_id` и `matches.team1_score/team2_score` (серия) с отметкой `metadata.matchzy_map_result`;
  - игрокам сопоставляются SteamID, создаются отсутствующие записи в `players`, а `player_stats` наполняется подтверждёнными полями (kills/deaths/assists/damage/utility/entry/клатчи и др. из `matchzy_stats_players`).
- При `series_end` фиксируется `matches.winner_team_id`, итоговые счёты серии и `metadata.final_series`.
- Если CSV содержит колонки, отсутствующие в документации, воркер добавляет запись `audit_log` с `TODO(need-confirmation)` и не пытается интерпретировать такие поля.
- Для доступа к CSV смонтируйте путь сервера MatchZy в контейнер `workers`: используйте переменные `MATCHZY_STATS_HOST_PATH` (хостовый путь) и `MATCHZY_STATS_PATH` (внутри контейнера). По умолчанию docker-compose монтирует `./matchzy_stats:/matchzy_stats:ro`.
- Тесты финализатора находятся в `workers/src/__tests__/finalizer.spec.ts`.
- Конфликтная стратегия: live-агрегация продолжает показывать оперативные счётчики, однако финальные данные из CSV имеют приоритет — при расхождениях журнальная запись в `audit_log` облегчает ручную проверку.

## Правила анти-выдумывания
- Использовать только подтверждённые источники и спецификации.
- Любое непроверенное поле или интерфейс помечать как TODO(need-confirmation) и реализовывать безопасную заглушку.
- Перед интеграцией с внешним интерфейсом перепроверять документацию и фиксировать ссылку в README и коде.

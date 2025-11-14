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
| `API_ORIGIN` | Frontend/Bot | Базовый URL API для клиентских запросов. |
| `TELEGRAM_BOT_TOKEN` | Bot | Токен Telegram-бота (см. лимиты https://core.telegram.org/bots/faq). |
| `TELEGRAM_WEBHOOK_URL` | Bot | (Опц.) Вебхук Telegram. |

Скрипт можно запускать повторно — если Docker уже установлен, блок установки будет пропущен. Для изменения режима достаточно обновить `.env` и снова выполнить `docker compose up -d` в каталоге `deploy/`.

## Правила анти-выдумывания
- Использовать только подтверждённые источники и спецификации.
- Любое непроверенное поле или интерфейс помечать как TODO(need-confirmation) и реализовывать безопасную заглушку.
- Перед интеграцией с внешним интерфейсом перепроверять документацию и фиксировать ссылку в README и коде.

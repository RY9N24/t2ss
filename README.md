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

## Правила анти-выдумывания
- Использовать только подтверждённые источники и спецификации.
- Любое непроверенное поле или интерфейс помечать как TODO(need-confirmation) и реализовывать безопасную заглушку.
- Перед интеграцией с внешним интерфейсом перепроверять документацию и фиксировать ссылку в README и коде.

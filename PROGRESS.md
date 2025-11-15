# Прогресс
## Шаг 00
- Созданы базовые каталоги backend/, workers/, frontend/, bot/, deploy/, scripts/.
- Добавлены README, PROGRESS, CHECKLIST, MANIFEST с исходным содержанием.
- Внешние интерфейсы на этом шаге не задействованы.

## Шаг 01
- Сформирован стек Docker Compose с сервисами Caddy, API, workers, NATS JetStream, PostgreSQL, Redis, фронтендом и ботом.
- Добавлен Caddyfile с поддержкой режимов с доменом и без домена, включая отключение Auto-HTTPS по документации.
- Подготовлен скрипт установки Docker и запуска стека с выбором режима; README дополнен инструкциями и переменными окружения.

## Шаг 02
- Инициализирован backend на NestJS+Fastify, добавлены эндпоинты `/ingest/matchzy` и `/ingest/demo` с проверкой токена и сохранением заголовков/файлов.
- Реализовано сохранение метаданных загрузок в БД (TypeORM) и публикация событий в NATS JetStream с документационными ссылками.
- Добавлены curl-примеры и инструкции по окружению в README, подготовлены модульные тесты контроллеров и пример `.env`.

### Внешние интерфейсы
- Caddy Auto-HTTPS: https://caddyserver.com/docs/json/apps/http/servers/automatic_https/
- NATS JetStream Streams: https://docs.nats.io/using-nats/developer/develop_jetstream/jetstream_streams
- NATS JetStream Monitoring (/jsz): https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream
- Docker Engine для Ubuntu 24.04: https://docs.docker.com/engine/install/ubuntu/
- MatchZy Events & Forwards: https://shobhit-pathak.github.io/MatchZy/events.html
- MatchZy GOTV & Demos: https://shobhit-pathak.github.io/MatchZy/gotv/
- PostgreSQL pg_dump: https://www.postgresql.org/docs/current/app-pgdump.html
- PostgreSQL pg_restore: https://www.postgresql.org/docs/current/app-pgrestore.html

## Шаг 03
- Настроен поток JetStream `MATCHZY.EVENTS` (Retention=Limits, MaxAge 48h, MaxBytes конфигурируемый) через nats-box CLI.
- Добавлен прокси `/jsz` в Caddy с Basic Auth и ссылкой на документацию.
- Подготовлены скрипты `scripts/nats-init.sh` и `scripts/nats-smoke.sh`, обновлена документация и Compose.

## Шаг 04
- Добавлены сущности TypeORM и миграция `CreateCoreSchema` для таблиц турниров, матчей, карт, статистики игроков, файлов демо, событий и подписок бота.
- Включён прогон миграций при запуске API, обновлён ingest-сервис для сохранения метаданных файлов (`files`) и рассчитанного размера.
- Подготовлен скрипт `scripts/truncate_tournament_data.sql`, обновлён README с описанием схемы и командами `npm run migration:*`.

## Следующие шаги
- Шаг 05: дождаться инструкций по обработке live-статистики и workers согласно мастер-контексту.

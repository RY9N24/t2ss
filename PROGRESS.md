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
- NATS JetStream Monitoring (/jsz): https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream
- Docker Engine для Ubuntu 24.04: https://docs.docker.com/engine/install/ubuntu/
- MatchZy Events & Forwards: https://shobhit-pathak.github.io/MatchZy/events.html
- MatchZy GOTV & Demos: https://shobhit-pathak.github.io/MatchZy/gotv/

## Следующие шаги
- Шаг 03: определить хранилище live-статистики и базовые сущности.

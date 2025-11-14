# Прогресс
## Шаг 00
- Созданы базовые каталоги backend/, workers/, frontend/, bot/, deploy/, scripts/.
- Добавлены README, PROGRESS, CHECKLIST, MANIFEST с исходным содержанием.
- Внешние интерфейсы на этом шаге не задействованы.

## Шаг 01
- Сформирован стек Docker Compose с сервисами Caddy, API, workers, NATS JetStream, PostgreSQL, Redis, фронтендом и ботом.
- Добавлен Caddyfile с поддержкой режимов с доменом и без домена, включая отключение Auto-HTTPS по документации.
- Подготовлен скрипт установки Docker и запуска стека с выбором режима; README дополнен инструкциями и переменными окружения.

### Внешние интерфейсы
- Caddy Auto-HTTPS: https://caddyserver.com/docs/json/apps/http/servers/automatic_https/
- NATS JetStream Monitoring (/jsz): https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream
- Docker Engine для Ubuntu 24.04: https://docs.docker.com/engine/install/ubuntu/

## Следующие шаги
- Шаг 02: подготовить базовую структуру backend-приложения (NestJS/Fastify) и инфраструктурные заготовки.

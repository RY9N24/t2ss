# Внешние интерфейсы (Шаг 02)

- MatchZy Events & Forwards — подтверждает отправку HTTP POST JSON на ingest и отсутствие ретраев/дедупликации, ссылка: https://shobhit-pathak.github.io/MatchZy/events.html
- MatchZy GOTV & Demos — перечисляет гарантированные заголовки `MatchZy-FileName`, `MatchZy-MapNumber`, `MatchZy-MatchId` и формат демо-файлов, ссылка: https://shobhit-pathak.github.io/MatchZy/gotv/
- NATS JetStream — публикация событий в subject `matchzy.events.raw`, опирается на документацию: https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream

# Внешние интерфейсы (Шаг 04)
- PostgreSQL pg_dump — схема и миграции спроектированы с учётом возможности резервного копирования штатной утилитой PostgreSQL: https://www.postgresql.org/docs/current/app-pgdump.html
- PostgreSQL pg_restore — восстановление из бэкапов pg_dump остаётся совместимым с добавленными таблицами: https://www.postgresql.org/docs/current/app-pgrestore.html
- MatchZy Events & Forwards — при агрегации продолжаем использовать официальную схему событий и их поля: https://shobhit-pathak.github.io/MatchZy/events.html
- NATS JetStream — консьюмеры и подтверждение сообщений реализуем на основе официальных рекомендаций по JetStream: https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream

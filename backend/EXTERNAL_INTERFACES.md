# Внешние интерфейсы (Шаг 02)

- MatchZy Events & Forwards — подтверждает отправку HTTP POST JSON на ingest и отсутствие ретраев/дедупликации, ссылка: https://shobhit-pathak.github.io/MatchZy/events.html
- MatchZy GOTV & Demos — перечисляет гарантированные заголовки `MatchZy-FileName`, `MatchZy-MapNumber`, `MatchZy-MatchId` и формат демо-файлов, ссылка: https://shobhit-pathak.github.io/MatchZy/gotv/
- NATS JetStream — публикация событий в subject `matchzy.events.raw`, опирается на документацию: https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream

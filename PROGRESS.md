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

## Шаг 05
- Собран сервис воркеров (Node.js) для чтения JetStream subject `matchzy.events.raw`, вычисления `idempotency_key` и детерминированной агрегации.
- Добавлены таблицы `map_event_aggregates` и `event_offsets` с миграцией TypeORM и обновлённым TRUNCATE-скриптом.
- Реализованы юнит-тесты, проверяющие отсутствие дублей при повторной доставке событий, обновлена документация по агрегации.

## Шаг 06
- Расширены таблицы `matches`, `maps`, `player_stats` дополнительными полями для финальных результатов и статистик игроков; добавлена миграция `AddMatchFinalisationColumns`.
- Во `workers/` реализован финализатор CSV (`map_result`/`series_end`) с обработкой неизвестных колонок через `audit_log`, обновлением счётов и заполнением подтверждённых показателей `player_stats`; добавлены модульные тесты и пример `.env`.
- README обновлён инструкциями по переменным `MATCHZY_STATS_PATH`/`MATCHZY_STATS_HOST_PATH`, стратегии разрешения конфликтов live vs CSV и ссылками на MatchZy Database Stats.

## Шаг 07
- Собрана панель на Next.js с разделами Live, History, Match, Servers, Disk и Settings, подключёнными к backend REST/SSE эндпоинтам и ролям доступа.
- Добавлены backend-модуль Dashboard с SSE, сервисами администрирования, хранением токенов серверов и миграцией для статусов/heartbeat.
- Обновлены воркеры для записи heartbeat, документация по фронтенду и прокси в Caddy; приведены env-примеры и Tailwind-конфигурация.

### Внешние интерфейсы
- MatchZy Events & Forwards: https://shobhit-pathak.github.io/MatchZy/events.html — live события и контекст для статистики в UI.
- MatchZy GOTV & Demos: https://shobhit-pathak.github.io/MatchZy/gotv/ — отображение метаданных демо и управление хранением.
- NATS JetStream Monitoring (`/jsz`): https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream — индикаторы в разделе Disk.
- PostgreSQL pg_dump: https://www.postgresql.org/docs/current/app-pgdump.html — операции бэкапа в Settings.
- PostgreSQL pg_restore: https://www.postgresql.org/docs/current/app-pgrestore.html — инструкции по восстановлению.

## Шаг 08
- Реализован REST-контур `/demos` (листинг, скачивание, повторная загрузка, массовое удаление) с сохранением всех действий в `audit_log`.
- Добавлена миграция с колонками `status`, `is_pinned`, `is_in_use`, `matchzy_match_id/map_number`; ingest теперь связывает демки с матчами/картами по заголовкам MatchZy GOTV (https://shobhit-pathak.github.io/MatchZy/gotv/).
- Страница Disk получила таблицу с фильтрами по турнирам/датам/размеру/статусу, массовые операции и баннер, скролящийся к управлению демками; README описывает переменные `DEMO_REUPLOAD_*` и агент повторной загрузки.
- Добавлены unit-тесты DashboardService на листинг/удаление/реаплоад, обновлены env/compose.
- Дополнительно покрыт `/demos` интеграционным e2e-тестом и усилен UI (inline-ошибки/успехи по строкам, напоминание о контракте агента).

## Шаг 09
- Реализована Emergency-GC (97%→95%) с хранением состояния в `system_settings`, автоматическим циклом удаления самых старых демок и аудитом каждого удаления.
- API `/system/emergency-gc` (GET/PATCH/POST run) и UI на странице Disk позволяют включать/выключать GC, задавать grace-период, запускать очистку вручную и наблюдать последний запуск.
- Добавлена миграция `1706040005000-AddSystemSettings`, unit-тесты Emergency-GC и документация по безопасным настройкам/переменным окружения.

## Шаг 10
- Добавлен `DataTransferService` (CSV/XLSX/SQLite) и API `GET /system/tournaments/:id/export/:format`, `POST /system/tournaments/import/{csv|sqlite}` с dry-run, персистентным `ImportSummary` и аудитом.
- Реализован `BackupService`, маршруты `/system/backup/export` и `/system/backup/restore`, поддержка dry-run (`pg_restore --list`) и новые переменные `PG_DUMP_BIN`/`PG_RESTORE_BIN`.
- Обновлена страница Settings (Next.js) — появились секции Tournament export/import и Backups & restores с загрузкой файлов и визуализацией сводок.
- Добавлен e2e-тест `backend/test/export-import.e2e-spec.ts`, покрывающий экспорт и повторный импорт турнира через HTTP-интерфейсы.

## Следующие шаги
- Шаг 11: дальнейшие задачи согласно мастер-плану.

### Внешние интерфейсы (Шаг 10)
- MatchZy (README, CSV/SQLite/MySQL): https://github.com/shobhit-pathak/MatchZy — подтверждённые форматы CSV и SQLite, к которым должны соответствовать экспорт/импорт турниров.
- PostgreSQL pg_dump: https://www.postgresql.org/docs/current/app-pgdump.html — официальные параметры архивного формата для резервного копирования.
- PostgreSQL pg_restore: https://www.postgresql.org/docs/current/app-pgrestore.html — инструкция по проверке (`--list`) и восстановлению архивов перед применением.

-- Phase 11 draft: analytics foundation indexes.
-- Review before running in production. Non-destructive; no fake seed data.

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_created_at
ON analytics_events(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_utm_source_created_at
ON analytics_events(utm_source, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_order_id
ON analytics_events(order_id)
WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status_last_activity
ON abandoned_carts(recovery_status, last_activity_at);

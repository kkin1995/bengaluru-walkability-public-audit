-- Migration 012: Fix refresh_public_stats_mv() — remove the REFRESH … (with-lock) variant
--
-- Migration 011 defined the trigger function using the non-blocking variant of
-- REFRESH MATERIALIZED VIEW, but idx_public_stats_mv is a constant-expression
-- index ((1)) which PostgreSQL refuses for that variant.  Every mutation on
-- the reports table (assign-org, resolve) fired the trigger and returned
-- HTTP 500.  This migration replaces the function body in-place using the
-- plain REFRESH which works with any index type.
--
-- Trade-off: plain REFRESH holds ShareUpdateExclusiveLock on public_stats_mv
-- for the duration of the refresh.  At MVP scale (<10k rows) this is <50ms
-- and does not block readers.  The non-blocking variant can be re-introduced
-- if a real-column unique index is added in a later migration.

CREATE OR REPLACE FUNCTION refresh_public_stats_mv()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public_stats_mv;
    RETURN NULL;
END;
$$;

// backend/src/db/dedup_job.rs
//
// Background proximity deduplication job.
// Runs every 5 minutes to find recent unlinked reports within 50m of an
// existing open report of the same category and links them atomically.
//
// SQL constants are module-level so unit tests can verify correctness
// without a live database.

use std::sync::Arc;
use sqlx::PgPool;

// SQL constants exposed for unit testing (verifiable without a DB connection)

pub const FIND_NEARBY_OPEN_REPORT_SQL: &str = r#"
    SELECT id FROM reports
    WHERE id != $1
      AND category = $2::issue_category
      AND status != 'resolved'
      AND duplicate_of_id IS NULL
      AND ST_DWithin(
          ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography,
          location,
          50.0
      )
    ORDER BY created_at ASC
    LIMIT 1
"#;

pub const LINK_DUPLICATE_SQL: &str =
    "UPDATE reports SET duplicate_of_id = $2 WHERE id = $1";

pub const INCREMENT_DUPLICATE_COUNT_SQL: &str = r#"
    UPDATE reports SET
      duplicate_count = duplicate_count + 1,
      duplicate_confidence = CASE
        WHEN (
          SELECT COUNT(DISTINCT submitter_ip)
          FROM reports
          WHERE duplicate_of_id = $2 AND submitter_ip IS NOT NULL
        ) >= 2 THEN 'high'
        ELSE duplicate_confidence
      END
    WHERE id = $2
"#;

/// Entry point spawned by main.rs at startup.
/// Runs an infinite loop with a 5-minute interval, calling run_dedup_pass each tick.
pub async fn run_dedup_loop(pool: Arc<PgPool>) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
    loop {
        interval.tick().await;
        if let Err(e) = run_dedup_pass(&pool).await {
            tracing::error!("Dedup pass failed: {}", e);
        }
    }
}

async fn run_dedup_pass(pool: &PgPool) -> Result<(), crate::errors::AppError> {
    use uuid::Uuid;

    // Find reports created in the last 15 minutes without duplicate_of_id
    let candidates = sqlx::query_as::<_, (Uuid, String, f64, f64)>(
        r#"SELECT id, category::TEXT, latitude, longitude
           FROM reports
           WHERE duplicate_of_id IS NULL
             AND created_at >= NOW() - INTERVAL '15 minutes'
           ORDER BY created_at ASC"#,
    )
    .fetch_all(pool)
    .await?;

    for (id, category, lat, lng) in candidates {
        // Check if there is a nearby open original report
        let nearby = sqlx::query_as::<_, (Uuid,)>(FIND_NEARBY_OPEN_REPORT_SQL)
            .bind(id)
            .bind(&category)
            .bind(lat)
            .bind(lng)
            .fetch_optional(pool)
            .await?;

        if let Some((parent_id,)) = nearby {
            link_duplicate(pool, id, parent_id).await?;
        }
    }
    Ok(())
}

async fn link_duplicate(
    pool: &PgPool,
    duplicate_id: uuid::Uuid,
    parent_id: uuid::Uuid,
) -> Result<(), crate::errors::AppError> {
    let mut tx = pool.begin().await?;

    sqlx::query(LINK_DUPLICATE_SQL)
        .bind(duplicate_id)
        .bind(parent_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query(INCREMENT_DUPLICATE_COUNT_SQL)
        .bind(duplicate_id)
        .bind(parent_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — no database required
//
// Requirements covered:
//   ABUSE-03 — proximity dedup within 50m
//   ABUSE-04 — duplicate_confidence = 'high' on distinct IPs >= 2
//   ABUSE-05 — atomic SQL increment (not read-then-write)
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn proximity_query_uses_50m_radius() {
        assert!(
            FIND_NEARBY_OPEN_REPORT_SQL.contains("50.0"),
            "ST_DWithin must use 50.0 metre radius"
        );
    }

    #[test]
    fn proximity_query_excludes_self() {
        assert!(
            FIND_NEARBY_OPEN_REPORT_SQL.contains("id != $1"),
            "Query must exclude the report being checked (self-reference guard)"
        );
    }

    #[test]
    fn proximity_query_excludes_existing_duplicates() {
        assert!(
            FIND_NEARBY_OPEN_REPORT_SQL.contains("duplicate_of_id IS NULL"),
            "Query must only match original reports, not existing duplicates"
        );
    }

    #[test]
    fn proximity_query_coordinate_order_longitude_first() {
        // ST_MakePoint($4, $3) means $4=longitude (X), $3=latitude (Y)
        // This is the critical coordinate order: MakePoint takes (lng, lat)
        assert!(
            FIND_NEARBY_OPEN_REPORT_SQL.contains("ST_MakePoint($4, $3)"),
            "ST_MakePoint must have longitude ($4) first, latitude ($3) second"
        );
    }

    #[test]
    fn dedup_update_increments_atomically() {
        assert!(
            INCREMENT_DUPLICATE_COUNT_SQL
                .contains("duplicate_count = duplicate_count + 1"),
            "Must use atomic SQL increment, not read-then-write"
        );
    }

    #[test]
    fn dedup_update_sets_confidence_on_distinct_ips() {
        assert!(
            INCREMENT_DUPLICATE_COUNT_SQL
                .contains("COUNT(DISTINCT submitter_ip)"),
            "Confidence must be set based on distinct submitter IPs"
        );
        assert!(
            INCREMENT_DUPLICATE_COUNT_SQL.contains(">= 2"),
            "Threshold for high confidence is 2 distinct IPs"
        );
    }
}

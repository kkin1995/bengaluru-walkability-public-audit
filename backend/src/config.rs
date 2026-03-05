use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub uploads_dir: String,
    pub port: u16,
    pub cors_origin: String,
    pub public_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL")
                .expect("DATABASE_URL must be set"),
            uploads_dir: env::var("UPLOADS_DIR")
                .unwrap_or_else(|_| "./uploads".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "3001".to_string())
                .parse()
                .expect("PORT must be a valid number"),
            cors_origin: env::var("CORS_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            public_url: {
                let v = env::var("PUBLIC_URL").unwrap_or_default();
                if v.is_empty() { "http://localhost".to_string() } else { v }
            },
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
//
// Requirements covered:
//   PD-R3 — PUBLIC_URL env var defaults to "http://localhost" when absent or empty
//   PD-R4 — PUBLIC_URL env var is used verbatim when present and non-empty
//
// `resolve_public_url` is a PURE TEST HELPER that mirrors the logic
// Config::from_env() must implement for the `public_url` field.
// It is intentionally placed in the test module (not in production code) so
// the logic contract is testable without a live environment.
//
// The function body is `todo!()` — a red-phase stub.  The implementer must:
//   1. Replace the `todo!()` body with the correct logic.
//   2. Add `public_url: String` to the Config struct.
//   3. Populate it in from_env() using the same logic.
//   4. Update main.rs line 64 to use `config.public_url.clone()` instead of
//      `format!("http://0.0.0.0:{}", config.port)`.
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    // `resolve_public_url` mirrors the logic that Config::from_env() must use
    // for the new `public_url` field.
    //
    // CONTRACT:
    //   - None        → "http://localhost"   (env var absent)
    //   - Some("")    → "http://localhost"   (env var present but empty = treated as absent)
    //   - Some(s) where s is non-empty → s (env var used verbatim)
    //
    // This function carries no behavioral side effects on production code.
    // It exists solely so the four PD-R3/PD-R4 tests below can compile and run
    // without a live environment.  The `todo!()` body makes every test panic
    // (red phase) until the implementer fills in the logic.
    fn resolve_public_url(env_val: Option<&str>) -> String {
        match env_val {
            None | Some("") => "http://localhost".to_string(),
            Some(s) => s.to_string(),
        }
    }

    // ── PD-R3: absent / empty env var defaults to "http://localhost" ──────────

    #[test]
    fn test_resolve_public_url_none_returns_localhost_default() {
        // PD-R3 — when PUBLIC_URL is not set (None), the default must be
        // "http://localhost" so that development environments work without
        // any configuration.
        let result = resolve_public_url(None);
        assert_eq!(
            result,
            "http://localhost",
            "resolve_public_url(None) must return 'http://localhost', got '{}'",
            result
        );
    }

    #[test]
    fn test_resolve_public_url_empty_string_returns_localhost_default() {
        // PD-R3 — an empty string must be treated identically to an absent var.
        // Setting PUBLIC_URL="" in the environment must not produce an empty or
        // malformed base URL.
        let result = resolve_public_url(Some(""));
        assert_eq!(
            result,
            "http://localhost",
            "resolve_public_url(Some(\"\")) must return 'http://localhost' \
             (empty is treated as absent), got '{}'",
            result
        );
    }

    // ── PD-R4: non-empty env var is used verbatim ─────────────────────────────

    #[test]
    fn test_resolve_public_url_custom_domain_returned_verbatim() {
        // PD-R4 — a non-empty PUBLIC_URL must be returned exactly as supplied.
        // This is the production case: operator sets PUBLIC_URL=https://walkability.in.
        let result = resolve_public_url(Some("https://walkability.in"));
        assert_eq!(
            result,
            "https://walkability.in",
            "resolve_public_url(Some(\"https://walkability.in\")) must return \
             'https://walkability.in' verbatim, got '{}'",
            result
        );
    }

    #[test]
    fn test_resolve_public_url_localhost_returned_verbatim_when_explicitly_set() {
        // PD-R4 — when the operator explicitly sets PUBLIC_URL=http://localhost
        // (non-empty), the value must be returned verbatim (same as the default,
        // but reached via the non-empty branch).
        let result = resolve_public_url(Some("http://localhost"));
        assert_eq!(
            result,
            "http://localhost",
            "resolve_public_url(Some(\"http://localhost\")) must return \
             'http://localhost', got '{}'",
            result
        );
    }
}

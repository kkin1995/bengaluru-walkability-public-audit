use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub uploads_dir: String,
    pub port: u16,
    pub cors_origin: String,
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
        }
    }
}

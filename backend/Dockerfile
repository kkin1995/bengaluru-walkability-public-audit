# Stage 1: Build
FROM rust:1.88-slim-bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Cache dependencies by building a dummy main first
COPY Cargo.toml ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs
RUN cargo build --release 2>/dev/null || true
RUN rm -rf src

# Copy actual source and migrations
COPY src ./src
COPY migrations ./migrations

# Build the real binary (touch main.rs to invalidate cache)
RUN touch src/main.rs && cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim AS runtime

WORKDIR /app

# P1-4: Create a dedicated non-root system user so the process cannot write outside
# its own working directory even if a path-traversal bug exists in the upload handler.
RUN addgroup --system appuser && adduser --system --ingroup appuser appuser

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/server ./server
COPY --from=builder /app/migrations ./migrations

# P1-4: Create uploads dir and hand ownership to appuser BEFORE switching users,
# so the process can write photo files at runtime. The Docker volume mount at
# /app/uploads will inherit this ownership when the named volume is first created.
RUN mkdir -p /app/uploads && chown -R appuser:appuser /app/uploads

EXPOSE 3001

# P1-4: Drop root before starting the server process.
USER appuser

CMD ["./server"]

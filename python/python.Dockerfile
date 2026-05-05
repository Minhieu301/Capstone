# ── Stage 1: Builder ──────────────────────────────────────────────
FROM python:3.10-slim AS builder

WORKDIR /app

# Cài system dependencies cho Playwright + sentence-transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy và cài Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Cài Playwright Chromium (dùng cho crawler)
RUN playwright install chromium --with-deps

# ── Stage 2: Runtime ──────────────────────────────────────────────
FROM python:3.10-slim

WORKDIR /app

# Copy installed packages từ builder
COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy Playwright browser binary
COPY --from=builder /root/.cache /root/.cache

# Cài lại Playwright system deps (vào runtime image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Copy source code
COPY . .

# Tạo thư mục cho vector store và BM25 index
RUN mkdir -p vector_store/articles/chunks \
             vector_store/simplified \
             bm25_index

EXPOSE 5000

# Chạy Flask AI server
CMD ["python", "-m", "ai.app"]

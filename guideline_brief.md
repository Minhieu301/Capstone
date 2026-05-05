# ILAS — Tóm tắt nhanh (Business + Developer)

## A. Tóm tắt cho Business (chi tiết hơn)

- Mục tiêu: trả lời câu hỏi pháp lý dựa trên dữ liệu luật nội bộ (database + vector store). Hệ thống luôn tìm và dẫn chứng điều luật trước khi dùng LLM diễn giải.
- Luồng chính: Crawler → Database (versioned) → Retrieval (semantic + BM25 + topic boost) → Context Builder → LLM → Frontend.
- Đầu ra chuẩn:
  - `answer`: văn bản trả lời ngắn/gọn.
  - `source`: loại nguồn (article, simplified, FAQ, chunk).
  - `citations`: danh sách Điều/Khoản kèm `article_number` và `version_number`.
  - `fallback`: boolean, true nếu không có dữ liệu pháp lý đầy đủ.
- SLA & kỳ vọng: mục tiêu accuracy cao với citation khi retrieval tìm thấy context phù hợp; nếu `fallback=true` hiển thị cảnh báo rõ ràng.
- Khi cần escalate: nếu câu trả lời mâu thuẫn với văn bản gốc hoặc user yêu cầu tư vấn chính thức, route tới luật sư/PO.

## B. Tóm tắt cho Developer (thêm chi tiết kỹ thuật)

1) Cấu trúc chính
  - `backend/` — Java Spring app (API endpoints, config in `application.properties`).
  - `frontend/` — React (Vite) static app in `build/` for production.
  - `python/` — AI pipeline and tools: `ai/` (retrieval, build vectors), `crawler/` (scrapers), `rebuild_all.py`.
  - `crawler/` — Playwright jobs and content cleaners (`metadata_extractor.py`, `content_cleaner.py`).

2) Env vars & config (ví dụ cần kiểm tra/thiết lập)
  - `DB_URL`, `DB_USER`, `DB_PASS`
  - `LLM_API_KEY` (Gemini/Groq)
  - `RAG_VERBOSE` (debug logs)
  - `ADMIN_TOKEN` (admin API calls)
  - JVM/Node/Python versions tracked in `pom.xml`, `package.json`, `requirements.txt`.

3) Ports & health
  - Backend default port: kiểm tra `backend/src/main/resources/application.properties` (thường `server.port`, ví dụ 8080).
  - Frontend dev: Vite default 5173; production served via nginx in `frontend/nginx.conf`.
  - Health endpoints: check backend actuator or custom `/health` if available.

4) Quick run commands

```bash
# Docker (recommended for parity)
docker-compose build
docker-compose up -d

# Run backend locally
cd backend
./mvnw spring-boot:run   # Linux/macOS
mvnw.cmd spring-boot:run  # Windows

# Rebuild vectors/index (python)
python python/ai/rebuild_all.py

# Run crawler for a single URL
python crawler/run_crawl.py --url "https://..."

# Trigger rebuild via API
curl -X POST https://<host>/api/admin/rebuild -H "Authorization: Bearer <ADMIN_TOKEN>"
```

5) Example `POST /api/ask` payload & expected response

Request JSON:

```json
{
  "question": "Quyền nghỉ phép của người lao động là gì?",
  "options": { "max_length": 300 }
}
```

Example Response:

```json
{
  "answer": "Người lao động có quyền ... (tóm tắt)",
  "source": "articles",
  "citations": [ { "article_number": "123", "law_id": "LABOR_1", "excerpt": "..." } ],
  "fallback": false
}
```

6) Debugging & inspection
  - Nếu không có citation: kiểm tra `python/ai/retrieval_level6.py` logs and `context_builder.py` output to see if context chunks were retrieved.
  - Kiểm tra vector store (path `python/vector_store/`), xem file sizes and last-modified timestamps.
  - Backend logs: `backend/logs/`; Python logs: check `python/logs/` or stdout of container.
  - To reproduce crawler issues: run `python crawler/run_crawl.py --url <failing-url>` and increase Playwright timeout in `crawler/log_utils.py` or crawler config.

7) Tests & CI quick commands

```bash
# backend unit tests
cd backend && ./mvnw test

# frontend
cd frontend && npm ci && npm test

# python
pytest -q
```

8) Rebuild runbook (short)
  - Backup DB snapshot.
  - Run `python python/ai/rebuild_all.py` (monitor logs).
  - Smoke-check by calling `POST /api/ask` with known queries and verify `citations`.

## C. Security & Ops checklist (ngắn + thực tế)

- Store secrets in Vault / Azure Key Vault or use environment variables in orchestration; never commit keys.
- Limit access: rotate `ADMIN_TOKEN` regularly and audit calls to `/api/admin/rebuild`.
- Before major rebuild: create DB backup and notify stakeholders.

## D. Contacts & Next steps

- Add actual contacts: `Dev Lead` / `Infra` / `AI Owner` / `Product Owner` into `guidline.md` under Contacts.
- Tôi có thể tạo file `README_DEPLOY.md` với đầy đủ lệnh deploy và health-check scripts nếu muốn.

## D. Contacts & Next steps

- Điền thông tin `dev lead`, `infra`, `ai/data` owners vào `guidline.md` (phần Contacts).
- Nếu muốn, tôi có thể tạo thêm `README_DEPLOY.md` chi tiết cho ops.

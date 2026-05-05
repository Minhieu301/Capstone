# Guideline hệ thống ILAS

Tài liệu này dùng để nắm nhanh toàn bộ hệ thống ILAS, dựa trên phần giải thích trong file [Giải thích AI và Crawler.md](Giải%20thích%20AI%20và%20Crawler.md).

## 1. Tổng quan kiến trúc

ILAS được chia thành 4 lớp chính:

- **Crawler**: lấy dữ liệu luật từ website nguồn, làm sạch và lưu vào database.
- **Database**: lưu luật gốc, chương, mục, điều, FAQ và dữ liệu simplified.
- **AI Retrieval + LLM**: tìm đúng điều luật liên quan, ghép context và nhờ AI diễn giải lại.
- **Frontend**: nhận câu trả lời từ backend và hiển thị cho người dùng.

Luồng tổng thể:

Crawler -> Database -> AI Retrieval -> LLM -> Frontend

## 2. Luồng hoạt động tổng thể

Khi người dùng đặt câu hỏi, hệ thống không trả lời ngay theo kiến thức chung. Thay vào đó, nó đi theo chu trình sau:

1. Nhận câu hỏi từ frontend.
2. Tìm các điều luật liên quan nhất trong kho dữ liệu nội bộ.
3. Ghép context pháp lý đầy đủ từ database.
4. Gửi context cho LLM để diễn giải dễ hiểu.
5. Trả về câu trả lời có trích dẫn và fallback nếu cần.

Điểm quan trọng là câu trả lời của ILAS phải bám dữ liệu luật thật, không chỉ dựa vào suy đoán của mô hình.

## 3. Hệ thống AI

Thư mục `ai/` chịu trách nhiệm cho phần tìm kiếm và trả lời.

### 3.1 Nhận câu hỏi

Frontend gọi endpoint `/api/ask` trong `app.py`. Request có thể kèm cấu hình từ admin, ví dụ:

- bật hoặc tắt chatbot
- chọn nguồn dữ liệu ưu tiên
- chọn độ dài câu trả lời

### 3.2 Tìm kiếm điều luật liên quan

File `retrieval_level6.py` là trung tâm của quá trình retrieval. Nó kết hợp nhiều tín hiệu để tăng độ chính xác:

- **Semantic search**: tìm theo ý nghĩa câu hỏi.
- **BM25 keyword search**: tìm theo từ khóa xuất hiện trong nội dung luật.
- **Topic boost**: ưu tiên đúng nhóm chủ đề pháp luật.
- **Intent detection**: nhận biết ý định như nghỉ việc, sa thải, tiền lương, hợp đồng.

Cách làm này tốt hơn việc chỉ dò một từ khóa đơn lẻ, vì nó giảm lỗi bỏ sót và tăng khả năng chọn đúng điều luật cần thiết.

### 3.3 Cache và tối ưu tốc độ

Hệ thống có cache embedding theo `article_number`. Nếu một điều luật đã được xử lý trước đó, lần sau không cần tính lại từ đầu. Điều này giúp:

- giảm thời gian phản hồi
- tối ưu cho các câu hỏi lặp lại
- tăng hiệu quả khi người dùng hỏi cùng chủ đề nhiều lần

Ngoài ra, log debug retrieval có thể bật hoặc tắt bằng `RAG_VERBOSE` để tránh gây nhiễu khi chạy thật.

### 3.4 Ghép context pháp lý

Sau khi tìm được kết quả phù hợp, `context_builder.py` lấy nội dung đầy đủ từ database và ghép thành context rõ ràng. Mục tiêu là để LLM được cung cấp dữ liệu gốc trước khi sinh câu trả lời.

Cần nhớ hai nguyên tắc:

- context phải đủ giàu thông tin để AI trả lời đúng
- context phải được giới hạn độ dài để không làm chậm hệ thống hoặc vượt ngưỡng model

### 3.5 Sinh câu trả lời bằng LLM

File `legal_rag_pipeline.py` chọn provider AI theo cấu hình:

- **Gemini** qua `gemini_service.py` là mặc định
- **Groq** qua `groq_service.py` là phương án dự phòng

Hai provider đều dùng prompt pháp lý nghiêm ngặt, ưu tiên bám context và hạn chế suy diễn. Nếu Gemini gặp lỗi đã được nhận diện, pipeline có thể chuyển sang Groq để tránh gián đoạn trải nghiệm.

### 3.6 Kết quả trả về

Nếu hệ thống tìm được dữ liệu phù hợp, response sẽ gồm:

- `answer`: câu trả lời pháp lý dễ hiểu
- `source`: nguồn dữ liệu như articles, chunks, simplified, FAQ hoặc fallback
- `citations`: trích dẫn để người dùng kiểm chứng
- `fallback`: cho biết câu trả lời có phải từ dữ liệu luật hay chỉ là tham khảo

### 3.7 Cập nhật dữ liệu AI

Khi luật thay đổi, admin gọi `/api/admin/rebuild`. File `rebuild_all.py` sẽ chạy lại các bước build như:

- vector store cho chunks
- vector store cho simplified articles
- BM25 index
- topic clustering

Nhờ vậy kho tìm kiếm luôn phản ánh dữ liệu mới nhất.

## 4. Hệ thống tìm kiếm

Tìm kiếm trong ILAS không chỉ là search text thông thường. Nó là sự kết hợp của nhiều lớp:

- **Vector search** để hiểu ngữ nghĩa
- **BM25** để bắt từ khóa chính xác
- **Topic clustering** để gom các điều luật cùng chủ đề
- **Intent-aware ranking** để ưu tiên đúng nhóm pháp lý

Cách hiểu đơn giản:

- nếu người dùng hỏi bằng ngôn ngữ tự nhiên, semantic search sẽ giúp hiểu ý
- nếu người dùng dùng từ khóa rất cụ thể, BM25 sẽ kéo đúng điều luật
- nếu câu hỏi thuộc một chủ đề rõ ràng, topic boost sẽ tăng độ ưu tiên cho nhóm phù hợp

Nhờ đó, hệ thống có thể xử lý cả câu hỏi ngắn, câu hỏi dài, và câu hỏi dùng từ ngữ pháp lý không chuẩn.

## 5. Hệ thống Crawler

Thư mục `crawler/` chịu trách nhiệm lấy dữ liệu từ website nguồn, làm sạch và đưa vào database.

### 5.1 Tải HTML

Crawler dùng Playwright để mở trang web, chờ JavaScript render rồi lấy HTML đầy đủ.

### 5.2 Trích xuất metadata

File `metadata_extractor.py` đọc HTML và lấy các thông tin chính:

- tiêu đề văn bản
- số hiệu
- loại văn bản
- ngày ban hành
- ngày có hiệu lực

Nếu không tìm được trong bảng HTML, hệ thống có thể fallback bằng regex để vẫn lấy được thông tin cần thiết.

### 5.3 Làm sạch nội dung

File `content_cleaner.py` hợp nhất các dòng bị tách nhưng vẫn giữ cấu trúc pháp lý như:

- khoản
- điểm
- bullet
- danh sách điều mục

Đây là bước rất quan trọng, vì nếu làm sạch quá tay thì có thể làm mất cấu trúc pháp lý của văn bản.

### 5.4 Lưu version và archive dữ liệu cũ

File `archive_cleanup.py` xử lý phiên bản cũ bằng cách:

- archive bản cũ với `status='archived'`
- cascade xuống chapters, sections, articles, simplified
- xóa cứng các version quá cũ, chỉ giữ lại 5 version mới nhất

Cơ chế này giúp hệ thống không bị rối dữ liệu và vẫn giữ được lịch sử thay đổi quan trọng.

### 5.5 Insert vào database

File `db_inserts.py` chèn dữ liệu theo thứ tự:

1. chapters
2. sections
3. articles

Mỗi lần crawl, `version_number` được cập nhật tự động. Hệ thống cũng kiểm tra độ dài dữ liệu để tránh lỗi kiểu “Data too long”.

### 5.6 Đảm bảo không nhầm điều luật giữa các bộ luật

Đây là một nguyên tắc quan trọng của crawler:

- mỗi bản ghi đều gắn với `law_id` riêng
- `law_id` và `version_number` được kiểm tra khi insert
- foreign key giúp ràng buộc đúng quan hệ cha-con giữa law, chapter, section và article
- crawler luôn cascade theo đúng `law_id` hiện tại, không reuse ID của luật khác

Nhờ đó dữ liệu không bị lẫn giữa các bộ luật.

### 5.7 Logging và entry point

File `log_utils.py` ghi log theo timestamp để dễ theo dõi tiến trình.

Hai entry point chính là:

- `run_crawl_api.py`: chạy ở chế độ CLI, trả mã thoát 0/1/2
- `run_crawl.py`: chạy ở chế độ tương tác

Sau khi crawl xong, hệ thống sẽ trigger `rebuild_all.py` để AI có thể search trên dữ liệu mới.

## 6. Cách đọc hệ thống cho người mới

Nếu muốn hiểu nhanh ILAS, hãy nhớ thứ tự sau:

1. **Crawler** lấy dữ liệu luật từ nguồn bên ngoài.
2. **Database** lưu dữ liệu đã chuẩn hóa và versioned.
3. **AI Retrieval** tìm đúng điều luật liên quan.
4. **LLM** diễn giải lại theo ngôn ngữ dễ hiểu.
5. **Frontend** hiển thị kết quả cho người dùng.

Nói ngắn gọn, AI của ILAS không tự bịa câu trả lời từ đầu. Nó đi tra luật trước, rồi mới diễn giải lại dựa trên dữ liệu đã tìm được.

## 7. Ghi nhớ quan trọng

- Crawler là đầu vào của toàn hệ thống.
- Retrieval quyết định chất lượng câu trả lời.
- LLM chỉ là lớp diễn giải cuối cùng.
- Rebuild phải chạy sau khi có dữ liệu luật mới.
- Version và `law_id` là hai yếu tố quan trọng để tránh nhầm dữ liệu.

## 8. Tài liệu liên quan

- [Giải thích AI và Crawler.md](Giải%20thích%20AI%20và%20Crawler.md)

## 9. Security & Privacy

- **Authentication & Authorization:** dùng `role-based access` cho API admin; hạn chế quyền để chỉ admin có thể gọi `/api/admin/rebuild`.
- **Secrets management:** lưu API keys (LLM keys, DB creds) trong secret store (Vault, Azure Key Vault) hoặc env vars trên host; không commit keys vào Git.
- **Encryption:** dữ liệu nhạy cảm mã hóa khi lưu trữ (at-rest) và dùng TLS (HTTPS) cho truyền tin (in-transit).
- **PII handling:** xác định và mask/ẩn PII trong nội dung khi cần, log minimal và hạn chế truy cập.
- **Audit & Access Logs:** ghi lại ai gọi API nào (user/admin), timestamp, và ID request để truy nguyên.

## 10. Deployment & Run

- **Services:** backend (Java Spring), frontend (React/Vite), python AI/crawler services.
- **Env vars:** quản lý `APPLICATION_PROPERTIES`, `DB_URL`, `LLM_API_KEY`, `RAG_VERBOSE`.
- **Docker:** hệ thống có `backend.Dockerfile`, `frontend.Dockerfile`, `python.Dockerfile` và `docker-compose.yml` ở root.

Example (local dev):

```bash
docker-compose build
docker-compose up -d
```

- **Versions:** ghi rõ JVM/Python/Node versions trong docs; kiểm tra `pom.xml` và `package.json` để biết dependency chính.

## 11. Maintenance & Rebuild runbook

1. Khi thêm/bổ sung luật, chạy rebuild vector/index:

```bash
# nếu dùng API
curl -X POST https://<host>/api/admin/rebuild -H "Authorization: Bearer <ADMIN_TOKEN>"

# hoặc chạy trực tiếp trong container/python env
python python/ai/rebuild_all.py
```

2. Lên lịch rebuild theo policy (ví dụ: nightly hoặc khi có cập nhật lớn).
3. Trước rebuild: backup DB snapshot.
4. Sau rebuild: kiểm tra health endpoints và sample queries.

## 12. Monitoring, Logging & Alerts

- **Metrics to collect:** request latency, error rate (5xx), retrieval hit/miss rate, crawler success rate, queue/backlog size, embedding time.
- **Logging:** tập trung logs (ELK/CloudWatch) với correlation id cho mỗi request.
- **Alerting:** dùng Prometheus + Grafana hoặc dịch vụ tương đương; đặt cảnh báo cho error rate > X% hoặc crawler thất bại liên tục.

## 13. Troubleshooting & Runbook

- **Crawler timeouts / Playwright errors:** tăng timeout, kiểm tra network, re-run `run_crawl.py` cho URLs gặp lỗi.
- **Embedding/index failures:** xem log của `build_vector_store_*`, chạy lại chunking cho `article_number` bị lỗi.
- **LLM provider errors:** kiểm tra API key/quota; tạm chuyển provider (Gemini ↔ Groq); thả lại fallback nếu provider down.
- **DB errors:** xem migration scripts, kiểm tra foreign keys, dùng DB logs để xác định câu lệnh lỗi.

## 14. Data Schema & DB mapping (tổng quát)

- Bảng chính: `law` (law_id, title, version_number), `chapter`, `section`, `article` (article_number, content), `simplified_articles`.
- Khóa liên kết: `law_id` → `chapter_id` → `section_id` → `article_id`.
- Các trường quan trọng: `article_number`, `version_number`, `content`, `created_at`, `source_url`, `status`.

## 15. Testing, CI/CD & QA

- **Backend:** dùng `mvn test` để chạy unit/integration tests.
- **Frontend:** `npm install` rồi `npm test` và `npm run build` cho production build.
- **Python services:** có thể có pytest; kiểm tra `python/requirements.txt`.
- **CI:** pipeline nên gồm lint → unit tests → build artifacts → deploy staging → run upgrade/rebuild smoke test.

## 16. Performance & Scaling

- **Caching:** cache embedding và query results theo `article_number` hoặc query-hash.
- **Horizontal scaling:** tách crawler, embedding workers, và API thành services độc lập có queue (RabbitMQ/Kafka) để scale.
- **Batching:** chạy rebuild/index theo batch để giảm tải bộ nhớ.

## 17. Backup & Data Retention

- **Backup frequency:** tối thiểu daily DB backup; keep snapshots theo policy (e.g., 30/90/365 ngày).
- **Retention:** giữ 5 version mới nhất cho mỗi law (hiện hệ thống đã áp dụng).
- **Restore:** document restore steps và test restore thường xuyên.

## 18. Compliance & Legal Notes

- **Audit trail:** mọi trích dẫn và nguồn phải có provenance để chứng minh.
- **User disclaimer:** hiển thị ghi chú “Không phải tư vấn pháp lý; tham khảo luật và chuyên gia” khi cần.

## 19. Glossary & Contacts

- **Glossary:** định nghĩa ngắn cho `retrieval`, `RAG`, `BM25`, `vector store`, `chunk`, `simplified article`.
- **Contacts:** liệt kê: `dev lead`, `infra`, `data/ai` và `product owner` cùng email/Slack handle (điền chi tiết nội bộ).

---

Nếu muốn, tôi có thể:
- rút gọn thành bản dành cho developer hoặc cho business;
- tạo `README` triển khai nhanh tại root để ops dùng (với commands và checklists).

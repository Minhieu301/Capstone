# 📚 Phân Tích Chi Tiết Các File AI & Crawler

**Ngày tạo:** 09/04/2026  
**Version:** 1.1  
**Mục đích:** Giải thích chức năng từng file và các dòng code quan trọng

---

## 🆕 Cập Nhật Mới Nhất

- `gemini_service.py` đã đồng bộ cách gọi với `groq_service.py`: tách `system` và `user`, có `fallback_general_answer()` và `rewrite_legal_query()`.
- `context_builder.py` không còn khóa cứng `law_id = 1` khi tra theo số điều, mà có fallback query rộng hơn nếu bản ghi ưu tiên không có.
- `crawl_law.py` đã chuyển sang `wait_until="domcontentloaded"` và retry nhẹ hơn để giảm timeout khi crawl các trang luật lớn.
- `db_inserts.py` đã truncate an toàn `chapter_number`, `section_number`, `article_number` để tránh lỗi `Data too long`.
- `AdminCrawlerController.java` đã tự resolve workdir và ưu tiên chạy Python trong `.venv` của ILAS để giảm lỗi 500 khi crawl.

---

## 📂 PHẦN 1: Thư Mục `ai/` - Xử Lý RAG (Retrieval-Augmented Generation) & AI

### 1️⃣ **`__init__.py`**
- **Chức năng:** File package initialization (trống)
- **Dòng quan trọng:** N/A
- **Mô tả:** Đánh dấu thư mục `ai` là Python package

---

### 2️⃣ **`app.py`** - Main Flask Server
- **Chức năng:** Khởi động Flask API server với 2 endpoint chính
- **Dòng quan trọng:**
  ```python
  # Line 5: Flask app initialization
  app = Flask(__name__)
  CORS(app)
  
  # Line 11-12: Endpoint nhận câu hỏi từ frontend + settings
  @app.route("/api/ask", methods=["POST"])
  def ask():
      settings = data.get("settings", {})  # Nhận cấu hình từ backend
  
  # Line 21: Gọi hàm RAG pipeline chính
  result = answer_legal_question(question, settings)
  
  # Line 37: Endpoint rebuild models (chạy background job)
  @app.route("/api/admin/rebuild", methods=["POST"])
  subprocess.Popen(["python", "ai/rebuild_all.py"])
  
  # Line 48: Chạy server trên port 5000
  app.run(host="0.0.0.0", port=5000, debug=False)
  ```
- **Mô tả:**
  - `/api/ask` - Nhận câu hỏi pháp lý + settings, trả lời
  - `/api/admin/rebuild` - Rebuild vector store, BM25, topic clusters

---

### 3️⃣ **`bm25_index.py`** - BM25 Keyword Search
- **Chức năng:** Xây dựng và sử dụng BM25 index (tìm kiếm từ khóa)
- **Dòng quan trọng:**
  ```python
  # Line 24-25: Tokenize text (chia từ)
  def tokenize(text: str) -> List[str]:
      return (text or "").lower().split()
  
  # Line 44-45: Dùng tên file an toàn thay vì path dài
  safe = source.replace("/", "_")
  return INDEX_DIR / f"{safe}_bm25.pkl"
  
  # Line 66-67: Xây dựng BM25 từ corpus
  bm25 = BM25Okapi(corpus_tokens)
  pickle.dump({"bm25": bm25, "ids": ids}, f)
  
  # Line 84-87: Tìm kiếm BM25
  tokens = tokenize(query)
  scores = bm25.get_scores(tokens)
  ranked = sorted(zip(ids, scores), key=lambda x: x[1], reverse=True)[:top_k]
  ```
- **Mô tả:**
  - Cung cấp tìm kiếm từ khóa nhanh (BM25 algorithm)
  - Hỗ trợ 4 nguồn: articles, articles/chunks, faq, simplified
  - Trả về top-k document IDs với điểm số cao nhất

---

### 4️⃣ **`build_vector_store_chunks.py`** - Xây Vector Store Chunks Level
- **Chức năng:** Chia nội dung luật thành chunks nhỏ (khoản/điểm) → embedding
- **Dòng quan trọng:**
  ```python
  # Line 10-11: Chia theo khoản (1.), điểm (a), b), c), đ)
  def split_into_chunks(text):
      parts = re.split(r"(?=(\d+\.\s+|[a-zđ]\)\s+))", text, flags=re.IGNORECASE)
  
  # Line 28: Loại bỏ chunk quá ngắn (< 25 ký tự)
  chunks = [c for c in chunks if len(c.strip()) > 25]
  
  # Line 33-36: Trích xuất số khoản (1, 2, 3...)
  def extract_clause_number(chunk_text):
      m = re.match(r"(\d+)\.\s+", chunk_text)
  
  # Line 50-53: Lấy bài viết từ DB
  cur.execute("""
      SELECT article_id, article_number, article_title, content
      FROM articles WHERE status='active'
  """)
  
  # Line 68-70: Embedding chunk
  emb = get_local_embedding(chunk_text)
  vectors.append(emb)
  metadata.append({...})
  ```
- **Mô tả:**
  - Thực hiện chunking chuẩn cho luật Việt Nam (tách khoản, điểm)
  - Mỗi chunk được embedding → vector 384-dim
  - Lưu vào `vector_store/articles/chunks/` (level 4 chính xác)

---

### 5️⃣ **`build_vector_store_faq.py`** - Xây Vector Store FAQ
- **Chức năng:** Embedding các câu hỏi-đáp FAQ
- **Dòng quan trọng:**
  ```python
  # Line 10-15: Lấy FAQ từ DB
  cur.execute("""
      SELECT faq_id, question, answer, category FROM faq
  """)
  
  # Line 25: Ghép câu hỏi + đáp vào 1 text để embedding
  text = f"Q: {item['question']}\nA: {item['answer']}"
  emb = get_local_embedding(text)
  
  # Line 32-36: Lưu metadata
  meta.append({
      "id": f"faq_{item['faq_id']}",
      ...
  })
  ```
- **Mô tả:**
  - Xây vector store cho FAQ database
  - Mỗi FAQ item = 1 embedding

---

### 6️⃣ **`build_vector_store_simplified.py`** - Xây Vector Store Simplified
- **Chức naung:** Embedding các bản rút gọn luật (dễ hiểu)
- **Dòng quan trọng:**
  ```python
  # Line 10-15: Lấy bản rút gọn từ DB
  cur.execute("""
      SELECT simplified_id, article_id, content_simplified, category
      FROM simplified_articles WHERE status='approved'
  """)
  
  # Line 25: Lấy nội dung rút gọn
  text = item["content_simplified"]
  emb = get_local_embedding(text)
  ```
- **Mô tả:**
  - Xây vector store cho bản rút gọn đơn giản hóa
  - Lưu vào `vector_store/simplified/`

---

### 7️⃣ **`context_builder.py`** - Xây Dựng Context Từ Search Results
- **Chức naung:** Lấy bài viết đầy đủ từ kết quả tìm kiếm để làm context cho LLM
- **Dòng quan trọng:**
  ```python
  # Line 5-12: Lấy bài viết đầy đủ từ article_number
  def load_full_article(article_number: str) -> str:
      cur.execute("""
          SELECT article_title, content FROM articles
          WHERE article_number = %s LIMIT 1
      """)
  
  # Line 18-24: Kiểm tra source có hợp lệ không
  def build_context(results):
      top = results[0]
      if top.get("source") not in ["articles", "articles/chunks"]:
          return None  # Bỏ FAQ, simplified → chỉ dùng luật chính thức
  
  # Line 26-31: Lấy article_number từ search result
  article_number = top.get("article_number")
  full_article = load_full_article(article_number)
  ```
- **Mô tả:**
  - Chỉ chấp nhận context từ "articles" hoặc "articles/chunks" (thực pháp)
  - Lấy nội dung đầy đủ (không dùng chunk nhỏ) để gửi cho LLM
  - Đảm bảo tính xác thực legal

---

### 8️⃣ **`groq_service.py`** - Gọi API Groq LLM
- **Chức naung:** Gửi request tới Groq LLM API + parse response
- **Dòng quan trọng:**
  ```python
  # Line 11-13: Cấu hình API Groq
  API_URL = "https://api.groq.com/openai/v1/chat/completions"
  API_KEY = os.getenv("GROQ_API_KEY")
  model = "llama-3.1-8b-instant"
  
  # Line 33-45: Gửi request + xử lý JSON response
  res = requests.post(API_URL, headers=headers, json=data, timeout=40)
  j = res.json()
  content = j["choices"][0].get("message", {}).get("content", "").strip()
  
  # Line 60-65: Ép kiểu an toàn (FE gửi "0.7" string → float)
  temperature = float(temperature)  # fallback 0.15 nếu lỗi
  max_tokens = int(max_tokens)      # fallback 900 nếu lỗi
  
  # Line 67-90: System prompt nghiêm ngặt (chỉ dùng context)
  system_prompt = """
  1. NGUỒN DUY NHẤT: Chỉ dùng info trong "NGỮ CẢNH PHÁP LUẬT"
  2. TRÍCH DẪN: Phải trích Điều/Khoản đúng
  3. KHÔNG BỊA: Không thêm quy định ngoài context
  ```
- **Mô tả:**
  - Gọi Groq Llama-3.1-8B model
  - System prompt ép LLM tuân thủ luật pháp
  - Xử lý error gracefully (return fallback message)

### 8️⃣-1 **`gemini_service.py`** - Gọi API Gemini LLM
- **Chức năng:** Gửi request tới Gemini API + parse response, giữ contract tương tự Groq để có thể thay thế qua lại dễ dàng
- **Dòng quan trọng:**
  ```python
  # Load .env từ project root
  env_path = Path(__file__).parent.parent.parent / ".env"

  # Tách system/user message và ghép payload đúng format Gemini
  system_parts = []
  user_parts = []

  # Có system_instruction riêng, contents chỉ chứa user message
  payload["system_instruction"] = {
      "parts": [{"text": "\n\n".join(system_parts)}]
  }

  # Prompt vẫn giữ giọng ILAS: xưng tôi, gọi bạn, chỉ dùng context
  def guarded_completion(...):
      ...

  # Có thêm fallback general answer và rewrite query
  def fallback_general_answer(question: str) -> str:
      ...
  def rewrite_legal_query(user_question: str) -> str:
      ...
  ```
- **Mô tả:**
  - Gemini đã đồng bộ style với Groq, hạn chế trả lời lệch format
  - Có fallback chung và hàm tối ưu query giống Groq
  - Hỗ trợ nhiều model fallback qua `GEMINI_FALLBACK_MODELS`

---

### 9️⃣ **`legal_rag_pipeline.py`** - Main RAG Pipeline (Level 8)
- **Chức nauung:** Orchestrate toàn bộ quy trình: retrieve → context → LLM → response
- **Dòng quan trọng:**
  ```python
  # Line 8: Hàm chính nhận query + settings từ admin
  def answer_legal_question(query: str, settings: dict = None):
  
  # Line 10-16: Kiểm tra admin disable bot
  if settings.get("enabled") is False:
      return {"answer": "⚠️ Chatbot hiện bị tạm thời vô hiệu hóa"}
  
  # Line 22-25: Delay config từ admin (test slow response)
  delay = settings.get("responseDelay", 0)
  if isinstance(delay, (int, float)) and delay > 0:
      time.sleep(delay / 1000)
  
  # Line 27: Filter theo data source (all/articles/faq/simplified)
  source_filter = settings.get("dataSource", "all")
  
  # Line 31: Gọi retrieval multi-source
  results = retrieve_multi_source(query, source_filter=source_filter)
  
  # Line 41-50: Nếu retrieval fail → fallback general answer
  if not results:
      fb = fallback_general_answer(query)
      return {"answer": fb, "source": "fallback", "fallback": True}
  
  # Line 53: Xây full article context
  context = build_context(results)
  
  # Line 62-65: Gọi LLM với temperature + max_tokens từ admin
  answer = guarded_completion(
      context=context,
      question=query,
      temperature=float(temperature),
      max_tokens=int(max_tokens)
  )
  ```
- **Mô tả:**
  - Pipeline chính Level 8 (đầy đủ)
  - Hỗ trợ admin settings: enabled, responseDelay, dataSource, temperature, maxTokens
  - Fallback gracefully nếu retrieval/context fail
  - Update mới: fallback message đã báo đúng provider (Groq/Gemini), và có thể bật `rewrite_legal_query()` trước retrieval nếu cần

---

### 🔟 **`legal_topic_boost.py`** - Boost Điểm Lao Động
- **Chức nauung:** Score boost/penalty dựa trên topic (lao động hoặc không)
- **Dòng quan trọng:**
  ```python
  # Line 5-19: Danh sách keyword lao động
  LABOR_KEYWORDS = [
      "người lao động", "hợp đồng", "lương", "phép năm", 
      "bảo hiểm", "sa thải", ...
  ]
  
  # Line 33-34: Nếu câu hỏi KHÔNG lao động → score âm mạnh (-1.2)
  if not is_labor_question(query_l):
      return -1.2  # Tránh match nhầm
  
  # Line 38-45: Nếu là lao động → score dương (0.40 nếu match topic)
  for topic_name, keywords in topics.items():
      if any(k in query_l for k in keywords):
          if any(k in text_l for k in keywords):
              score += 0.40  # Match tốt
  ```
- **Mô tả:**
  - Boost search results dựa trên topic lao động
  - Tránh confusion với chủ đề khác
  - Được gọi trong retrieval phase

---

### 1️⃣1️⃣ **`local_embedder.py`** - Embedding Model Local
- **Chức nauung:** Load sentence transformer model + encoding text → vector
- **Dòng quan trọng:**
  ```python
  # Line 5-6: Load model multilingual-e5-base (384-dim)
  MODEL_NAME = "intfloat/multilingual-e5-base"
  model = SentenceTransformer(MODEL_NAME)
  
  # Line 10-18: Clean text trước embed (loại Điều/Khoản prefix)
  def clean_text(text: str) -> str:
      text = re.sub(r"Điều\s+\d+\.?", "", text)
      text = re.sub(r"Khoản\s+\d+\.?", "", text)
  
  # Line 22-25: Embedding 1 câu
  def get_local_embedding(text: str) -> np.ndarray:
      vec = model.encode([text], normalize_embeddings=True)[0]
      return np.asarray(vec, dtype=np.float32)
  
  # Line 28-37: Embedding batch (hiệu quả hơn)
  def embed_texts(texts: list[str]) -> np.ndarray:
      vecs = model.encode(cleaned, batch_size=16, normalize_embeddings=True)
      return np.asarray(vecs, dtype=np.float32)
  ```
- **Mô tả:**
  - Model multilingual (tiếng Việt OK)
  - Vector 384-chiều normalized (cosine similarity)
  - Clean text remove Điều/Khoản  prefix

---

### 1️⃣2️⃣ **`rebuild_all.py`** - Rebuild All Models
- **Chức nauung:** Script rebuild toàn bộ vector store, BM25, topic clusters
- **Dòng quan trọng:**
  ```python
  # Line 11-16: Rebuild 3 vector stores
  run("python -m ai.build_vector_store_chunks")
  run("python -m ai.build_vector_store_faq")
  run("python -m ai.build_vector_store_simplified")
  
  # Line 18: Rebuild BM25 index
  run("python -m ai.bm25_index")
  
  # Line 20: Rebuild topic clusters
  run("python -m ai.topic_cluster_builder")
  ```
- **Mô tả:**
  - Script được gọi bằng `/api/admin/rebuild` endpoint
  - Chạy background subprocess
  - Rebuild toàn bộ hệ thống indexing

---

### 1️⃣3️⃣ **`retrieval_level6.py`** - Multi-Source Retrieval (Hybrid)
- **Chức nauung:** Tìm kiếm đa source: BM25 + vector semantic + topic boost
- **Dòng quan trọng:**
  ```python
  # Line 18-23: Phát hiện article number từ query (nếu user viết "Điều 35")
  def detect_article_number(query: str):
      m = re.search(r"điều\s+(\d+)", query.lower())
      if m:
          return m.group(1)
  
  # Line 28-45: Intent routing (ánh xạ intent → articles)
  INTENT_TO_ARTICLES = {
      "nghi_viec": [35, 36, 48, 56],
      "sa_thai": [125],
      "nghi_le": [112],
      ...
  }
  
  # Line 48-68: Detect intent từ keywords
  def detect_intent(query: str):
      if any(k in q for k in ["nghỉ việc", "nghi viec"]):
          return "nghi_viec"
  
  # Line 75-85: Load vector store từ file
  def load_source(name: str):
      vectors = np.load(vec_path)
      meta = json.load(meta_path)
  
  # Line 90+: Hybrid scoring: BM25 + semantic vector + topic boost
  # Tính điểm từ 3 source, normalize, combine
  ```
- **Mô tả:**
  - Hybrid retrieval: BM25 + semantic + intent routing
  - Detect article number trực tiếp từ query (ếu user biết)
  - Intent → article mapping (lao động → Điều 35, 36...)
  - Topic boost tránh cross-topic confusion

---

### 1️⃣4️⃣ **`topic_cluster_builder.py`** - Xây Topic Clusters
- **Chức nauung:** KMeans clustering trên vectors → gán topic cluster ID
- **Dòng quan trọng:**
  ```python
  # Line 7-11: Hỗ trợ 4 sources (thêm chunks)
  SUPPORTED_SOURCES = [
      "articles",
      "articles/chunks",  # NEW
      "faq",
      "simplified"
  ]
  
  # Line 39-42: Tính số cluster thông minh (tùy dataset size)
  def _determine_cluster_count(num_samples, base_clusters=8):
      if num_samples < 5:
          return 1
      if num_samples > 10000:
          return 16
  
  # Line 58-62: KMeans clustering
  kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init="auto")
  labels = kmeans.fit_predict(vectors)
  
  # Line 64-65: Gán cluster ID vào metadata
  for item, label in zip(meta, labels):
      item["topic_cluster"] = int(label)
  
  # Line 72-73: Save centroids
  np.save(centroids_path, kmeans.cluster_centers_)
  ```
- **Mô tả:**
  - KMeans clustering trên vectors
  - Gán topic cluster ID cho mỗi document
  - Centroids được dùng trong retrieval để search trong cluster
  - Smart cluster count: từ 1 (nhỏ) → 16 (>10K)

---

---

## 📂 PHẦN 2: Thư Mục `crawler/` - Web Crawling & Data Insertion

### 1️⃣ **`__init__.py`**
- **Chức nauung:** Package initialization (trống)
- **Dòng quan trọng:** N/A

---

### 2️⃣ **`archive_cleanup.py`** - Archive Dữ Liệu Cũ
- **Chức nauung:** Soft-delete (archive) dữ liệu phiên bản cũ, thực hiện cascading delete
- **Dòng quan trọng:**
  ```python
  # Line 2-20: Archive các luật khác (keep 1 luật active)
  def archive_other_laws(cur, law_id):
      cur.execute("""
          UPDATE laws SET status='archived'
          WHERE law_id != %s AND status = 'active'
      """)
      # Cascade: archive chapters, sections, articles
  
  # Line 24-56: Archive version cũ của luật hiện tại
  def archive_old_data(cur, law_id):
      cur.execute("""
          UPDATE articles SET status='archived'
          WHERE law_id=%s AND status='active'
      """)
      # Cascade: simplified -> sections -> chapters archived
  
  # Line 59-88: Hard-delete các bản ghi cũ (keep 5 mới nhất)
  def cleanup_versions(cur, keep_last=5):
      cur.execute(f"""
          SELECT law_id, version_number FROM law_versions
          ORDER BY crawled_at DESC LIMIT {keep_last}
      """)
      # Xóa cứng tất cả ngoài top 5 mới nhất
  ```
- **Mô tả:**
  - `archive_other_laws`: Keep 1 luật active, archive phần còn lại
  - `archive_old_data`: Archive phiên bản cũ của luật hiện tại
  - `cleanup_versions`: Hard-delete phiên bản quá cũ (keep 5 mới)
  - Cascading updates: laws → chapters → sections → articles → simplified

---

### 3️⃣ **`content_cleaner.py`** - Chuẩn Hóa Nội Dung
- **Chức nauung:** Clean HTML artifacts, preserve legal structure (khoản, điểm)
- **Dòng quan trọng:**
  ```python
  # Line 6-30: Normalize article content
  def normalize_article_content(raw_text):
      lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
      cleaned = []
      buffer = ""
      
      # Line 11-15: Phát hiện section mới (1., a), -, •)
      def is_new_section(line):
          return (
              re.match(r"^\d+[\.\)]", line) or
              re.match(r"^[a-zA-Z][\.\)]", line) or
              line.startswith("- ") or
              line.startswith("•")
          )
      
      # Line 19-25: Gộp dòng bị xuống dòng, giữ section breaks
      for line in lines:
          if is_new_section(line):
              if buffer:
                  cleaned.append(buffer.strip())
              buffer = line
          else:
              buffer += " " + line
  ```
- **Mô tả:**
  - Gộp dòng bị split do HTML parsing
  - Giữ nguên structure pháp lý (khoản, điểm, bullet)
  - Xóa whitespace thừa

---

### 4️⃣ **`crawl_law.py`** - Main Crawler Logic
- **Chức nauung:** Crawl trang web thuvienphapluat → parse → insert DB
- **Dòng quan trọng:**
  ```python
  # Line 20-22: Dùng Playwright (headless = không mở browser)
  with sync_playwright() as p:
      browser = p.chromium.launch(headless=True)
      page.goto(url, wait_until="domcontentloaded", timeout=60000)
      page.wait_for_timeout(4000)  # Chờ JS render
  
  # Line 28-30: Parse metadata từ HTML
  title, code, law_type, issued_date, effective_date = extract_metadata(soup)
  
  # Line 33: Tìm tất cả đoạn nội dung (div#ctl00_Content...pnlDocContent p)
  all_p = soup.select("div#ctl00_Content_ThongTinVB_pnlDocContent p")
  
  # Line 46-53: Lấy hoặc tạo luật mới
  cur.execute("""
      SELECT law_id, version_number FROM laws WHERE code=%s ORDER BY law_id ASC LIMIT 1
  """)
  if row:
      law_id = row["law_id"]
      version_number = int(row.get("version_number") or 0) + 1
  else:
      version_number = 1
  
  # Line 66+: Archive dữ liệu cũ, insert chapter/section/article mới
  archive_old_data(cur, law_id)
  insert_chapter(cur, law_id, chapter_num, chapter_title, version_number)
  ```
- **Mô tả:**
  - Dùng Playwright (handle JS rendering)
  - Đã giảm timeout chờ trang bằng cách không đợi `load` quá gắt
  - Parse với BeautifulSoup
  - Extract metadata: title, code, type, dates
  - Version incrementing (Auto +1)
  - Cascading insert: chapters → sections → articles

---

### 5️⃣ **`db_inserts.py`** - Insert Functions
- **Chức nauung:** Helper functions để insert chapters, sections, articles vào DB
- **Dòng quan trọng:**
  ```python
  # Update mới: truncate an toàn để khớp schema DB hiện tại
  def _truncate(value, max_len):
    if value is None:
      return None
    text = str(value).strip()
    return text[:max_len]

  # Line 1-10: Insert chapter
  def insert_chapter(cur, law_id, number, title, version_number):
    number = _truncate(number, 10)
    title = _truncate(title, 255)
      cur.execute("""
          INSERT INTO chapters (law_id, chapter_number, chapter_title, version_number, status)
          VALUES (%s,%s,%s,%s,'active')
      """, (law_id, number, title, version_number))
  
  # Line 14-22: Insert section
  def insert_section(cur, chapter_id, number, title, version_number):
      number = _truncate(number, 10)
      title = _truncate(title, 255)
      cur.execute("""
          INSERT INTO sections (chapter_id, section_number, section_title, version_number, status)
          VALUES (%s,%s,%s,%s,'active')
      """)
  
  # Line 26-35: Insert article (chính)
  def insert_article(cur, law_id, chapter_id, section_id, number, title, content, version_number):
      number = _truncate(number, 50)
      title = _truncate(title, 500)
      cur.execute("""
          INSERT INTO articles (law_id, chapter_id, section_id, article_number, 
                                article_title, content, version_number, status)
          VALUES (%s,%s,%s,%s,%s,%s,%s,'active')
      """)
  
  # Line 37-50: Fallback nếu created_at không có default
  except Exception as exc:
      if "created_at" not in str(exc).lower():
          raise
      # Add created_at=NOW()
  ```
- **Mô tả:**
  - Chuỗi insert dependency: chapters → sections → articles
  - Truncate an toàn để tránh lỗi `Data too long` khi crawl các chương/mục viết bằng số La Mã dài
  - Fallback nếu created_at không có default value

---

### 6️⃣ **`db.py`** - Database Connection
- **Chức nauung:** Wrapper cho database connection
- **Dòng quan trọng:**
  ```python
  # Line 5-6: Import sys path để lấy db_core từ cha
  sys.path.append(str(Path(__file__).resolve().parents[1]))
  from db_core import get_connection, execute_query
  
  # Line 8-9: Backward compatible wrapper
  def get_db_connection():
      return get_connection()
  ```
- **Mô tả:**
  - Wrapper compatibility
  - Dùng `db_core.py` từ thư mục cha

---

### 7️⃣ **`log_utils.py`** - Logging Helper
- **Chức nauung:** In log có timestamp
- **Dòng quan trọng:**
  ```python
  # Line 4-5: In log với timestamp
  def log_step(message: str):
      ts = datetime.now().strftime("%H:%M:%S")
      print(f"[{ts}] {message}", flush=True)
  ```
- **Mô tả:**
  - Simple logging utility
  - Format: `[HH:MM:SS] message`

---

### 8️⃣ **`metadata_extractor.py`** - Extract Metadata từ HTML
- **Chức nauung:** Parse metadata từ HTML table (tiêu đề, mã, loại, ngày ban hành...)
- **Dòng quan trọng:**
  ```python
  # Line 6-21: Safe parse ngày (múi format)
  def safe_date(date_str):
      fmts = ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d.%m.%Y")
      for fmt in fmts:
          try:
              return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
          except ValueError:
              continue
      # Fallback: regex match (d/m/Y)
  
  # Line 24-46: Extract metadata từ HTML
  def extract_metadata(soup):
      info_table = soup.select_one("table.table-info, div#ctl00_...")
      meta_info = {}
      for r in info_table.select("tr"):
          tds = r.select("td")
          meta_info[tds[0].get_text()] = tds[1].get_text()
      
      # Title từ h1 tag + cleanup
      title_tag = soup.select_one("h1")
      title = title_tag.get_text(strip=True)
      if "số" in title.lower():
          title = re.split(r"\s*số\s*[\d/]+/qh\d+", title)[0].strip()
      
      # Fallback: extract từ metadata table
      code = meta_info.get("Số hiệu", "Không rõ")
      law_type = meta_info.get("Loại văn bản", "")
      issued_date = safe_date(meta_info.get("Ngày ban hành", ""))
      effective_date = safe_date(meta_info.get("Ngày có hiệu lực", ""))
  
      # Fallback nếu không tìm được: regex search trong HTML
      if not issued_date:
          issued_tag = soup.find("i", string=re.compile(r"ngày\s+\d{1,2}..."))
          m = re.search(r"ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})", ...)
  ```
- **Mô tả:**
  - Parse metadata từ HTML table
  - Safe date parsing (5 format khác nhau)
  - Fallback: extract từ text nếu table không có
  - Return: title, code, type, issued_date, effective_date

---

### 9️⃣ **`run_crawl_api.py`** - CLI API Crawl (cho backend)
- **Chức nauung:** Entry point gọi từ backend PHP (CLI mode)
- **Dòng quan trọng:**
  ```python
  # Line 4: Force UTF-8
  sys.stdout.reconfigure(encoding="utf-8")
  
  # Line 7-9: Kiểm tra tham số URL
  if len(sys.argv) < 2:
      log_step("ERROR: Missing url argument")
      sys.exit(2)
  
  # Line 12-15: Validate URL (must be thuvienphapluat.vn)
  if not re.match(r"^https://thuvienphapluat\.vn/van-ban/.+", url):
      log_step("ERROR: URL không hợp lệ")
      sys.exit(2)
  
  # Line 21: Gọi main crawl
  crawl_law_page(url)
  ```
- **Mô tả:**
  - CLI entry point (dùng để backend gọi)
  - Validate URL
  - Exit code: 0 (success), 1 (crawl error), 2 (input error)

### 9️⃣-1 **`AdminCrawlerController.java`** - Backend gọi Python crawler
- **Chức năng:** Nhận URL từ frontend, chạy crawler Python và trả log / status về UI
- **Dòng quan trọng:**
  ```java
  // Resolve workdir theo user.dir để tránh chạy sai thư mục
  Path backendDir = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize();

  // Nếu pythonExe là "python", ưu tiên dùng ../.venv/Scripts/python.exe
  Path venvPy = backendDir.resolve("../.venv/Scripts/python.exe").normalize();

  // Gộp stderr vào stdout để frontend nhận log đầy đủ
  pb.redirectErrorStream(true);

  // Trả thêm exitCode / resolvedPythonExe / resolvedWorkDir nếu crawler lỗi
  return ResponseEntity.status(500).body(Map.of(...));
  ```
- **Mô tả:**
  - Giảm lỗi 500 do môi trường Windows / workdir tương đối
  - Trả log chẩn đoán rõ hơn để frontend hiển thị nguyên nhân thật

---

### 🔟 **`run_crawl.py`** - Interactive Crawl (Manual)
- **Chức nauung:** Interactive mode (user input URL)
- **Dòng quan trọng:**
  ```python
  # Line 7-10: In menu + lấy URL input
  print("📘 HỆ THỐNG CRAWLER ILAS — Crawl luật từ Thư viện pháp luật")
  url = input("➡️ URL: ").strip()
  
  # Line 12-15: Validate URL
  if not re.match(r"^https://thuvienphapluat\.vn/van-ban/.+", url):
      print("⚠️ URL không hợp lệ!")
  
  # Line 20: Gọi crawl + print result
  crawl_law_page(url)
  print("\n✅ Crawl hoàn tất và đã lưu dữ liệu vào cơ sở dữ liệu ILAS.")
  ```
- **Mô tả:**
  - Interactive user input
  - Manual crawl từ command line

---

---

## 📊 BẢNG TÓMT TẮT

| File | Loại | Chức Năng | Input | Output |
|------|------|----------|-------|--------|
| **app.py** | Core | Flask API server | HTTP POST | JSON response |
| **bm25_index.py** | Search | BM25 keyword search | query string | Ranked doc IDs |
| **build_vector_store_chunks.py** | Data | Embed chunks → vectors | Articles from DB | vectors.npy + meta.json |
| **build_vector_store_faq.py** | Data | Embed FAQ → vectors | FAQ from DB | vectors.npy + meta.json |
| **build_vector_store_simplified.py** | Data | Embed simplified → vectors | Simplified from DB | vectors.npy + meta.json |
| **context_builder.py** | RAG | Build prompt context | Search results | Full article text |
| **groq_service.py** | LLM | Call Groq API | Context + question | LLM answer |
| **gemini_service.py** | LLM | Call Gemini API | Context + question | LLM answer |
| **legal_rag_pipeline.py** | RAG | Main RAG pipeline | Query + settings | Final answer |
| **legal_topic_boost.py** | Search | Topic scoring | Query + text | Score multiplier |
| **local_embedder.py** | Embedding | Sentence transformer | Text strings | 384-dim vectors |
| **rebuild_all.py** | Utility | Rebuild all indexes | (N/A) | Updated indexes |
| **retrieval_level6.py** | Search | Hybrid retrieval | Query + filter | Ranked results |
| **topic_cluster_builder.py** | Data | KMeans clustering | Vectors | Cluster IDs + centroids |
| **archive_cleanup.py** | Data | Archive old data | Law versions | Archived records |
| **content_cleaner.py** | Data | Normalize content | Raw HTML text | Clean text |
| **crawl_law.py** | Crawl | Main crawler | URL | Insert DB |
| **db_inserts.py** | Data | Insert chapters/sections | DB cursor | Inserted row IDs |
| **db.py** | Data | DB wrapper | (connection) | Connection object |
| **log_utils.py** | Utility | Logging | Message string | Timestamped log |
| **metadata_extractor.py** | Parse | Extract metadata | soup object | title, code, dates |
| **run_crawl_api.py** | CLI | Backend API entry | URL arg | stdout logs |
| **AdminCrawlerController.java** | Backend | Runs Python crawler | URL JSON | logs + status |
| **run_crawl.py** | CLI | User interactive mode | User input | stdout logs |

---

## 🔄 Luồng Dữ Liệu

### Crawler Flow:
```
URL → [run_crawl_api/run_crawl] 
  → [crawl_law.py] 
    → [Playwright download HTML]
    → [BeautifulSoup parse]
    → [metadata_extractor.py] (title, code, dates)
    → [content_cleaner.py] (normalize content)
    → [archive_cleanup.py] (archive old versions)
    → [db_inserts.py] (insert chapters/sections/articles)
    → DB (laws, chapters, sections, articles, simplified_articles)
```

### Vector Store Build Flow:
```
rebuild_all.py
  ├─ [build_vector_store_chunks.py]
  │   ├─ Load articles from DB
  │   ├─ Split into chunks (khoản/điểm)
  │   ├─ [local_embedder.py] embed chunks
  │   └─ Save vectors.npy + meta.json
  ├─ [build_vector_store_faq.py] → FAQ vectors
  ├─ [build_vector_store_simplified.py] → Simplified vectors
  ├─ [bm25_index.py] → BM25 index
  └─ [topic_cluster_builder.py] → KMeans clusters
```

### RAG Query Flow:
```
Query → [app.py /api/ask]
  → [legal_rag_pipeline.py]
    ├─ [retrieval_level6.py] (hybrid: BM25 + semantic + intent)
    │   ├─ [legal_topic_boost.py] (score boost)
    │   ├─ [bm25_index.py] (keyword search)
    │   └─ [local_embedder.py] (semantic search)
    ├─ [context_builder.py] (fetch full article)
    ├─ [groq_service.py] (call LLM)
    │   └─ Answer generation (strict mode)
    └─ [app.py] response JSON
```

---

## 🎯 Dòng Code Quan Trọng - Quick Reference

| Khía Cạnh | File | Dòng |
|-----------|------|------|
| **Model Embedding** | local_embedder.py | 5-6 (`intfloat/multilingual-e5-base`) |
| **LLM API** | groq_service.py | 11-13 (Groq Llama-3.1-8B) |
| **Chunking Strategy** | build_vector_store_chunks.py | 10-11 (regex split khoản/điểm) |
| **Cascading Delete** | archive_cleanup.py | 2-20 (archive_other_laws) |
| **Date Parsing** | metadata_extractor.py | 6-21 (safe_date) |
| **Intent Routing** | retrieval_level6.py | 28-45 (INTENT_TO_ARTICLES) |
| **Topic Boost** | legal_topic_boost.py | 33-34 (-1.2 penalty non-labor) |
| **Admin Settings** | legal_rag_pipeline.py | 10-25 (settings handling) |
| **Web Scraping** | crawl_law.py | 20-27 (Playwright headless) |
| **System Prompt Lock** | groq_service.py | 67-90 (strict legal guidelines) |

---

**End of Analysis**


## 📋 TÓM TẮT HỆ THỐNG AI (Thư Mục `ai/`)

**Hệ thống AI trong ILAS được xây dựng theo hướng "tìm đúng luật trước, rồi mới trả lời" để tăng độ chính xác pháp lý.** Khi người dùng đặt câu hỏi, hệ thống không để AI trả lời ngay bằng kiến thức chung, mà đi qua pipeline RAG để lấy dữ liệu luật liên quan trong kho ILAS trước. Sau đó mới dùng AI để diễn giải theo ngôn ngữ dễ hiểu, có căn cứ và có thể truy vết nguồn. Ngoài ra, toàn bộ luồng có thể điều chỉnh bằng settings từ admin như bật/tắt chatbot, độ trễ phản hồi, nguồn dữ liệu ưu tiên, temperature và maxTokens.

**Bước 1: Tìm kiếm thông minh (Hybrid Search)** - Hệ thống dùng `retrieval_level6.py` với nhiều lớp ưu tiên để tìm nhanh và đúng. Nếu user nêu rõ "Điều X", hệ thống đi thẳng theo số điều. Nếu user hỏi theo ý định quen thuộc (nghỉ việc, sa thải, nghỉ phép, làm thêm...), hệ thống dùng intent routing để map về điều luật tương ứng. Nếu không rơi vào 2 trường hợp trên, hệ thống chạy retrieval kết hợp semantic + BM25 + bonus theo ngữ cảnh chủ thể/nguồn dữ liệu, rồi xếp hạng kết quả. Nguồn dữ liệu retrieval hiện hành là `articles`, `articles/chunks`, `simplified`; settings `dataSource` sẽ map `all`/`laws`/`content` để lọc theo nhu cầu.

**Bước 2: Lấy nội dung đầy đủ (Build Context)** - Sau khi có top kết quả, hệ thống dùng `context_builder.py` để dựng context luật đầy đủ trước khi gọi LLM. Context chỉ được chấp nhận khi nguồn top là `articles` hoặc `articles/chunks` nhằm giữ tính pháp lý chính thống. Hệ thống ưu tiên lấy full article theo `article_id` (chính xác nhất). Nếu không có `article_id`, hệ thống fallback tra theo `article_number` với chiến lược ưu tiên `law_id=1`, sau đó mở rộng query toàn bộ luật để tránh bỏ sót dữ liệu hợp lệ.

**Bước 3: Gọi AI để viết câu trả lời (Call LLM)** - Pipeline chính (`legal_rag_pipeline.py`) chọn provider động theo biến môi trường `AI_PROVIDER`: nếu là `groq` thì gọi `groq_service.py`, ngược lại mặc định dùng `gemini_service.py`. Cả hai service đều dùng prompt ràng buộc chặt: chỉ được dựa trên ngữ cảnh luật đã cung cấp, trả lời thân thiện, hạn chế bịa thông tin ngoài dữ liệu. `gemini_service.py` đã đồng bộ contract với Groq (system/user tách riêng, fallback_general_answer, rewrite_legal_query) để dễ chuyển đổi provider khi cần.

**Bước 4: Trả lời có trích dẫn (Return Answer)** - Hệ thống trả kết quả gồm `answer`, `context_used`, `source`, `fallback`. Nếu retrieval rỗng hoặc context không dựng được, hệ thống trả fallback answer kèm ghi chú để user biết đó không phải câu trả lời bám chắc dữ liệu ILAS. Trường hợp đang dùng Gemini mà gặp các lỗi marker đã định nghĩa, pipeline tự thử fallback sang Groq để tăng tỷ lệ trả lời thành công. Ngoài ra, việc rebuild index được tách riêng tại endpoint `/api/admin/rebuild` (không chạy tự động theo mỗi câu hỏi).

---

---

## 📋 TÓM TẮT HỆ THỐNG CRAWLER (Thư Mục `crawler/`)

**Hệ thống Crawler trong ILAS có nhiệm vụ thu thập văn bản luật từ thuvienphapluat.vn, chuẩn hóa nội dung và ghi vào database theo phiên bản để AI truy vấn ổn định.** Thay vì nhập thủ công từng chương/mục/điều, admin chỉ cần cung cấp URL hợp lệ, backend sẽ gọi Python crawler và trả logs chi tiết để theo dõi toàn bộ quá trình.

**Bước 1: Nhận yêu cầu crawl và kiểm tra đầu vào** - Frontend gọi endpoint admin crawler ở backend Java, backend kiểm tra URL đúng domain `thuvienphapluat.vn/van-ban/`, resolve đúng workdir và ưu tiên Python trong `.venv` nếu có. Sau đó backend chạy `run_crawl_api.py` bằng module mode (`-m`) và gộp stderr vào stdout để trả log đầy đủ cho UI khi thành công/lỗi.

**Bước 2: Tải xuống HTML (Download HTML)** - Trong `crawl_law.py`, crawler dùng Playwright headless để xử lý trang có JavaScript. Luồng tải đã tối ưu timeout: ưu tiên `wait_until="domcontentloaded"` trong 60s, nếu timeout thì retry với `wait_until="commit"` trong 90s. Sau khi trang ổn định, crawler lấy `page.content()` làm đầu vào parse.

**Bước 3: Trích xuất metadata và kiểm tra chống crawl nhầm** - `metadata_extractor.py` lấy tiêu đề, số hiệu, loại văn bản, ngày ban hành, ngày hiệu lực với nhiều lớp fallback định dạng ngày. Trong `crawl_law.py`, trước khi chạm DB, hệ thống kiểm tra metadata bắt buộc (title/code không được "Không rõ") và xác thực cấu trúc luật bằng số anchor `dieu_`. Nếu trang không có cấu trúc điều luật hợp lệ, crawler dừng để tránh ghi nhầm dữ liệu.

**Bước 4: Chuẩn hóa nội dung và tách cấu trúc Chương/Mục/Điều** - Crawler parse vùng nội dung chính bằng BeautifulSoup, duyệt tuần tự anchor `chuong_`, `muc_`, `dieu_`, gom nội dung từng điều và chuẩn hóa bằng `content_cleaner.py`. Mục tiêu của bước này là giữ cấu trúc pháp lý chuẩn khi lưu để phục vụ truy xuất chính xác ở tầng AI.

**Bước 5: Insert vào Database theo version và bảo vệ tính nhất quán** - Crawler tra `laws` theo `code` để xác định update luật cũ hay tạo mới, rồi tăng `version_number`. Nếu tìm thấy cùng code nhưng tiêu đề mới khác quá xa tiêu đề cũ (độ tương đồng thấp), crawler chặn update để tránh ghi đè nhầm bộ luật. Dữ liệu Chương/Mục/Điều được insert theo thứ tự phụ thuộc khóa ngoại; `db_inserts.py` có `_truncate()` để tránh lỗi `Data too long`.

**Bước 6: Archive dữ liệu cũ, ghi law_versions và cleanup phiên bản** - Trước khi ghi dữ liệu mới, crawler archive dữ liệu active cũ của cùng luật (`archive_old_data`). Sau đó ghi bản ghi `law_versions` theo các nhánh tương thích schema, commit dữ liệu mới, rồi chạy `cleanup_versions` để dọn phiên bản quá cũ một cách an toàn (nếu lỗi cleanup thì ghi cảnh báo và bỏ qua, không làm hỏng crawl chính).

**Bước 7: Logging & Error Handling** - Toàn bộ tiến trình dùng `log_utils.py` để ghi từng bước có timestamp. `run_crawl_api.py` trả exit code chuẩn: `0` thành công, `1` lỗi crawl, `2` lỗi input. Backend Java trả thêm thông tin chẩn đoán (`exitCode`, `resolvedPythonExe`, `resolvedWorkDir`, `pythonModule`, `logs`) để debug nhanh lỗi 500. Lưu ý: crawler không tự chạy rebuild vector sau mỗi lần crawl; rebuild vẫn là tác vụ riêng qua endpoint `/api/admin/rebuild`.

---


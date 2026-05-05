# Hướng dẫn hiểu phần Tìm kiếm & Hiển thị Luật (Search & Display)

Tài liệu này tập trung giải thích cách phần backend xử lý tìm kiếm luật và hiển thị điều luật cho frontend, theo phong cách dễ hiểu giống `Giải thích AI và Crawler.md` và `guidline.md`.

## Mục tiêu
- Hiểu các endpoint chính để tìm và hiển thị luật/điều luật.
- Hiểu dòng chảy dữ liệu: Controller → Service → Repository → Entity/DTO.
- Ví dụ request/response và lưu ý về phân trang, trạng thái `active`, và tính an toàn.

## 1. Endpoints quan trọng (User-facing)
- `GET /api/laws/search?keyword=...&page=0&size=10` — tìm luật theo từ khóa (chỉ luật `active`).
- `GET /api/laws` — lấy danh sách luật với phân trang (chỉ `active`).
- `GET /api/laws/{id}` — lấy chi tiết một luật theo `id`.
- `GET /api/laws/code/{code}` — lấy luật theo mã.
- `GET /api/laws/articles/search?keyword=...&page=0&size=10` — tìm điều luật theo nội dung/tiêu đề.
- `GET /api/laws/{lawId}/articles/search?keyword=...` — tìm trong 1 văn bản cụ thể.
- `GET /api/laws/search-all?keyword=...` — tìm tổng hợp (luật + articles).

Tham khảo controller: [backend/src/main/java/com/C1SE61/backend/controller/user/LawController.java](backend/src/main/java/com/C1SE61/backend/controller/user/LawController.java#L1-L220)

## 2. Dòng chảy xử lý (Request → Response)

1) Frontend gọi endpoint (ví dụ `/api/laws/search`).
2) Controller nhận request, parse `keyword`, `page`, `size`, gọi `LawService`.
3) `LawService` chịu trách nhiệm: validate input (ví dụ keyword không rỗng), xây `Pageable`, gọi repository tương ứng, map entity → DTO.
4) Repository (Spring Data JPA) thực thi query (native SQL hoặc JPQL) và trả `Page<Law>` hoặc `Page<Article>`.
5) Service map sang `LawDTO` / `ArticleDTO` rồi trả về controller.
6) Controller đóng gói vào `ApiResponse` và trả cho frontend.

Mô tả file liên quan:
- Service: `backend/src/main/java/com/C1SE61/backend/service/user/LawService.java` — nơi tập trung logic tìm kiếm, phân trang, kiểm tra trạng thái.
- Repository: `backend/src/main/java/com/C1SE61/backend/repository/LawRepository.java` và `ArticleRepository.java` — chứa các query cụ thể (LIKE search, native query cho searchInLaw, searchWithRelevance).
- Entity: `Law` (`backend/src/main/java/com/C1SE61/backend/model/Law.java`) — field quan trọng: `status`, `version_number`, `last_crawled_at`.
- DTO: `LawDTO`, `ArticleDTO` — chỉ expose fields an toàn cho frontend.

## 3. Cách tìm kiếm hoạt động (chi tiết kỹ thuật)

- `LawRepository.searchLaws(keyword, pageable)`
  - Là native SQL sử dụng `LOWER(...) LIKE CONCAT('%', :keyword, '%')` trên `title`, `code`, `law_type`.
  - Luôn lọc `status = 'active'` để không trả các văn bản draft/inactive cho người dùng.

- `ArticleRepository.searchArticles(keyword, pageable)`
  - JPQL kết hợp `LEFT JOIN FETCH a.law` và tìm trên `articleTitle`, `content`, `articleNumber`.

- `ArticleRepository.searchArticlesInLaw(lawId, keyword, pageable)`
  - Native query để đảm bảo hiệu năng và join trực tiếp với bảng `laws`.

- `searchWithRelevance` (Article)
  - Native query với `ORDER BY CASE` để ưu tiên trùng tiêu đề trước, cung cấp xếp hạng đơn giản.

Lưu ý: hiện code dùng LIKE (substring match). Để nâng cao chất lượng tìm kiếm nên cân nhắc fulltext/tsvector hoặc vector search kết hợp.

## 4. Phân trang, giới hạn kết quả và DTO

- Tất cả API trả `Page<T>` (Spring Data) nên frontend nhận metadata: `totalElements`, `totalPages`, `size`, `number`.
- `LawDTO` cung cấp fields: `id, title, code, lawType, issuedDate, effectiveDate, status, versionNumber, lastCrawledAt`.
- `ArticleDTO` cung cấp: `articleId, articleNumber, articleTitle, content, lawId, lawTitle, chapterId, chapterTitle`.

Vì `content` có thể dài, frontend thường hiển thị `snippet` và cung cấp nút xem chi tiết (`GET /api/laws/articles/{id}`).

## 5. Ví dụ gọi API (curl)

Ví dụ tìm luật:

```bash
curl -s "http://localhost:8080/api/laws/search?keyword=lao%20dong&page=0&size=10"
```

Ví dụ tìm điều luật (global):

```bash
curl -s "http://localhost:8080/api/laws/articles/search?keyword=nghi%20viec&page=0&size=10"
```

Ví dụ tìm trong 1 luật cụ thể (lawId=12):

```bash
curl -s "http://localhost:8080/api/laws/12/articles/search?keyword=nghi%20viec&page=0&size=10"
```

## 6. Trường hợp biên & an toàn

- Nếu `keyword` rỗng/null, service trả `Page.empty(pageable)` để frontend hiển thị thông báo (không trả toàn bộ DB).
- Chỉ trả luật/điều với `status = 'active'` cho user-facing APIs.
- Repo/admin APIs (Moderator) có query không giới hạn `status` (dùng cho quản trị).
- `logSearch()` trong `LawService` có thể log truy vấn nhưng được bọc try/catch để không làm hỏng luồng chính.

## 7. Gợi ý cải tiến cụ thể (để thảo luận)

- Thêm fulltext search (Postgres `tsvector`) hoặc ElasticSearch để nâng cao chất lượng tìm kiếm và hỗ trợ highlight.
- Kết hợp vector/semantic search cho câu hỏi bằng ngôn ngữ tự nhiên (đã có trong phần AI, nhưng có thể dùng cho tìm luật tổng quát).
- Thêm snippet/highlight field trong DTO để frontend hiển thị đoạn khớp nổi bật.
- Thêm tests cho `LawService.searchArticles()` và `LawController` để đảm bảo behavior khi keyword rỗng hoặc DB lỗi.

## 8. Tham khảo mã nguồn liên quan
- Controller (user): [backend/src/main/java/com/C1SE61/backend/controller/user/LawController.java](backend/src/main/java/com/C1SE61/backend/controller/user/LawController.java#L1-L220)
- Service: [backend/src/main/java/com/C1SE61/backend/service/user/LawService.java](backend/src/main/java/com/C1SE61/backend/service/user/LawService.java#L1-L220)
- Repositories: [backend/src/main/java/com/C1SE61/backend/repository/LawRepository.java](backend/src/main/java/com/C1SE61/backend/repository/LawRepository.java#L1-L220), [backend/src/main/java/com/C1SE61/backend/repository/ArticleRepository.java](backend/src/main/java/com/C1SE61/backend/repository/ArticleRepository.java#L1-L260)
- DTO example: [backend/src/main/java/com/C1SE61/backend/dto/response/user/LawDTO.java](backend/src/main/java/com/C1SE61/backend/dto/response/user/LawDTO.java#L1-L200)

---
Tôi đã tạo `law_search.md` tóm tắt trực quan phần tìm kiếm và hiển thị luật. Muốn tôi tiếp:
- thêm ví dụ response JSON cụ thể,
- hay thêm sơ đồ sequence cho request → DB → response?

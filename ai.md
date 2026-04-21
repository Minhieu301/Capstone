# AI của dự án ILAS hoạt động như thế nào?

Tài liệu này giải thích theo cách dễ hiểu, không đi sâu vào code.

## 1) Mục tiêu của AI trong ILAS

AI trong ILAS không trả lời theo kiểu "đoán". Hệ thống được thiết kế để ưu tiên lấy thông tin từ dữ liệu luật đã lưu sẵn trong dự án, rồi mới tạo câu trả lời cho người dùng.

Nói đơn giản: AI làm 2 việc chính:
- Tìm đúng nội dung luật liên quan đến câu hỏi.
- Diễn giải lại cho người dùng theo ngôn ngữ dễ hiểu hơn.

## 2) Luồng xử lý từ lúc người dùng đặt câu hỏi

Khi người dùng nhập câu hỏi trong chatbot, hệ thống đi qua các bước sau:

### Bước 1: Nhận câu hỏi

Hệ thống nhận câu hỏi và kiểm tra nhanh xem có hợp lệ không (ví dụ có rỗng hay không).

### Bước 2: Tìm thông tin luật phù hợp

Đây là bước quan trọng nhất. Hệ thống sẽ cố tìm đúng điều luật theo nhiều cách:
- Nếu người dùng nêu rõ "Điều X", hệ thống ưu tiên đi thẳng vào điều đó.
- Nếu câu hỏi thuộc nhóm quen thuộc (như nghỉ việc, sa thải, nghỉ phép...), hệ thống map nhanh sang nhóm điều luật hay gặp.
- Nếu không rơi vào 2 trường hợp trên, hệ thống tìm theo nghĩa của câu hỏi và theo từ khóa để lấy các kết quả phù hợp nhất.

Mục tiêu là: tìm được phần luật đúng trước, rồi mới trả lời.

### Bước 3: Lấy ngữ cảnh đầy đủ

Sau khi có kết quả tìm kiếm, hệ thống lấy nội dung đầy đủ của điều luật liên quan để làm "ngữ cảnh".

Điều này giúp AI không trả lời mơ hồ. AI sẽ có căn cứ cụ thể để dựa vào.

### Bước 4: Gọi mô hình AI để viết câu trả lời

Hệ thống có thể dùng Gemini hoặc Groq (tùy cấu hình môi trường).

AI nhận:
- Câu hỏi của người dùng.
- Phần ngữ cảnh luật vừa lấy được.
- Một số cấu hình do admin đặt (độ dài trả lời, mức sáng tạo, nguồn dữ liệu...).

Sau đó AI tạo câu trả lời theo phong cách tư vấn thân thiện, dễ hiểu.

### Bước 5: Trả kết quả về giao diện

Chatbot trả lại:
- Nội dung trả lời.
- Thông tin nguồn/ngữ cảnh đã dùng.
- Trạng thái fallback (nếu có).

## 3) Fallback là gì?

Fallback là phương án dự phòng khi hệ thống không tìm đủ dữ liệu phù hợp hoặc gặp lỗi ở bước sinh câu trả lời.

Khi fallback xảy ra, chatbot vẫn cố trả lời để người dùng không bị "treo" cuộc trò chuyện, đồng thời có ghi chú để phân biệt với câu trả lời bám sát dữ liệu ILAS.

## 4) Vì sao cách này đáng tin hơn chatbot thường?

Vì hệ thống không chỉ dựa vào "trí nhớ" của mô hình AI. Nó buộc phải đi qua bước tìm dữ liệu luật trước.

Nhờ vậy:
- Giảm bịa thông tin.
- Dễ kiểm soát chất lượng.
- Dễ truy vết nguồn khi cần kiểm tra lại.

## 5) Admin có thể điều chỉnh gì?

Ở phía quản trị, có thể cấu hình một số thứ như:
- Bật/tắt chatbot.
- Chọn nguồn dữ liệu ưu tiên.
- Chỉnh độ dài câu trả lời.
- Chỉnh mức sáng tạo của AI.
- Rebuild lại dữ liệu tìm kiếm khi vừa cập nhật dữ liệu luật mới.

## 6) Tóm tắt ngắn gọn

Nếu nói ngắn gọn, AI của ILAS chạy theo logic:

Người dùng hỏi -> hệ thống tìm đúng luật -> lấy ngữ cảnh đầy đủ -> AI diễn giải -> trả lời kèm nguồn/fallback.

Điểm mạnh của dự án là đặt bước "tìm đúng dữ liệu" lên trước bước "viết câu trả lời", nên câu trả lời thực tế và ổn định hơn.
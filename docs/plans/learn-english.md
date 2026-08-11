# Kế hoạch BA: Học tiếng Anh

## 1. Bối cảnh

Polyglot.io đã hỗ trợ các luồng học theo bài, đọc phụ đề, đánh dấu từ, phát âm,
thống kê và MCP. Trong `ConfigService`, tiếng Anh (`en`, `en-US`) đã được khai
báo nhưng đang `enabled: false`. Một số hướng dẫn MCP và xử lý phát âm còn giả
định người học đang học tiếng Nhật, ví dụ luôn yêu cầu hiển thị hiragana.

Chỉ đổi cờ `enabled` chưa đủ để xem tiếng Anh là một ngôn ngữ được hỗ trợ đầy
đủ. Tính năng phải nhất quán từ lúc tạo bài đến lúc xem từ, nghe phát âm, theo
dõi tiến độ và thao tác qua MCP.

## 2. Mục tiêu

- Người dùng chọn được English trong bộ chuyển ngôn ngữ.
- Người dùng tạo, nhập, đọc và hoàn thành bài học tiếng Anh bằng các loại bài
  hiện có.
- Từ tiếng Anh được tách hợp lý, có nghĩa, phát âm IPA và mức độ ghi nhớ riêng
  cho từng người dùng.
- Điểm, mục tiêu ngày, lịch sử và biểu đồ tiếng Anh không trộn với ngôn ngữ
  khác.
- Các công cụ MCP hoạt động với `languageCode = "en"` và trình bày phát âm phù
  hợp với ngôn ngữ thay vì mặc định hiragana.

## 3. Ngoài phạm vi MVP

- Xây chương trình CEFR, bài kiểm tra xếp lớp hoặc lộ trình khóa học cố định.
- Chấm điểm nói theo âm vị, nhận dạng giọng nói hoặc hội thoại thời gian thực.
- Spaced repetition theo thuật toán mới. MVP tiếp tục dùng thang đánh dấu 0-5
  và cách tính điểm hiện tại.
- Thay đổi ngôn ngữ giao diện sang tiếng Việt hoặc tiếng Anh. “Ngôn ngữ học” và
  “ngôn ngữ giao diện” là hai khái niệm độc lập.
- Tự động dịch toàn bộ dữ liệu bài học cũ.

## 4. Đối tượng và nhu cầu

### Người học

- Muốn học tiếng Anh từ văn bản, video, phụ đề hoặc nội dung do AI tạo.
- Muốn tra nghĩa và nghe phát âm ngay trong ngữ cảnh.
- Muốn đánh dấu mức độ nhớ từ và xem tiến bộ chỉ riêng tiếng Anh.

### Người dùng MCP / Agent CLI

- Muốn agent tạo hoặc quản lý bài học tiếng Anh trong đúng tài khoản.
- Muốn agent đọc danh sách từ đã đánh dấu để đưa ra bài luyện phù hợp.
- Muốn kết quả có IPA cho tiếng Anh, không có hướng dẫn hiragana sai ngữ cảnh.

## 5. Luồng nghiệp vụ chính

### US-EN-01: Chọn tiếng Anh

**Là** người học, **tôi muốn** chọn English trong sidebar **để** mọi màn hình
hiển thị dữ liệu học tiếng Anh.

Tiêu chí chấp nhận:

- API danh sách ngôn ngữ trả về `en`, tên `English`, locale/tag `en-US`.
- English xuất hiện trong `LanguageSwitcher` sau khi đăng nhập.
- Khi chọn English, ứng dụng lưu lựa chọn theo cơ chế hiện tại và chuyển về
  `/lessons`.
- Danh sách bài, từ, điểm ngày và biểu đồ chỉ truy vấn dữ liệu có
  `language_code = "en"`.
- Việc bật English không làm thay đổi lựa chọn đã lưu hợp lệ của người dùng cũ.

### US-EN-02: Tạo và học bài tiếng Anh

**Là** người học, **tôi muốn** dùng mọi loại bài hiện có cho tiếng Anh **để**
học từ nội dung phù hợp với mình.

Tiêu chí chấp nhận:

- Tạo được bài `manual`, `text`, `subtitle`, `manga` và `generated` với
  `languageCode = "en"`, theo đúng khả năng hiện có của từng giao diện/API.
- Bộ tách câu trả về các từ tiếng Anh theo đúng thứ tự, bỏ dấu câu nhưng giữ
  contraction có nghĩa như `don't`, `I'm` và từ ghép có dấu gạch nối khi phù
  hợp.
- Nếu nội dung rõ ràng không phải tiếng Anh, quy tắc từ chối hiện tại vẫn được
  áp dụng.
- Trang đọc văn bản, video và manga hiển thị từ có thể bấm, bản dịch câu, tiến
  độ và nút hoàn thành như các ngôn ngữ đang hỗ trợ.
- TTS dùng `en-US`; lỗi TTS không làm mất nội dung hoặc tiến độ bài.

### US-EN-03: Học và quản lý từ tiếng Anh

**Là** người học, **tôi muốn** xem nghĩa, IPA và đánh dấu từ tiếng Anh **để**
theo dõi vốn từ của mình.

Tiêu chí chấp nhận:

- Mỗi từ tiếng Anh được lưu với `language_code = "en"` và không trộn với từ
  cùng mặt chữ ở ngôn ngữ khác.
- Phát âm ưu tiên kiểu `ipa`; không tạo hiragana, pinyin hoặc romanization cho
  từ tiếng Anh.
- Người dùng xem và sửa được mức 0-5, ghi chú, lịch sử hành động và các câu ví
  dụ giống luồng từ vựng hiện tại.
- Bộ lọc bài học, độ khó và sắp xếp trên `/words` hoạt động với tiếng Anh.
- Một từ đã có dữ liệu nghĩa hoặc IPA được tái sử dụng, tránh gọi AI lặp lại
  không cần thiết theo cơ chế cache hiện tại.

### US-EN-04: Theo dõi tiến bộ tiếng Anh

**Là** người học, **tôi muốn** có mục tiêu và biểu đồ riêng cho tiếng Anh
**để** đánh giá đúng thói quen học.

Tiêu chí chấp nhận:

- `DAILY_SCORE_TARGET` được đọc và ghi với `languageCode = "en"`.
- Điểm hôm nay, số từ đã biết, lịch sử 7 ngày và các biểu đồ chỉ tổng hợp hành
  động tiếng Anh khi English đang được chọn.
- Người dùng chưa có hoạt động tiếng Anh thấy trạng thái rỗng/0, không nhận dữ
  liệu của Japanese, Korean hoặc Chinese.

### US-EN-05: Dùng tiếng Anh qua MCP

**Là** người dùng MCP, **tôi muốn** tạo bài, thêm câu, liệt kê và đánh dấu từ
tiếng Anh **để** một agent có thể hỗ trợ quá trình học.

Tiêu chí chấp nhận:

- Hướng dẫn server liệt kê `en (English)` trong ngôn ngữ hợp lệ.
- `create_lesson`, `add_sentence`, `list_lessons`, `list_sentences`,
  `list_words` và `mark_word` chấp nhận dữ liệu tiếng Anh trong phạm vi hiện có.
- Hướng dẫn hiển thị từ qua MCP chọn phát âm theo ngôn ngữ: `hiragana` cho
  Japanese, `romanization` cho Korean, `pinyin` cho Chinese và `IPA` cho English.
- Không yêu cầu agent tự suy diễn hiragana khi `languageCode = "en"`.
- Quyền sở hữu bài và dữ liệu người dùng tiếp tục được kiểm tra ở service; agent
  không thể truy cập dữ liệu của tài khoản khác.

## 6. Quy tắc nghiệp vụ

1. Mã ngôn ngữ chuẩn của tính năng là `en`; tag giọng đọc mặc định là `en-US`.
2. Mọi bảng hiện có vẫn phân tách dữ liệu theo `language_code`; không tạo bảng
   dành riêng cho tiếng Anh.
3. Bản dịch đích tiếp tục theo quy tắc/cấu hình hiện tại của hệ thống. Việc bật
   English không mặc định rằng bản dịch cũng phải là English.
4. IPA là kiểu phát âm chuẩn cho English trong MVP. Một từ có thể có nhiều cách
   phát âm nếu dữ liệu hiện tại cho phép.
5. Contraction là một đơn vị từ vựng khi có nghĩa độc lập trong ngữ cảnh. Dấu
   câu đứng ngoài từ.
6. Điểm và mục tiêu ngày luôn theo cặp người dùng + ngôn ngữ.
7. Mọi thao tác AI thất bại phải trả lỗi có thể hiểu được và cho phép thử lại;
   không ghi bản ghi hoàn tất giả.

## 7. Tác động hệ thống dự kiến

| Khu vực      | Thay đổi                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------- |
| Cấu hình     | Bật `en` trong `backend/src/services/configService.ts`                                    |
| AI splitting | Thêm quy tắc tiếng Anh rõ ràng trong `sentenceSplitterAgent`                              |
| Phát âm      | Xác nhận English luôn dùng IPA trong splitter và pronunciation agent                      |
| MCP          | Thay hướng dẫn hiragana cố định bằng hướng dẫn theo ngôn ngữ                              |
| Frontend     | Kiểm tra LanguageSwitcher, Lessons, Words, Charts, Settings và các nhãn rỗng/lỗi với `en` |
| Dữ liệu      | Không cần migration nếu tiếp tục dùng schema hiện tại                                     |

## 8. Kiểm thử chấp nhận đầu-cuối

1. Đăng nhập, chọn English và đặt mục tiêu ngày riêng.
2. Tạo một bài text có contraction, từ ghép và dấu câu.
3. Mở bài, bấm vào từ, xem nghĩa + IPA, nghe TTS và đánh dấu mức độ.
4. Hoàn thành bài, xác nhận điểm và biểu đồ English thay đổi.
5. Chuyển sang Japanese, xác nhận số liệu English không xuất hiện.
6. Qua MCP, tạo một bài English, thêm câu và đánh dấu một từ.
7. Xác nhận output MCP dùng IPA và không nhắc hiragana.

## 9. Chỉ số thành công sau phát hành

- Tỷ lệ người dùng chọn English và tạo/mở ít nhất một bài.
- Tỷ lệ bài English xử lý thành công.
- Số từ English được đánh dấu trên mỗi người dùng hoạt động.
- Tỷ lệ lỗi của sentence splitting, translation và TTS theo ngôn ngữ.
- Tỷ lệ quay lại học English trong 7 ngày.

Không gửi nguyên văn nội dung bài, token đăng nhập hoặc prompt cá nhân vào hệ
thống đo lường.

## 10. Kế hoạch phát hành

1. Bổ sung rule, sửa MCP và kiểm thử tự động trước khi bật cờ `en`.
2. Bật English ở môi trường phát triển và chạy bộ kiểm thử chấp nhận.
3. Phát hành có theo dõi lỗi AI/TTS theo `languageCode`.
4. Nếu tỷ lệ lỗi vượt ngưỡng vận hành, có thể tắt English bằng cấu hình mà không
   xóa dữ liệu người dùng đã tạo.

## 11. Điểm cần Product Owner xác nhận

- English MVP dùng giọng `en-US`; có cần chọn `en-GB` theo người dùng không?
- Ngôn ngữ bản dịch mặc định của người dùng English là gì?
- Có cần nội dung mẫu/onboarding English hay chỉ mở toàn bộ công cụ hiện có?
- Chỉ số lỗi nào là ngưỡng để tắt tính năng khi rollout?

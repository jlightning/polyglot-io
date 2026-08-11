# Kế hoạch sản phẩm

Thư mục này chứa đặc tả nghiệp vụ, kế hoạch triển khai và trạng thái thực hiện
của các tính năng Polyglot.io.

| Tài liệu                                                 | Mục tiêu                                                                                  | Trạng thái                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------- |
| [Học tiếng Anh](learn-english.md)                        | Mở tiếng Anh như một ngôn ngữ học đầy đủ trên các luồng bài học, từ vựng, thống kê và MCP | Đã bật English; còn kiểm thử AI/MCP |
| [Chạy Agent CLI bằng tmux](tmux-agent-cli.md)            | Backend quản lý phiên Agent CLI cục bộ bằng tmux; CLI và API key lấy từ environment       | Đã hoàn thành MVP backend           |
| [Object Storage: AWS S3 và Cloudflare R2](r2-storage.md) | Chuẩn hóa storage provider để mỗi môi trường có thể chọn AWS S3 hoặc R2                   | Đề xuất                             |

## Thứ tự khuyến nghị

1. Hoàn thành kiểm thử AI splitting, IPA, TTS và MCP cho English.
2. Kết nối Agent CLI với MCP của Polyglot để agent có thể đọc bài học và cập
   nhật từ vựng theo đúng tài khoản người dùng.
3. Hoàn thiện kiểm thử tích hợp WebSocket terminal và vòng đời tmux trong CI.
4. Kế hoạch object storage độc lập với các tính năng trên và có thể triển khai
   song song; AWS S3 vẫn được hỗ trợ, R2 là provider bổ sung.

## Thay đổi đã hoàn thành

Cập nhật ngày 11/08/2026:

- Đã thêm i18n giao diện `en`/`vi`; English là mặc định và lựa chọn được lưu ở
  `localStorage`.
- Đã bật English trong API ngôn ngữ học; người dùng mới mặc định học `en` và
  endpoint `/api/lessons/language/en` đã được hỗ trợ.
- Đã triển khai Agent Session backend với REST, WebSocket terminal, Prisma,
  tmux socket cô lập, lifecycle/reconcile và smoke-test thực tế bằng Codex.
- Đã bỏ khái niệm `AGENT_CLI_PROVIDER`; CLI được chọn bằng `AGENT_CLI_TYPE` và
  ánh xạ credential tương ứng.
- R2 vẫn ở giai đoạn kế hoạch; AWS S3 chưa bị thay thế hoặc thay đổi hành vi.

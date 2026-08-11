# Kế hoạch sản phẩm

Thư mục này chứa các đặc tả nghiệp vụ và kế hoạch triển khai cho những tính
năng chưa phát hành của Polyglot.io.

| Tài liệu                                                 | Mục tiêu                                                                                  | Trạng thái                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------- |
| [Học tiếng Anh](learn-english.md)                        | Mở tiếng Anh như một ngôn ngữ học đầy đủ trên các luồng bài học, từ vựng, thống kê và MCP | Đề xuất                     |
| [Chạy Agent CLI bằng tmux](tmux-agent-cli.md)            | Backend quản lý phiên Agent CLI cục bộ bằng tmux; CLI và API key lấy từ environment       | Đang triển khai MVP backend |
| [Object Storage: AWS S3 và Cloudflare R2](r2-storage.md) | Chuẩn hóa storage provider để mỗi môi trường có thể chọn AWS S3 hoặc R2                   | Đề xuất                     |

## Thứ tự khuyến nghị

1. Hoàn thành tính năng Học tiếng Anh để bảo đảm dữ liệu, prompt và giao diện
   xử lý đúng ngôn ngữ `en`.
2. Xây runner tmux và tích hợp một Agent CLI đầu tiên.
3. Kết nối Agent CLI với MCP của Polyglot để agent có thể đọc bài học và cập
   nhật từ vựng theo đúng tài khoản người dùng.
4. Kế hoạch object storage độc lập với hai tính năng trên và có thể triển khai
   song song; AWS S3 vẫn được hỗ trợ, R2 là provider bổ sung.

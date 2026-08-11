# Kế hoạch BA: Chạy Agent CLI bằng tmux

## Trạng thái triển khai

**MVP backend đã hoàn thành ngày 11/08/2026.**

Đã làm:

- Thêm model/migration `AgentSession` và các trạng thái `starting`, `running`,
  `exited`, `failed`, `stopped`.
- Thêm REST API readiness, create/list/get/stop và cấp terminal token dùng một
  lần. Request tạo phiên giữ trường `goal`; client không gửi binary, CLI type
  hoặc secret.
- Thêm WebSocket terminal bridge dựa trên `node-pty`, ownership check, token TTL
  ngắn và giới hạn một writer.
- Chạy mỗi Agent trong tmux server/socket cô lập `polyglot-agent-<uuid>`, không
  can thiệp tmux session cá nhân.
- Thêm startup reconciliation, giới hạn phiên/người dùng, idempotency key và
  validation language/lesson ownership.
- Hỗ trợ cấu hình `codex`, `claude`/`claude-code`, `cursor` bằng
  `AGENT_CLI_TYPE`. Không có `AGENT_CLI_PROVIDER`; mapping credential mặc định
  lần lượt là `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `CURSOR_API_KEY`.
- Đã kiểm thử argument separation/chống shell injection, readiness không lộ
  key, namespace tmux và smoke-test API thực tế với Codex nhận `goal`.
- Đã cập nhật `README.md` và `backend/env.example`. Không thêm
  `AgentSessionsPage` hoặc dependency terminal vào frontend.
- Backend được phép khởi động không có `OPENAI_API_KEY` khi
  `AGENT_TMUX_ENABLED=true`. Các route gọi OpenAI trực tiếp trả
  `503 openai_not_configured`; Agent Session API vẫn là luồng riêng.
- Route generate lesson tự fallback sang batch mode của Agent CLI khi key thiếu
  hoặc OpenAI trả 401. Job chạy trong tmux socket cô lập, output JSON có marker
  được validate trước khi lưu lesson, sentence và word analysis.
- `AGENT_CLI_AUTH_MODE=login` hỗ trợ credential store của CLI (như
  `codex login`); `api_key` tiếp tục dùng mapping environment chuẩn. Vì vậy key
  OpenAI sai không bị truyền tiếp vào Codex fallback ở chế độ login.
- `AI_PROVIDER=auto|openai|agent_cli` là điểm chọn execution backend tập trung.
  Fallback Agent CLI hiện hỗ trợ generate lesson, phát âm từ, dịch câu và dịch
  từ. Vision vẫn cần OpenAI API.
- TTS được tách thành provider riêng theo kế hoạch `tts-provider.md`. Agent CLI
  chỉ tạo text/metadata và tmux chỉ quản lý process; không dùng chúng như speech
  engine hoặc kênh truyền binary audio.

Chưa làm:

- Credential MCP ngắn hạn theo user/session và thu hồi token.
- Integration test đầy đủ cho WebSocket, reconnect/backpressure, ownership giữa
  hai user và reconcile sau backend restart trong CI.
- Global session limit, idle timeout/cleanup policy và metrics vận hành đầy đủ.

## 1. Bối cảnh và giả định

Polyglot.io hiện cung cấp MCP qua HTTP để Claude Desktop hoặc Cursor thao tác
với bài học và từ vựng. Người dùng vẫn phải tự cấu hình và mở agent ở ứng dụng
bên ngoài.

Tính năng này bổ sung một runner cục bộ dùng tmux để khởi chạy Agent CLI như một
gia sư học ngôn ngữ. Phiên tiếp tục chạy khi API client detach và có thể được
gắn lại sau. Agent có thể dùng MCP của Polyglot trong phạm vi tài khoản đã tạo
phiên ở giai đoạn sau.

Giả định cho MVP:

- Backend và tmux chạy trên cùng máy do người dùng kiểm soát.
- Hỗ trợ macOS/Linux; Windows nằm ngoài phạm vi vì không có tmux chuẩn.
- Chỉ hỗ trợ một adapter Agent CLI được cấu hình cho mỗi backend process, nhưng
  mô hình dữ liệu/API không gắn cứng vào tên CLI đó.
- Không xây `AgentSessionsPage` trong MVP. Runtime là backend capability cho CLI,
  API client hoặc tích hợp UI riêng trong tương lai.
- Agent CLI và API key chỉ lấy từ environment tin cậy của backend. Request không
  được phép truyền CLI type, binary hoặc secret.

## 2. Mục tiêu

- Người dùng tạo phiên gia sư Agent CLI từ Polyglot và chọn ngôn ngữ học.
- Backend chạy CLI trong một tmux session riêng, theo dõi trạng thái và cho phép
  attach/detach/stop.
- Phiên không chết khi terminal client detach hoặc mất kết nối WebSocket.
- Agent nhận đúng credential theo CLI, ví dụ Codex dùng `OPENAI_API_KEY`, không
  nhận secret từ frontend.
- Không cho phép client gửi tùy ý lệnh shell hoặc tên binary.

## 3. Ngoài phạm vi MVP

- Chạy tmux trên máy khác hoặc SaaS multi-host.
- Container/sandbox bảo mật hoàn chỉnh cho mã không tin cậy.
- Chạy nhiều pane/window trong cùng một phiên.
- Trang quản lý/terminal nhúng trong frontend Polyglot.
- Chuyển phiên giữa các Agent CLI, resume conversation theo API riêng của từng
  nhà cung cấp hoặc đồng bộ transcript giữa thiết bị.
- Windows/WSL, mobile terminal và chia sẻ phiên giữa nhiều tài khoản.
- Agent tự ý mua dịch vụ, tải binary, sửa cấu hình hệ thống hoặc truy cập shell
  ngoài tiến trình được cấu hình.
- Sinh TTS audio bằng cách yêu cầu Agent CLI chạy lệnh và ghi file; tính năng
  này thuộc dedicated TTS provider.

## 4. Đối tượng và user stories

### US-TMUX-01: Kiểm tra khả năng chạy

**Là** người dùng, **tôi muốn** biết máy đã sẵn sàng **để** sửa cấu hình trước
khi tạo phiên.

Tiêu chí chấp nhận:

- API readiness trả trạng thái tmux, phiên bản Agent CLI được cấu hình và thư
  mục làm việc; không trả API key.
- Nếu thiếu tmux hoặc CLI, readiness báo không sẵn sàng và API tạo phiên trả lỗi
  `runtime_not_ready`; hệ thống không tự cài phần mềm.
- Backend kiểm tra binary bằng đường dẫn đã cấu hình hoặc `PATH`, không nhận
  binary path trực tiếp từ request tạo phiên.
- Kết quả kiểm tra không trả environment variables, token hoặc nội dung file bí
  mật cho client.

### US-TMUX-02: Tạo phiên gia sư

**Là** người học, **tôi muốn** mở một Agent CLI với mục tiêu học cụ thể **để**
bắt đầu luyện tập trong Polyglot.

Đầu vào MVP:

- `languageCode`, bắt buộc và phải là ngôn ngữ đang bật.
- `goal`, bắt buộc, văn bản thuần có giới hạn độ dài. Backend chuyển goal thành
  prompt khởi chạy cho Agent CLI.
- `lessonId`, tùy chọn và phải thuộc người dùng, cùng `languageCode`.

Tiêu chí chấp nhận:

- Backend sinh `sessionId` và tên tmux an toàn; client không quyết định tên tmux.
- Mỗi phiên thuộc đúng `userId` lấy từ JWT, không lấy từ body.
- Agent được khởi chạy với system/prompt template dành cho gia sư, bao gồm ngôn
  ngữ, mục tiêu và lesson nếu có.
- Nếu tạo thành công, API trả phiên ở trạng thái `running`; nếu tiến trình thoát
  ngay, trạng thái là `failed` cùng thông báo đã làm sạch dữ liệu nhạy cảm.
- Gửi lặp request có cùng idempotency key không tạo hai tmux session.

### US-TMUX-03: Attach bằng terminal client

**Là** người học, **tôi muốn** attach vào phiên **để** trao đổi trực tiếp với
agent.

Tiêu chí chấp nhận:

- API client lấy token dùng một lần rồi mở WebSocket đã xác thực để gắn vào đúng
  phiên; MVP không cung cấp trang frontend.
- Dữ liệu nhập, output, resize và các phím điều khiển cơ bản hoạt động.
- Ngắt client chỉ detach; Agent CLI vẫn chạy trong tmux.
- Có tối đa một kết nối ghi tại một thời điểm trong MVP; kết nối bổ sung chỉ đọc
  hoặc bị từ chối bằng thông báo rõ ràng.
- Người dùng không attach được phiên thuộc tài khoản khác.

### US-TMUX-04: Quản lý vòng đời

**Là** người học, **tôi muốn** xem lại và dừng phiên **để** kiểm soát tài nguyên
trên máy.

Trạng thái chuẩn:

`starting -> running -> exited | failed | stopped`

Tiêu chí chấp nhận:

- Danh sách phiên hiển thị agent, ngôn ngữ, mục tiêu rút gọn, trạng thái, thời
  điểm tạo và lần hoạt động cuối.
- Trạng thái được đối soát với tmux; bản ghi DB không tự được xem là bằng chứng
  tiến trình còn sống.
- “Detach” không dừng agent. “Stop” yêu cầu xác nhận và kết thúc đúng tmux
  session của phiên đó.
- Stop có tính idempotent. Stop một phiên đã kết thúc vẫn trả kết quả thành công
  có trạng thái cuối.
- Phiên mồ côi được đánh dấu `exited`/`failed`; job dọn dẹp không được kill tmux
  session không có namespace do Polyglot quản lý.

### US-TMUX-05: Dùng dữ liệu Polyglot qua MCP

**Là** người học, **tôi muốn** agent dùng bài và từ của mình **để** buổi học có
ngữ cảnh và cập nhật được tiến độ.

Tiêu chí chấp nhận:

- Agent chỉ nhận tool MCP nằm trong allowlist Polyglot hiện có.
- Credential cho MCP có thời hạn và scope theo người dùng/phiên; dừng phiên sẽ
  thu hồi credential nếu cơ chế token hỗ trợ.
- Credential không xuất hiện trong command line, tên tmux, log ứng dụng, URL
  API response, log hoặc output terminal.
- Agent phải xin xác nhận trong hội thoại trước thao tác ghi hàng loạt hoặc xóa.
- Lỗi MCP không làm chết terminal; agent thông báo lỗi và người dùng có thể thử
  lại.

## 5. Quy tắc nghiệp vụ

1. Một phiên luôn thuộc một người dùng, một ngôn ngữ và một adapter Agent CLI.
2. `agentType`, binary, argument nền và working directory đến từ cấu hình
   backend/adapter; request chỉ chứa lựa chọn nằm trong allowlist.
3. Không dựng command bằng nối chuỗi shell. Tiến trình phải dùng executable và
   mảng argument đã kiểm soát.
4. Tên tmux dùng namespace riêng, ví dụ `polyglot-agent-<opaque-id>`, không chứa
   email, goal, token hoặc lesson title.
5. Giới hạn số phiên đồng thời theo người dùng và toàn hệ thống phải cấu hình
   được. Giá trị khởi đầu đề xuất: 3 phiên/người dùng.
6. Mỗi thao tác list/get/attach/stop đều kiểm tra quyền sở hữu phía backend.
7. Output terminal là dữ liệu nhạy cảm. MVP không lưu transcript vào DB. Nếu cần
   lưu sau này phải có consent, retention và chức năng xóa riêng.
8. Backend restart phải đối soát lại tmux session do Polyglot quản lý, không tự
   đánh dấu tất cả phiên là chết.
9. Việc dừng server không mặc định kill các phiên đang chạy; hành vi shutdown
   phải được cấu hình và ghi rõ cho người vận hành.

## 6. Luồng backend đã triển khai

1. Backend đọc Agent CLI adapter và API-key environment variable khi khởi động.
2. Client gọi readiness rồi tạo session với ngôn ngữ, bài học tùy chọn và mục
   tiêu. Client không gửi CLI type, agent binary hoặc API key.
3. Backend tạo tmux server/socket riêng, truyền environment allowlist và chạy
   Agent CLI.
4. Client có thể list/get/stop qua REST. Nếu cần terminal, client lấy token dùng
   một lần rồi attach WebSocket; không có UI tích hợp trong MVP.
5. Detach không dừng tmux. Stop kết thúc đúng managed session/socket.

## 7. Hợp đồng API đã triển khai

| Method | Endpoint                                 | Mục đích                                     |
| ------ | ---------------------------------------- | -------------------------------------------- |
| `GET`  | `/api/agent-sessions/readiness`          | Kiểm tra tmux và Agent CLI đã cấu hình       |
| `POST` | `/api/agent-sessions`                    | Tạo phiên từ input đã validate               |
| `GET`  | `/api/agent-sessions`                    | Liệt kê phiên của người dùng hiện tại        |
| `GET`  | `/api/agent-sessions/:id`                | Xem chi tiết và trạng thái đã đối soát       |
| `POST` | `/api/agent-sessions/:id/stop`           | Dừng phiên, idempotent                       |
| `POST` | `/api/agent-sessions/:id/terminal-token` | Phát token attach một lần, TTL ngắn          |
| `WS`   | `/api/agent-sessions/terminal`           | Attach terminal hai chiều bằng token một lần |

Tất cả REST endpoint dùng JWT hiện tại. WebSocket chỉ nhận token ngẫu nhiên dùng
một lần, TTL ngắn do REST endpoint đã xác thực phát hành; không dùng JWT dài hạn
trong URL.

## 8. Mô hình dữ liệu đã triển khai

`AgentSession`:

| Trường                                                 | Ý nghĩa                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| `id`                                                   | ID opaque do server sinh                                          |
| `user_id`                                              | Chủ sở hữu                                                        |
| `agent_type`                                           | Adapter trong allowlist                                           |
| `language_code`                                        | Ngôn ngữ học                                                      |
| `lesson_id`                                            | Bài học tùy chọn                                                  |
| `goal`                                                 | Mục tiêu do người dùng gửi; backend dùng để dựng prompt khởi chạy |
| `tmux_session_name`                                    | Tên runtime nội bộ, unique                                        |
| `status`                                               | `starting`, `running`, `exited`, `failed`, `stopped`              |
| `exit_code`                                            | Mã thoát nếu xác định được                                        |
| `error_code`                                           | Mã lỗi đã chuẩn hóa, không chứa secret                            |
| `created_at`, `updated_at`, `last_seen_at`, `ended_at` | Mốc vòng đời                                                      |

Không lưu JWT, API key, MCP credential hoặc transcript trong bảng này.

## 9. Kiến trúc triển khai

- `AgentRuntimeService`: điều phối quyền, giới hạn phiên, trạng thái và lifecycle.
- `TmuxRuntime`: tạo, probe, attach, resize và stop tmux session bằng lời gọi
  process không qua shell.
- `AgentAdapter`: cung cấp readiness, executable, args, prompt và tên biến API
  key cho từng CLI. Mapping mặc định: Codex dùng `OPENAI_API_KEY`, Claude dùng
  `ANTHROPIC_API_KEY`, Cursor dùng `CURSOR_API_KEY`; CLI khác cấu hình override.
- `CredentialBroker`: phát credential MCP ngắn hạn theo phiên. Nếu chưa có cơ
  chế này, không bật tích hợp MCP trong bản phát hành đầu thay vì tái sử dụng JWT
  dài hạn trên command line.
- WebSocket terminal bridge: nối PTY attach của tmux với client, có auth,
  ownership check, backpressure, giới hạn kích thước frame và cleanup khi detach.
- Reconciler: định kỳ và khi startup đối chiếu DB với tmux session mang namespace
  của Polyglot.

## 10. Yêu cầu phi chức năng

### Bảo mật

- Chống command injection bằng allowlist + `spawn(executable, args, {shell:
false})` hoặc cơ chế tương đương.
- Không truyền secret qua argv; dùng file tạm quyền `0600`, stdin hoặc biến môi
  trường chỉ khi adapter hỗ trợ và log đã redact.
- Giới hạn độ dài goal, kích thước terminal input, tần suất tạo/attach/stop.
- Kiểm tra origin cho WebSocket và auth cho endpoint thay đổi trạng thái.
- Không cho Agent CLI kế thừa toàn bộ environment của backend; dùng allowlist
  biến môi trường tối thiểu.

### Độ tin cậy và hiệu năng

- API tạo phiên phản hồi trong 10 giây hoặc trả lỗi timeout có thể retry.
- Mất WebSocket không làm dừng tmux session.
- Bridge áp dụng backpressure để agent output lớn không làm treo backend.
- Readiness và probe có timeout; lỗi probe không được biến thành lệnh kill rộng.

### Quan sát vận hành

- Ghi audit event cho create, attach, detach, stop và reconcile với `sessionId`,
  `userId`, `agentType`, result/error code; không ghi terminal content hoặc secret.
- Theo dõi số phiên active, tỷ lệ create thất bại, thời lượng phiên và số lần
  reconnect.

## 11. Kiểm thử chấp nhận đầu-cuối

1. Khi thiếu tmux, readiness báo đúng và không cho tạo phiên.
2. Khi tmux + CLI hợp lệ, tạo được phiên English và tương tác trong terminal.
3. Ngắt terminal client, xác nhận agent tiếp tục chạy và reattach được.
4. Người dùng B không list/get/attach/stop được phiên của người dùng A.
5. Goal chứa ký tự shell không tạo thêm command/process ngoài adapter.
6. Stop hai lần cho cùng phiên vẫn an toàn và đúng trạng thái.
7. Restart backend, xác nhận reconciler nhận lại phiên tmux còn sống.
8. Kill tmux session ngoài ứng dụng, xác nhận API trả trạng thái cuối.
9. Khi bật MCP, agent đọc được lesson đã chọn và đánh dấu từ English; token
   không xuất hiện trong process list, log hoặc terminal.
10. Một tmux session không thuộc namespace Polyglot không bao giờ bị stop/dọn.

## 12. Phân kỳ triển khai

### Giai đoạn 1: Runtime nền

- [x] Readiness, model dữ liệu, tmux adapter, create/list/get/stop và reconciler.
- [x] Test process adapter bằng fake và smoke-test với tmux/Codex local.
- [ ] Integration test tmux trong CI.

### Giai đoạn 2: Terminal gateway

- [x] PTY/WebSocket bridge với token dùng một lần và resize protocol.
- [ ] Kiểm thử tích hợp auth, ownership, backpressure và detach semantics. Không thêm route,
      component hoặc dependency frontend.

### Giai đoạn 3: Agent adapter đầu tiên

- [x] Adapter CLI cấu hình từ backend, prompt gia sư dựng từ `goal`, cấu hình
      language/lesson và error mapping.
- [x] Chỉ mở adapter khi readiness pass.

### Giai đoạn 4: MCP an toàn

- [ ] Credential ngắn hạn theo phiên, cấu hình MCP tạm thời và thu hồi khi kết
      thúc.
- [ ] Audit/metrics đầy đủ và kiểm thử tích hợp không rò rỉ secret.

## 13. Điểm cần Product Owner xác nhận

- Có cần bổ sung CLI chính thức để create/list/attach/stop ở giai đoạn tiếp theo
  hay REST/WebSocket API là đủ?
- Phiên có được phép tồn tại sau khi backend tắt không, và thời gian tối đa là
  bao lâu?
- Có lưu transcript không? Khuyến nghị MVP là không.
- Hạn mức phiên đồng thời và timeout idle mong muốn là bao nhiêu?
- Tính năng chỉ phục vụ self-host/local hay có kế hoạch chạy trên server dùng
  chung? Nếu là server dùng chung, tmux đơn thuần không phải ranh giới sandbox
  đủ an toàn và cần thiết kế cô lập tiến trình riêng.

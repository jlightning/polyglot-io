# Kế hoạch giải pháp: TTS Provider có thể chuyển đổi

## Trạng thái

**Đề xuất ngày 11/08/2026; chưa triển khai.**

Hiện tại endpoint `POST /api/tts` chỉ dùng OpenAI TTS và cache audio trong bộ
nhớ. Khi không có `OPENAI_API_KEY`, endpoint trả
`503 openai_not_configured`.

## Quyết định kiến trúc

Không xem `codex`, `claude` hoặc `cursor` là TTS provider. Agent CLI tạo văn bản
và tmux quản lý tiến trình; cả hai không phải speech engine và không có hợp đồng
ổn định để trả binary audio.

Agent CLI có thể hỗ trợ chọn nội dung, cách đọc hoặc metadata giọng nói, nhưng
audio phải do provider TTS chuyên dụng tạo. Không yêu cầu agent tự chạy lệnh
shell để ghi một file audio tùy ý.

## Mục tiêu

- Giữ OpenAI TTS đang có.
- Cho phép chạy không cần API key bằng speech engine cục bộ.
- Chuyển provider bằng cấu hình backend, không thay đổi frontend hoặc API hiện
  tại.
- Hỗ trợ English bằng locale `en-US`; ánh xạ locale rõ ràng cho từng ngôn ngữ.
- Trả đúng MIME type/định dạng audio và cache riêng theo provider, voice,
  language và text.

## Cấu hình đề xuất

```env
# auto | openai | system
TTS_PROVIDER=auto

# Tùy chọn cho system provider
TTS_SYSTEM_ENGINE=auto
TTS_SYSTEM_VOICE=
TTS_TIMEOUT_MS=30000
```

Quy tắc:

- `openai`: yêu cầu `OPENAI_API_KEY`; không fallback âm thầm.
- `system`: dùng speech engine cục bộ đã được allowlist.
- `auto`: ưu tiên OpenAI khi có key hợp lệ; nếu thiếu key hoặc nhận 401 thì
  dùng system provider nếu readiness pass.
- `AI_PROVIDER` và `AGENT_CLI_TYPE` không quyết định TTS provider.

## System provider

- macOS: dùng binary hệ thống `/usr/bin/say` với voice/locale đã cấu hình.
- Linux: ưu tiên Piper; eSpeak NG có thể là fallback chất lượng thấp nếu được
  bật rõ ràng.
- Gọi executable với mảng arguments, `shell: false`; request không được truyền
  binary, command hoặc output path.
- File tạm được tạo bằng API an toàn, tên ngẫu nhiên, quyền tối thiểu và luôn
  cleanup trong `finally`.
- Chuẩn hóa output về định dạng được browser hỗ trợ nhất quán (đề xuất MP3 hoặc
  WAV). Route đặt `Content-Type` theo kết quả provider thay vì luôn
  `audio/mpeg`.

## Hợp đồng service đề xuất

```ts
interface TtsResult {
  audio: Buffer;
  contentType: string;
  provider: 'openai' | 'system';
}

interface TtsProvider {
  readiness(): Promise<{ ready: boolean; reason?: string }>;
  synthesize(input: {
    text: string;
    languageCode: string;
    voice?: string;
  }): Promise<TtsResult>;
}
```

`TtsService` chịu trách nhiệm chọn provider, fallback, timeout và cache;
provider chỉ tổng hợp audio. Cache key phải gồm provider + engine/version +
voice + languageCode + normalized text để không trả nhầm giọng.

## Tiêu chí chấp nhận

1. `TTS_PROVIDER=openai` giữ nguyên hành vi hiện tại.
2. `TTS_PROVIDER=system` tạo và phát được từ/câu English khi không có
   `OPENAI_API_KEY`.
3. `TTS_PROVIDER=auto` fallback chỉ với lỗi cấu hình/401; không fallback khi
   request không hợp lệ.
4. API trả đúng `Content-Type`; frontend phát được audio và revoke object URL.
5. Text rỗng/quá dài tiếp tục bị từ chối trước khi chạy provider.
6. Không có request input nào trở thành shell command, binary hoặc path.
7. Timeout, process failure và file cleanup có unit/integration test.
8. Cache không trộn OpenAI, system engine, voice hoặc language.

## Ngoài phạm vi

- Dùng Agent CLI/tmux làm speech engine.
- Voice cloning, upload giọng riêng hoặc chấm phát âm.
- Tự động cài Piper/eSpeak hoặc tải model trong runtime.
- Lưu audio lâu dài vào AWS S3/R2 trong giai đoạn đầu.

## Phân kỳ

1. [ ] Tách `OpenAiTtsProvider` khỏi `OpenAIService` và đổi `TtsService` trả
       `TtsResult`.
2. [ ] Thêm `SystemTtsProvider`, readiness và ánh xạ locale/voice.
3. [ ] Thêm `TTS_PROVIDER` với validation startup và fallback `auto`.
4. [ ] Cập nhật route, cache key, unit test và smoke test trên macOS.
5. [ ] Bổ sung Piper cho Linux và tài liệu cài đặt vận hành.

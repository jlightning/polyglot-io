# Kế hoạch BA: Object Storage với AWS S3 và Cloudflare R2

## 1. Bối cảnh

Polyglot.io hiện dùng AWS SDK S3 cho toàn bộ file của bài học:

- Ảnh đại diện và các trang manga.
- File text, SRT, ASS và SSA.
- Audio MP3, OGG và AAC.
- Presigned URL để trình duyệt upload trực tiếp và tải file private.
- Backend đọc text, tải buffer để OCR/chuyển ảnh, ghi ảnh JPG mới và xóa object.

Service hiện gắn chặt với tên và URL của AWS S3 (`S3Service`, biến môi trường
`AWS_*`, URL public dạng `s3.<region>.amazonaws.com`). Yêu cầu mới không thay thế
AWS S3. Hệ thống phải coi AWS S3 và Cloudflare R2 là hai storage provider ngang
hàng, được chọn bằng cấu hình theo từng môi trường. R2 hỗ trợ S3 API nên cả hai
adapter có thể tiếp tục dùng `@aws-sdk/client-s3`; adapter R2 bổ sung endpoint
account-scoped, region `auto`, credential R2 và CORS riêng.

Khi chuẩn hóa provider, luồng upload hiện có một khoảng trống cần xử lý:
backend trả `maxSize` cho frontend nhưng không xác minh kích thước object thật
sau khi trình duyệt PUT. Cả AWS S3 và R2 phải dùng bước hoàn tất upload để kiểm
tra object trước khi liên kết vào bài học.

## 2. Mục tiêu

- Mỗi deployment chọn `aws_s3` hoặc `r2` bằng cấu hình, không cần thay đổi code
  nghiệp vụ hoặc frontend.
- AWS S3 tiếp tục hoạt động đầy đủ và tương thích với dữ liệu hiện có.
- R2 là provider bổ sung, không phải provider bắt buộc hay mặc định toàn hệ thống.
- Bucket production của cả hai provider mặc định private; quyền đọc/ghi được cấp
  bằng URL ngắn hạn.
- Cấu hình storage không còn gắn cứng với AWS, cho phép kiểm thử adapter bằng
  cùng một contract.
- Hệ thống kiểm tra MIME type, dung lượng và quyền sở hữu trước khi sử dụng file.

## 3. Ngoài phạm vi MVP

- Biến bucket thành thư viện nội dung công khai hoặc CDN public.
- Cho người dùng tự kết nối bucket R2/S3 của họ.
- Multipart upload, resumable upload hoặc upload file lớn hơn giới hạn hiện tại.
- Thay đổi định dạng ảnh/audio, thuật toán OCR hoặc quy trình xử lý lesson.
- Mã hóa đầu-cuối bằng khóa riêng của từng người dùng.
- Đổi tên ngay các cột DB `image_s3_key`, `audio_s3_key`, `file_s3_key`. Đây là
  tên kỹ thuật cũ nhưng giá trị vẫn chỉ là object key và dùng được với R2.
- Chạy đồng thời nhiều provider trong cùng một deployment hoặc chọn provider
  riêng cho từng user/lesson.
- Tự động sao chép dữ liệu giữa AWS S3 và R2. Migration là quy trình vận hành tùy
  chọn khi một môi trường chủ động đổi provider.
- Sử dụng public `r2.dev` cho production.

## 4. Quyết định sản phẩm và kiến trúc

### 4.1 Provider được chọn theo môi trường

`OBJECT_STORAGE_PROVIDER` là nguồn quyết định duy nhất, nhận `aws_s3` hoặc `r2`.
Một process backend chỉ khởi tạo một provider active. Development, staging và
production có thể chọn provider khác nhau.

Không tự fallback âm thầm sang provider còn lại khi provider active lỗi. Việc
fallback có thể đọc/ghi nhầm bucket hoặc tạo dữ liệu phân mảnh. Readiness phải
báo lỗi để người vận hành xử lý.

### 4.2 Bucket private

MVP dùng bucket private với cả AWS S3 và R2. Trình duyệt chỉ truy cập object qua
presigned URL có thời hạn. Nếu chọn R2, không bật `r2.dev` và không phụ thuộc
custom domain ở giai đoạn đầu.

Lý do:

- Bài học, manga và audio là dữ liệu do người dùng tải lên.
- URL public ổn định có thể bị chia sẻ ngoài ý muốn.
- Presigned URL phù hợp với luồng hiện tại và giảm thay đổi frontend.

### 4.3 Storage provider abstraction

Đổi `S3Service` thành một contract trung lập, ví dụ `ObjectStorageService`, với
các thao tác tối thiểu:

- Tạo presigned PUT/GET.
- HEAD object để xác minh metadata.
- Đọc text/buffer.
- PUT từ backend.
- Xóa object.

Hai adapter `AwsS3ObjectStorage` và `R2ObjectStorage` cùng triển khai contract và
cùng chạy một bộ contract test. Business service không tự tạo URL theo hostname
của AWS hoặc R2.

### 4.4 Giữ nguyên object key

Các key cũ dạng `lessons/<userId>/...` tiếp tục hoạt động với AWS S3. Nếu có
migration tùy chọn, key được giữ nguyên ở provider đích để không cần sửa hàng
loạt record DB. Key mới phải dùng ID ngẫu nhiên không đoán được, tên file đã
chuẩn hóa và namespace người dùng, ví dụ:

`lessons/<userId>/<opaque-id>/<safe-filename>`

Không đưa email, token hoặc đường dẫn local vào key.

### 4.5 Không tin dữ liệu từ client

`key`, MIME type và giới hạn dung lượng do backend phát hành trong một upload
intent. Client không được tự gửi một key bất kỳ để gắn vào lesson. Backend chỉ
chấp nhận file đã finalize, thuộc đúng người dùng và chưa hết hạn.

## 5. User stories và tiêu chí chấp nhận

### US-STORAGE-01: Chọn và kiểm tra provider

**Là** người vận hành, **tôi muốn** chọn AWS S3 hoặc R2 bằng environment
variables và kiểm tra kết nối lúc khởi động **để** dùng provider phù hợp với môi
trường triển khai.

Tiêu chí chấp nhận:

- `OBJECT_STORAGE_PROVIDER=aws_s3` khởi tạo adapter AWS S3;
  `OBJECT_STORAGE_PROVIDER=r2` khởi tạo adapter R2; giá trị khác bị từ chối.
- Cấu hình chung có bucket, access key ID và secret access key. AWS S3 yêu cầu
  AWS region; R2 yêu cầu endpoint account-scoped và region `auto`.
- Production không khởi động chức năng upload khi thiếu hoặc sai credential.
- Readiness phân biệt `configured`, `reachable` và `writable`; không in secret
  vào log hoặc response.
- Credential của mỗi provider chỉ có quyền cần thiết trên bucket tương ứng.
- Môi trường development, staging và production dùng bucket/credential riêng.
- Provider active được hiển thị trong readiness nội bộ để hỗ trợ vận hành, nhưng
  frontend người học không cần biết provider nào đang được dùng.

### US-STORAGE-02: Upload trực tiếp vào provider active

**Là** người học, **tôi muốn** upload file bài học như hiện tại **để** không phải
quan tâm file đang được lưu ở nhà cung cấp nào.

Luồng đề xuất:

1. Frontend gửi tên file, MIME type và kích thước dự kiến.
2. Backend validate, tạo upload intent và presigned PUT URL thời hạn ngắn.
3. Frontend PUT trực tiếp lên provider active với đúng `Content-Type` đã ký.
4. Frontend gọi finalize bằng ID của upload intent.
5. Backend HEAD object, xác minh key, size, content type và trạng thái tồn tại.
6. Chỉ upload đã finalize mới được dùng để tạo/cập nhật lesson.

Tiêu chí chấp nhận:

- Các loại file và giới hạn giữ nguyên: ảnh 10 MB, text/subtitle 5 MB, audio
  50 MB, trừ khi Product Owner thay đổi.
- Presigned URL PUT chỉ áp dụng cho một bucket, một key và một Content-Type, có
  TTL ngắn; đề xuất 10 phút thay vì 1 giờ hiện tại.
- CORS của bucket AWS S3 hoặc R2 chỉ cho phép origin frontend đã cấu hình,
  method/header cần thiết; không dùng wildcard origin trong production.
- Finalize từ chối object quá dung lượng, sai MIME type, sai owner, sai key, đã
  hết hạn hoặc không tồn tại.
- Object bị từ chối được xóa best-effort và ghi audit event; không tạo lesson
  trỏ tới object đó.
- Upload lặp/finalize lặp an toàn và không tạo nhiều object intent hiệu lực.

### US-STORAGE-03: Đọc và xử lý file độc lập provider

**Là** người học, **tôi muốn** mở bài, xem manga và nghe audio bình thường
**để** việc lựa chọn storage provider không làm thay đổi trải nghiệm học.

Tiêu chí chấp nhận:

- Backend tạo presigned GET URL cho ảnh, audio và lesson file private.
- URL hết hạn có thể được lấy lại bằng việc refresh API lesson; DB không lưu
  presigned URL.
- Backend đọc được nội dung text/subtitle và buffer ảnh từ provider active.
- Luồng Sharp chuyển PNG/GIF/WebP sang JPG ghi object mới thành công rồi mới xóa
  object gốc.
- Không còn code tự ghép URL AWS public từ bucket + region.
- Response lỗi không để lộ endpoint nội bộ, credential, signature hoặc object
  key của người dùng khác.

### US-STORAGE-04: Cập nhật và xóa file

**Là** người học, **tôi muốn** thay file hoặc xóa bài **để** object không còn sử
dụng được dọn khỏi provider active.

Tiêu chí chấp nhận:

- Khi thay file, DB chỉ chuyển sang key mới sau khi upload mới đã finalize.
- Xóa object cũ là idempotent; trường hợp object đã không tồn tại vẫn xem là đã
  dọn thành công.
- Nếu cập nhật DB thành công nhưng xóa object thất bại, lesson vẫn dùng file mới
  và hệ thống đưa key cũ vào hàng đợi retry/dọn rác.
- Nếu xóa lesson, dữ liệu nghiệp vụ và danh sách key cần xóa được xác định trước;
  lỗi xóa storage không làm khôi phục một lesson đã xóa thành công.
- Job định kỳ phát hiện upload intent hết hạn và object mồ côi trong namespace
  do ứng dụng quản lý.

### US-STORAGE-05: Giữ AWS S3 tương thích

**Là** người vận hành đang dùng AWS S3, **tôi muốn** nâng cấp lên storage
abstraction mà không chuyển dữ liệu **để** tiếp tục vận hành bucket hiện tại.

Tiêu chí chấp nhận:

- Cấu hình legacy `AWS_*` có lộ trình chuyển rõ ràng sang `OBJECT_STORAGE_*`.
- Khi provider là `aws_s3`, toàn bộ key cũ đọc, ghi, ký URL và xóa được như trước.
- Không yêu cầu copy object hoặc cập nhật các cột `*_s3_key`.
- Contract test cho AWS S3 và R2 có cùng các case PUT/GET/HEAD/DELETE/presign.
- Không xóa adapter AWS S3 sau khi R2 được phát hành.

### US-STORAGE-06: Đổi provider có kiểm soát, tùy chọn

**Là** người vận hành, **tôi muốn** có runbook khi chủ động đổi từ AWS S3 sang R2
hoặc ngược lại **để** không mất quyền truy cập object cũ.

Tiêu chí chấp nhận:

- Đổi biến provider không tự làm dữ liệu xuất hiện ở bucket mới; runbook phải
  yêu cầu copy và xác minh object trước khi cutover.
- Migration giữ nguyên key và metadata cần thiết; source không bị xóa tự động.
- Kiểm kê tối thiểu bằng tổng object, bytes, key/size/content type và sample hash.
- Không dùng ETag bằng nhau làm tiêu chí duy nhất khi công cụ copy có thể dùng
  multipart khác nhau.
- Có delta pass hoặc cửa sổ ngừng ghi; có kế hoạch sync ngược nếu rollback sau
  khi provider mới đã nhận file.

## 6. Quy tắc nghiệp vụ

1. Mỗi object lesson thuộc đúng một người dùng thông qua namespace key và upload
   intent; user ID luôn lấy từ JWT phía backend.
2. Không dùng tên file client làm key trực tiếp. Tên chỉ là metadata/display sau
   khi loại bỏ path traversal và ký tự không an toàn.
3. Presigned URL là bearer credential tạm thời, không được log, đưa vào analytics
   hoặc trả cho người dùng khác.
4. Bucket/key không phải bằng chứng ownership. Mọi API phát URL đọc hoặc xóa file
   phải đi qua lesson/upload record thuộc người dùng.
5. Database lưu object key, không lưu endpoint, hostname, presigned URL hoặc
   credential.
6. Tạo/cập nhật lesson chỉ nhận upload đã `ready`; upload intent có vòng đời:
   `pending -> uploaded -> ready | rejected | expired`.
7. Xóa storage là eventual consistency ở tầng nghiệp vụ: phải retry được và có
   báo cáo object mồ côi.
8. Không tự động chuyển object user content sang public.

## 7. API đề xuất

| Method   | Endpoint                            | Mục đích                                       |
| -------- | ----------------------------------- | ---------------------------------------------- |
| `POST`   | `/api/storage/uploads`              | Validate metadata, tạo intent và presigned PUT |
| `POST`   | `/api/storage/uploads/:id/finalize` | HEAD + xác minh object, chuyển sang `ready`    |
| `GET`    | `/api/storage/uploads/:id`          | Xem trạng thái upload của chính người dùng     |
| `DELETE` | `/api/storage/uploads/:id`          | Hủy intent và dọn object chưa gắn lesson       |

Endpoint `/api/s3/upload-file` được giữ tương thích trong một release hoặc đổi
frontend và backend cùng lúc. Không mở endpoint generic nhận raw object key để
GET/DELETE.

Response tạo upload không cần trả bucket, account ID hoặc credential; chỉ trả
`uploadId`, `uploadUrl`, `key` nếu frontend thực sự cần và `expiresAt`.

## 8. Mô hình dữ liệu đề xuất

Thêm `StorageUpload` (tên vật lý tùy convention Prisma hiện tại):

| Trường                                   | Ý nghĩa                                               |
| ---------------------------------------- | ----------------------------------------------------- |
| `id`                                     | ID opaque của intent                                  |
| `user_id`                                | Chủ sở hữu                                            |
| `object_key`                             | Key do server sinh, unique                            |
| `original_filename`                      | Tên hiển thị đã chuẩn hóa                             |
| `expected_content_type`                  | MIME type đã ký                                       |
| `expected_size`                          | Kích thước client khai báo                            |
| `actual_size`                            | Kích thước từ HEAD sau upload                         |
| `status`                                 | `pending`, `uploaded`, `ready`, `rejected`, `expired` |
| `expires_at`, `created_at`, `updated_at` | Vòng đời intent                                       |

Lesson vẫn tham chiếu key bằng các cột `*_s3_key` hiện có trong MVP. Tên cột là
chi tiết legacy và không có nghĩa provider bắt buộc là AWS. Việc đổi tên sang
`*_storage_key` là migration riêng, không phải điều kiện để hỗ trợ R2.

## 9. Cấu hình đề xuất

AWS S3:

```env
OBJECT_STORAGE_PROVIDER=aws_s3
OBJECT_STORAGE_REGION=us-east-1
OBJECT_STORAGE_BUCKET=polyglot-production
OBJECT_STORAGE_ACCESS_KEY_ID=<secret>
OBJECT_STORAGE_SECRET_ACCESS_KEY=<secret>
OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS=600
OBJECT_STORAGE_DOWNLOAD_URL_TTL_SECONDS=3600
```

Cloudflare R2:

```env
OBJECT_STORAGE_PROVIDER=r2
OBJECT_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_BUCKET=polyglot-production
OBJECT_STORAGE_ACCESS_KEY_ID=<secret>
OBJECT_STORAGE_SECRET_ACCESS_KEY=<secret>
OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS=600
OBJECT_STORAGE_DOWNLOAD_URL_TTL_SECONDS=3600
```

Không commit giá trị thật. `backend/env.example` chỉ chứa placeholder và mô tả
biến nào bắt buộc theo provider. Với AWS S3, `OBJECT_STORAGE_ENDPOINT` để trống
để SDK dùng endpoint chuẩn; với R2, endpoint là bắt buộc.

## 10. Kế hoạch triển khai

### Giai đoạn 1: Chuẩn hóa storage layer

- Tách contract trung lập khỏi `S3Service`.
- Giữ adapter AWS S3 và thêm adapter R2.
- Thêm validation cấu hình theo provider, HEAD và contract test dùng chung.
- Loại bỏ URL AWS tự ghép; mọi URL private được ký bởi adapter.
- Mặc định provider cho deployment đang tồn tại là `aws_s3` để không gây breaking
  change.

### Giai đoạn 2: Upload intent và kiểm soát file

- Thêm bảng/migration, create/finalize/cancel API và cleanup job.
- Chuyển hai luồng frontend `LessonUpload` và `LessonEditDialog` sang API mới.
- Kiểm thử MIME, size, ownership, expiration, CORS và object mồ côi.

### Giai đoạn 3: Phát hành hai provider

- Kiểm thử E2E riêng với một bucket AWS S3 và một bucket R2 private.
- Cập nhật README/env/troubleshooting cho cả hai lựa chọn.
- Deployment đang dùng AWS tiếp tục chọn `aws_s3`; deployment mới có thể chọn
  `aws_s3` hoặc `r2`.
- Không có bước copy dữ liệu bắt buộc trong rollout tính năng.

### Giai đoạn 4: Runbook đổi provider tùy chọn

- Chỉ thực hiện khi một môi trường chủ động đổi provider.
- Copy object với nguyên key, inventory verification và delta pass/cửa sổ ngừng
  ghi trước khi đổi `OBJECT_STORAGE_PROVIDER`.
- Với AWS S3 sang R2, có thể dùng Super Slurper hoặc Sippy + Super Slurper.
- Smoke test text lesson, manga, audio, edit, delete và image conversion.
- Giữ source trong thời gian rollback; không xóa adapter AWS hay R2.
- Nếu provider mới đã nhận file, sync ngược các key mới trước khi rollback.

## 11. Yêu cầu phi chức năng

### Bảo mật

- Credential AWS S3 hoặc R2 chỉ tồn tại ở backend/secret manager.
- Dùng credential scope theo bucket và quyền tối thiểu cần cho
  GET/PUT/HEAD/DELETE.
- Redact query signature của presigned URL khỏi HTTP/application logs.
- Chặn SVG hoặc phục vụ với header an toàn nếu vẫn cho phép upload SVG, vì SVG
  có thể chứa nội dung active. Điểm này phải được security review trước rollout.
- Validate magic bytes/content khi backend xử lý file nhạy cảm; không chỉ tin
  extension và MIME type từ trình duyệt.

### Độ tin cậy

- Mọi SDK call có timeout, retry hữu hạn và error code chuẩn hóa.
- Delete idempotent; upload/finalize có idempotency key.
- Trong migration tùy chọn, không xóa object nguồn trước khi object đích đã được
  xác minh.
- DB không lưu presigned URL vì URL sẽ hết hạn và chứa chữ ký nhạy cảm.

### Hiệu năng và chi phí

- Browser tiếp tục upload trực tiếp, backend không proxy payload lớn.
- Theo dõi storage bytes, operations theo cách tính của provider, lỗi 4xx/5xx và
  số URL được ký.
- Chỉ áp dụng lifecycle rule cho upload tạm/mồ côi qua prefix riêng. Không đặt
  expiry tự động lên object lesson đang hoạt động.
- Đánh giá Infrequent Access dựa trên dữ liệu truy cập thực tế, không bật mặc
  định cho file đang được học thường xuyên.

## 12. Kiểm thử chấp nhận đầu-cuối

1. Khởi động lần lượt với config AWS S3 và R2 hợp lệ/sai, xác nhận chọn đúng
   adapter, readiness/log đúng và không lộ secret.
2. Upload từng nhóm ảnh, text/subtitle và audio ở dưới, đúng và trên giới hạn.
3. Thay `Content-Type` khi PUT, xác nhận chữ ký/finalize từ chối.
4. Người dùng B không finalize, đọc hoặc hủy upload của người dùng A.
5. Tạo và đọc text lesson; phát audio; mở toàn bộ trang manga.
6. Chuyển PNG sang JPG, xác nhận object JPG tồn tại trước khi object gốc bị xóa.
7. Sửa lesson thay ảnh/audio, xác nhận file mới hoạt động và file cũ được dọn.
8. Xóa lesson khi provider active tạm lỗi, xác nhận cleanup retry sau đó thành
   công.
9. Để upload intent hết hạn, xác nhận job xóa object mồ côi nhưng không chạm file
   của lesson.
10. Chạy cùng một bộ contract test với AWS S3 và R2.
11. Với runbook tùy chọn, đổi provider rồi rollback trong staging, bao gồm đồng
    bộ file tạo mới trong khoảng thời gian provider mới active.

## 13. Chỉ số thành công

- Tỷ lệ upload/finalize thành công theo loại file.
- P50/P95 thời gian lấy presigned URL, finalize và tải object.
- Tỷ lệ lỗi GET/PUT/HEAD/DELETE, phân tách theo provider.
- Số upload intent hết hạn, rejected và object mồ côi.
- Tỷ lệ contract test tương thích giữa AWS S3 và R2.
- Nếu có migration, chênh lệch inventory nguồn/đích bằng 0, ngoại trừ danh sách
  lỗi được phê duyệt.
- Chi phí storage và operation theo tháng, phân tách theo provider.

Không gửi filename, object key đầy đủ, presigned URL hoặc nội dung file vào hệ
thống analytics.

## 14. Điểm cần Product Owner xác nhận

- Provider mặc định cho cài đặt mới là AWS S3 hay R2? Khuyến nghị không đặt mặc
  định ngầm: người vận hành phải chọn rõ ràng.
- Có cần hỗ trợ nhiều provider đồng thời trong cùng deployment ở giai đoạn sau
  không?
- Nếu một môi trường đổi provider, có yêu cầu zero-downtime hay chấp nhận cửa sổ
  ngừng upload?
- Có cần custom domain/CDN cho file public trong tương lai không?
- Giữ nguyên giới hạn 10 MB/5 MB/50 MB hay thay đổi?
- Có tiếp tục cho phép SVG không?
- Yêu cầu data residency/jurisdiction cụ thể cho nội dung người dùng là gì?

## 15. Tài liệu tham khảo

- [Cloudflare R2: S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
- [Cloudflare R2: Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare R2: Data migration](https://developers.cloudflare.com/r2/data-migration/)
- [Cloudflare R2: Migration strategies](https://developers.cloudflare.com/r2/data-migration/migration-strategies/)
- [Cloudflare R2: Object lifecycle rules](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Cloudflare R2: Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)

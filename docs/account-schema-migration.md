# Khởi tạo và chuyển schema tài khoản

Yêu cầu Java 21, Maven và PostgreSQL. Các lệnh Maven chạy trong thư mục `backend`. V1 chỉ quản lý `auth.users` và `candidate.candidate_profiles`. API và giao diện demo không thay đổi.

## Cấu hình kết nối

Ứng dụng mặc định dùng `lumi_recruitment` trên localhost:5432. Cung cấp `DB_PASSWORD` khi khởi động; có thể ghi đè URL/user qua `SPRING_DATASOURCE_URL` và `SPRING_DATASOURCE_USERNAME`.

Plugin Maven Flyway dùng biến môi trường riêng, cần trỏ vào cùng database:

```bash
export FLYWAY_URL=jdbc:postgresql://localhost:5432/lumi_recruitment
export FLYWAY_USER=postgres
read -rs -p 'Database password: ' DB_PASSWORD
export DB_PASSWORD
export FLYWAY_PASSWORD="$DB_PASSWORD"
export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGDATABASE=lumi_recruitment
export PGPASSWORD="$DB_PASSWORD"
```

Flyway đặt lịch sử trong `public.flyway_schema_history`, baseline version `0`, không tự baseline và vô hiệu hóa `clean`. Plugin và ứng dụng dùng cùng migration, cùng phiên bản Flyway do Spring Boot quản lý.

## Database mới

Tạo database rỗng bằng PostgreSQL rồi chạy `./mvnw spring-boot:run`. Flyway tự chạy V1 trước khi Hibernate validate. Không chạy `baseline` cho database mới. Nếu muốn tách bước migration: `./mvnw flyway:migrate`, sau đó khởi động ứng dụng.

## Database cũ có bảng trong public

1. Dừng tiến trình backend cũ, kể cả phiên chạy từ IDE, để Hibernate `update` không tạo lại bảng trong `public`. Kiểm tra không còn kết nối ứng dụng trước khi tiếp tục:

```sql
SELECT application_name, state, client_addr
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid();
```

2. Kiểm tra `public.users`, `public.candidate_profiles`, các cột, khóa và index bằng `psql` (`\d+ public.users`, `\d+ public.candidate_profiles`). Cấu trúc dự kiến nằm trong `src/test/resources/db/legacy_accounts.sql`. Đảm bảo chưa có hai bảng cùng tên ở schema đích và chưa có lịch sử Flyway. Nếu có trạng thái khác, kiểm tra trước khi baseline; baseline không chứng minh cấu trúc database đúng.

3. Sao lưu và xác nhận archive đọc được. `backups/` được bỏ qua trong Git; bảo vệ file vì chứa dữ liệu tài khoản.

```bash
mkdir -p backups
umask 077
backup_file="backups/accounts-before-schema-$(date +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner --no-privileges \
  --table=public.users --table=public.candidate_profiles --file="$backup_file"
pg_restore --list "$backup_file"
```

4. Chạy baseline rõ ràng tại version `0`, sau đó V1. Chỉ baseline một lần cho database cũ đã kiểm tra:

```bash
./mvnw flyway:baseline
./mvnw flyway:migrate
./mvnw flyway:validate flyway:info
```

V1 kiểm tra xung đột của cả hai bảng trước khi chuyển. Nếu cả nguồn và đích cùng tồn tại, migration báo lỗi và dừng; không gộp, xóa hay ghi đè dữ liệu. PostgreSQL chạy migration trong transaction. Không bật `baseline-on-migrate` để bỏ qua lỗi.

5. Đối chiếu số bản ghi trước/sau, UUID, dữ liệu và khóa ngoại. Các bảng, index và constraint đã chuyển giữ nguyên OID. Xác nhận `public.users` và `public.candidate_profiles` không còn; khóa ngoại hồ sơ tham chiếu `auth.users`. Khởi động backend với cấu hình mới và xác nhận Hibernate validate thành công.

```sql
SELECT table_schema, table_name FROM information_schema.tables
WHERE table_schema IN ('public', 'auth', 'candidate');
SELECT version, type, success FROM public.flyway_schema_history ORDER BY installed_rank;
SELECT count(*) FROM auth.users;
SELECT count(*) FROM candidate.candidate_profiles;
```

Sau khi V1 thành công, không sửa file V1 hoặc xóa lịch sử Flyway. Thay đổi tiếp theo dùng V2 trở lên. Không khởi động bản backend cũ dùng `ddl-auto: update` trên database đã chuyển.

## Kiểm thử

Test migration tạo database riêng với tên `lumi_schema_test_<uuid>` rồi tự xóa. Tài khoản test cần quyền tạo database. Không dùng tên database ứng dụng làm database thử nghiệm; URL dưới đây trỏ tới database quản trị `postgres`, không kèm query parameters.

```bash
export LUMI_TEST_POSTGRES_URL=jdbc:postgresql://localhost:5432/postgres
export LUMI_TEST_POSTGRES_USER=postgres
export LUMI_TEST_POSTGRES_PASSWORD="$DB_PASSWORD"
./mvnw -Dtest=AccountSchemaMigrationTest test
```

Test bao gồm database mới, dữ liệu mẫu trên cấu trúc cũ, giữ nguyên hàng/OID/index/constraint, yêu cầu baseline thủ công, xung đột ở từng bảng đích, chạy lại V1 không thay đổi dữ liệu, Hibernate validate và đọc/ghi qua repository. Test này tự bỏ qua nếu chưa đặt `LUMI_TEST_POSTGRES_URL`.

Sau khi database ứng dụng đã migration, chạy `./mvnw test` để kiểm tra cả test khởi động Spring hiện có. Test `contextLoads` dùng datasource của ứng dụng và sẽ chạy migration còn chờ, vì vậy chỉ chạy sau bước sao lưu/baseline với database cũ.

## Phục hồi

Nếu migration thất bại, kiểm tra log và trạng thái trước khi chạy lại; phần DDL V1 được rollback theo transaction. Baseline đã thực hiện trước đó vẫn còn.

Để phục hồi từ archive, dừng backend, tạo một database phục hồi mới rồi dùng `pg_restore --no-owner --no-privileges --dbname=<database_phuc_hoi> <archive>`. Archive chứa hai bảng tại `public` cùng dữ liệu và constraint. Kiểm tra database phục hồi trước khi đổi cấu hình kết nối. Nếu chạy code mới trên database phục hồi, thực hiện lại kiểm tra, baseline `0` và migrate. Không restore đè trực tiếp lên các bảng đã chuyển hoặc xóa database hiện tại.

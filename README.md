# Hệ Thống Quản Lý Cấp Phát Trang Bị Bảo Hộ Lao Động (PPE)

Hệ thống quản lý chuyên sâu cho phòng HSE (An Toàn Sức Khỏe Môi Trường), giúp theo dõi kế hoạch ngân sách bảo hộ, quản lý đơn giá nhà cung cấp, kiểm soát dòng hồ sơ thanh toán, đồng thời phê duyệt và theo dõi cấp phát PPE thực tế đến từng dự án công trình.

---

## 📖 BẢN ĐỒ TÀI KHOẢN MẶC ĐỊNH SƠ KHỞI

Hệ thống đã được thiết lập sẵn cơ sở dữ liệu SQLite động với 3 nhóm tài khoản phân quyền đại diện đầy đủ nghiệp vụ:

| Tên Đăng Nhập | Mật Khẩu | Họ và Tên | Vai Trò | Đặc Quyền Phân Cấp |
| :--- | :--- | :--- | :--- | :--- |
| **admin** | `password` | HSE Admin | **Admin** | **Toàn quyền hệ thống**: Quản trị tài khoản, phân nhãn vai trò, chỉnh sửa danh mục, phê duyệt yêu cầu, và sao lưu/khôi phục cơ sở dữ liệu. |
| **hse** | `password` | Nguyễn Văn A | **HSE** | **Người điều hành chuyên môn**: Thêm mới kế hoạch, kiểm toán hồ sơ thanh toán nhà cung cấp, giao nhận PPE và điều chỉnh danh mục hàng hóa. |
| **staff** | `password` | Nhân viên thường | **Staff** | **Quyền cơ bản (Chỉ đọc)**: Xem tiến độ cấp phát, kiểm tra thông tin kho bãi và ngân sách, không có quyền thay đổi dữ liệu hoặc phê duyệt. |

---

## 🚀 HƯỚNG DẪN SỬ DỤNG CHI TIẾT CÁC TÍNH NĂNG MỚI

### 1. Quản Lý Tài Khoản & Thay Đổi Mật Khẩu
* **Cách truy cập**: Bạn đăng nhập vào hệ thống -> Chọn tab **"Cài Đặt Hệ Thống"** ở menu chính -> Nhấp chọn phân mục **"👤 Quản Lý Tài Khoản"**.
* **Đổi Mật Khẩu Hiện Tại (Dành cho Tất cả các vai trò)**:
  1. Ở khung bên trái **"Thay Đổi Mật Khẩu"**, bạn nhập mật khẩu hiện tại (ví dụ: `password`).
  2. Điền mật khẩu mới của bạn và dòng xác nhận mật khẩu mới.
  3. Nhấn **"Cập nhật mật khẩu mới"**. Hệ thống sẽ đồng bộ hóa cơ sở dữ liệu SQLite ngay lập tức.
* **Thêm Mới Thành Viên & Phân Quyền (Chỉ dành cho quyền Admin)**:
  1. Với quyền **Admin**, khung bên phải sẽ hiển thị form **"Thêm Tài Khoản Mới"** và **"Danh sách tài khoản hệ thống"**.
  2. Nhập các thông tin bắt buộc: **Tên đăng nhập (username)**, **Mật khẩu ban đầu**, và **Họ Tên chủ sở hữu**.
  3. Chọn **Phân quyền vai trò**:
     * `Admin (🔑 Toàn quyền)`
     * `HSE Admin (📋 Duyệt/Ký)`
     * `Staff (🔒 Chỉ đọc)`
  4. Nhấn **"Khởi tạo tài khoản"**. Tài khoản mới sẽ xuất hiện ngay trong danh sách phía dưới và có thể đăng nhập lập tức.
  5. Bạn cũng có thể hủy/xóa bất kỳ tài khoản nào bằng nút **"🗑 Xóa tài khoản"** (không được phép xóa tài khoản `admin` gốc để tránh mất khóa quản trị).

---

### 2. Quản Lý Danh Mục Trang Bị PPE & Thêm Mới Thiết Bị Khác Vật Tư
Chào đón tính năng mở rộng danh mục vật tư bảo hộ tùy thích giúp người dùng dễ dàng theo sát thực tế biến động thị trường:
* **Cách truy cập**: Chọn tab **"Cài Đặt Hệ Thống"** -> Nhấp chuyển phân mục **"📊 Đơn Giá Kế Hoạch (PPE List)"**.
* **Thêm mới trang bị hoàn toàn khác vào bảng giá**:
  1. Nhấn nút **"➕ Thêm Mặt Hàng PPE Mới"** ở góc phải bảng giá.
  2. Điền thông tin vào phiếu khởi tạo:
     * **Tên Trang Bị** (Ví dụ: *Quần áo chống hóa chất 3M*, *Mặt nạ hàn điện cao cấp*, v.v.)
     * **Mã Định Danh** (Ví dụ: *PPE-035*)
     * **Đơn Giá Kế Hoạch (VNĐ)**
     * **Đơn vị tính** (Ví dụ: *Cái, Đôi, Bộ, Thùng*)
     * **Chọn Nhà Cung Cấp Mặc Định** và **Ngày Áp Dụng Đơn Giá**.
  3. Nhấn nút **"Tạo Mới & Đồng Bộ"**.
  4. Mặt hàng này sẽ lập tức được ghi vào cơ sở dữ liệu, đồng thời tự động khả dụng trong danh sách lựa chọn tạo yêu cầu cấp phát hoặc lập hồ sơ vận đơn giao nhận của phòng HSE trên toàn hệ thống.
* **Điều chỉnh giá cũ**: Bạn có thể nhấp vào biểu tượng bút chì kế bên từng món đồ để thực hiện thay đổi giá và ngày áp dụng của mặt hàng bảo hộ bất cứ lúc nào (lịch sử biến động giá sẽ tự động lưu lại trong Tab lịch sử giá).

---

## 🛠️ HƯỚNG DẪN DEPLOY TOÀN DIỆN LÊN RENDER.COM

Dự án này là ứng dụng **Full-stack thực thụ** kết hợp giữa React (Vite) ở cơ sở Frontend và **Node.js (Express) tích hợp SQLite cơ sở dữ liệu** ở Backend. Khi deploy lên Render, dự án sẽ được tự động biên dịch thành tệp sản phẩm chạy mượt mà thông qua `esbuild`.

Hãy thực hiện từng bước đơn giản sau đây để đưa ứng dụng lên máy chủ đám mây Render:

### Bước 1: Chuẩn bị Mã nguồn và Đẩy lên GitHub
1. Tạo một Kho lưu trữ mới (Repository) trên tài khoản GitHub cá nhân của bạn (ví dụ lấy tên: `pte-management-system`).
2. Khởi tạo Git trong thư mục dự án này, liên kết và đẩy toàn bộ mã nguồn lên GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initialize PPE fullstack application with advanced sqlite"
   git branch -M main
   git remote add origin https://github.com/USERNAME/pte-management-system.git
   git push -u origin main
   ```

### Bước 2: Tạo Dịch Vụ Mới "Web Service" Trên Render.com
1. Đăng nhập vào trang quản trị [Render.com](https://render.com).
2. Nhấn nút **New +** ở góc trên cùng bên phải và chọn **Web Service**.
3. Kết nối với tài khoản GitHub của bạn và chọn Repository `pte-management-system` vừa tải lên ở Bước 1.

### Bước 3: Cấu Hình Thông Số Deploy Trên Render
Tại màn hình cấu hình chi tiết cho Web Service, thiết lập chuẩn xác các trường thông tin sau:

* **Name**: *Tên ứng dụng của bạn* (Ví dụ: `quan-ly-cap-phat-ppe`)
* **Environment**: `Node`
* **Region**: Chọn khu vực gần bạn nhất (Ví dụ: `Singapore (Southeast Asia)`)
* **Branch**: `main`
* **Build Command** (Lệnh xây dựng phần mềm):
  ```bash
  npm install && npm run build
  ```
* **Start Command** (Lệnh khởi động sản phẩm hoàn thiện):
  ```bash
  npm run start
  ```

### 💡 Bước 4: Cấu Hình Lưu Trữ Bền Vững Đọc Ghi SQLite (CỰC KỲ QUAN TRỌNG)
Mặc định dịch vụ Free Tier của Render sử dụng phân vùng đĩa tạm thời (Ephemeral disk), tức là cơ sở dữ liệu SQLite (`ppe_management.db`) sẽ tự động bị xóa sạch và reset về dữ liệu mẫu sơ khai mỗi lần server ngủ đông hoặc deploy mã mới. 

Để giữ cho dữ liệu tài khoản, mật khẩu tự tạo và lịch sử kế hoạch cấp phát của bạn luôn được lưu trữ vĩnh viễn không bao giờ mất, hãy làm theo 1 trong 2 phương án tối ưu sau:

#### Phương án A: Sử dụng Đĩa Cứng Di Động của Render (Render Persistent Disk - KHUYÊN DÙNG)
*Bạn cần nâng cấp gói Web Service lên hạng có trả phí tối thiểu của Render (chỉ từ 1$/tháng cho đĩa cứng):*
1. Tại cài đặt dịch vụ của bạn trên Render, chuyển đến Tab **"Disks"**.
2. Nhấn **"Add Disk"**:
   * **Name**: `ppe-database`
   * **Mount Path**: `/opt/ppe-data`
   * **Size**: `1 GB` (hoặc lớn hơn tùy nhu cầu)
3. Chuyển sang Tab **"Env Groups"** hoặc **"Environment"** của Web Service, tạo một biến môi trường để chỉnh định hướng lưu trữ CSDL sang phân vùng đĩa cứng bền vững vừa gắn:
   * Key: `DB_PATH`
   * Value: `/opt/ppe-data/ppe_management.db`
4. Hệ thống Node.js ở server sẽ tự động nhận diện đường dẫn này để lưu toàn bộ tệp tin dữ liệu bảo mật bền vững an toàn tuyệt đối.

#### Phương án B: Giữ CSDL miễn phí bằng cách sử dụng Tính Năng Backup sẵn có của Web
*Trong trường hợp bạn dùng hoàn toàn gói Free Tier (Miễn phí) không hỗ trợ gắn ổ cứng:*
1. Hệ thống đã tích hợp sẵn tính năng **"Sao Lưu CSDL (SQLite Backup)"** ở Tab **"Cài đặt hệ thống"**.
2. Thỉnh thoảng sau khi thực hiện các hoạt động nhập liệu lớn, bạn chỉ cần bấm **"Tải Bản Sao Lưu (.db)"** về máy tính cá nhân để lưu giữ.
3. Nếu máy chủ Render có khởi động lại làm mới dữ liệu, bạn chỉ cần nhấn **"Khôi Phục Từ File"** và chọn tệp `.db` đã tải về trước đó từ máy mình để lấy lại toàn bộ 100% dữ liệu gốc chỉ trong 1 giây mà không tốn bất kỳ chi phí nào!

---

## 🏆 ĐẶC TÍNH VÀ TIÊU CHUẨN XÂY DỰNG
* **Mã nguồn chất lượng cao**: Đã tích hợp trình kiểm soát cú pháp nghiêm ngặt (Linter) và biên dịch an toàn 100% trước khi triển khai.
* **Tự thích ứng đa nền tảng**: Giao diện UI thiết kế Responsive hoàn hảo trên điện thoại thông minh, máy tính bảng và màn hình máy tính để bàn PC cỡ lớn.
* **Thời gian thực**: Giao động xử lý tối ưu hóa băng thông, tốc độ phản hồi cực nhanh, bảo mật dữ liệu cấp cơ sở.

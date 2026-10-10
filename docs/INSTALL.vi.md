# Cài Markdown Viewer bằng một lệnh

Dành cho người không chuyên. Không cần tự cài Git, Node.js, npm hoặc công cụ đóng gói.

## Cài mới hoặc cập nhật

1. Lưu tài liệu và đóng MD Viewer nếu đang mở.
2. Mở **Terminal**: macOS dùng Command + Space rồi nhập `Terminal`; Ubuntu dùng Ctrl + Alt + T.
3. Sao chép **toàn bộ dòng lệnh dưới đây**, dán vào Terminal và nhấn Enter. Chờ dòng `MD Viewer installed successfully`.

```bash
bash -c 'set -e; command -v curl >/dev/null || { sudo apt-get update; sudo apt-get install -y curl ca-certificates; }; mdviewer_script=$(mktemp); trap "rm -f \"$mdviewer_script\"" EXIT; curl -fsSL https://raw.githubusercontent.com/thientranvan/markdown_viewer/main/install.sh -o "$mdviewer_script"; bash "$mdviewer_script"'
```

Lệnh này tải và chạy bộ cài từ repo chính thức `thientranvan/markdown_viewer`. Bộ cài chỉ chạy sau khi tải xong; lỗi tải sẽ dừng lệnh. Cần Internet trong lúc cài. Không chạy cả lệnh với `sudo`.

**Trên Linux**, bộ cài có thể hỏi mật khẩu đăng nhập để cài thư viện hệ thống và cấu hình helper sandbox của Electron. Khi gõ mật khẩu, Terminal không hiện ký tự. Helper được đặt chủ sở hữu `root` và quyền `4755` để Electron sử dụng sandbox; bộ cài không dùng `--no-sandbox`. Tài liệu của bạn không bị xóa.

Chạy lại **chính lệnh trên** để cập nhật bản mới. Không cần clone repo hoặc gõ thêm lệnh npm.

## Hệ điều hành hỗ trợ

- **macOS 13.5 trở lên**, chip Apple Silicon hoặc Intel 64-bit.
- **Ubuntu 22.04 trở lên / Debian 12 trở lên**, có giao diện desktop, chip Intel/AMD 64-bit hoặc ARM64, tài khoản có quyền `sudo`.
- Windows và các bản Linux khác chưa có bộ cài tự động trong repo.

Bộ cài macOS đã được chạy trực tiếp, gồm trường hợp không có Node.js trong PATH. Luồng Linux có kiểm thử launcher, đăng ký desktop và khôi phục khi lỗi; chưa chạy toàn bộ trên máy Linux thật.

## Bộ cài tự làm gì?

- Tự nhận diện hệ điều hành và chip.
- Dùng Node.js có sẵn nếu phiên bản từ 22.12.0; nếu thiếu, tải Node.js 24 LTS chính thức và kiểm tra SHA-256. Không sửa Node.js đang có trên máy.
- Tải mã nguồn, cài đúng thư viện theo lockfile, kiểm tra lỗ hổng và chạy kiểm thử. Nếu kiểm tra thất bại, dừng trước khi thay ứng dụng.
- **macOS:** tạo `MD Viewer.app`, icon riêng, ký ad hoc và đăng ký mở Markdown bằng cách nhấp đúp. Không cần Xcode hoặc công cụ đóng gói bên ngoài.
- **Linux:** cài thư viện hệ thống, ứng dụng, icon, mục menu và đăng ký mở `.md`, `.markdown`, `.mdown`, `.mkd`. Launcher chạy Electron trực tiếp, không phụ thuộc PATH của nvm hoặc Terminal.
- Giữ bản cũ trong thư mục backup; khôi phục ứng dụng khi bước thay bản/đăng ký thất bại.

`npm audit` phản ánh các lỗ hổng được registry biết tại thời điểm kiểm tra, không phải bảo đảm ứng dụng không có mọi loại lỗ hổng. Bộ cài dừng nếu audit phát hiện lỗ hổng từ mức low trở lên.

## Mở ứng dụng và vị trí cài

**macOS:** mở `MD Viewer` trong Applications hoặc nhấp đúp file Markdown. Cài mới vào `~/Applications/MD Viewer.app`. Nếu đã có bản đúng bundle ID trong `/Applications` và thư mục này có quyền ghi, bộ cài cập nhật bản đó. Nếu không có quyền ghi, bộ cài giữ nguyên bản hệ thống và cài bản mới vào `~/Applications`; hãy mở đúng bản trong thư mục này.

**Linux:** tìm **MD Viewer** trong menu ứng dụng hoặc nhấp đúp file Markdown. Ứng dụng nằm tại `~/.local/share/md-viewer/app`; giữ thư mục này để app tiếp tục chạy.

Node.js do bộ cài tải, nếu cần, nằm tại `~/.local/share/md-viewer/node`. Bộ cài không sửa cấu hình shell hoặc thay ứng dụng bằng quyền root.

Backup nằm trong `.md-viewer-backups` ở cùng thư mục cha với app: macOS thường là `~/Applications/.md-viewer-backups` hoặc `/Applications/.md-viewer-backups`; Linux là `~/.local/share/md-viewer/.md-viewer-backups`. Trong Finder có thể nhấn Command + Shift + . để hiện thư mục ẩn. Backup chỉ chứa ứng dụng, không chứa tài liệu Markdown của bạn.

## Sử dụng

- **Open:** chọn file hoặc thư mục; nếu chọn thư mục, app tìm `README.md` hoặc file Markdown đầu tiên.
- **Save / Save As:** lưu file hiện tại / lưu thành file khác.
- **View / Split / Edit:** xem bản trình bày / xem và chỉnh sửa song song / chỉ chỉnh sửa.
- Trong **Split**, cuộn một bên sẽ cuộn bên còn lại theo nội dung tương ứng.

Công thức trong dòng và công thức riêng dòng:

```markdown
Mật độ electron là $n_{2D}$.

$$ N_D L = n_{2D} $$

$$
\boxed{n_{2D}\approx\frac{\varepsilon_0\varepsilon_b}{e^2}\frac{\Delta E_c-E_{DD}}{s+h+\tfrac14 a_B}}
$$
```

KaTeX hỗ trợ tập con của LaTeX: <https://katex.org/docs/supported.html>. Dấu `$` trong code block hoặc đoạn code trong dấu backtick không render thành toán. Công thức lỗi không làm dừng toàn bộ preview.

Metadata Marp/YAML phải nằm ngay đầu file, giữa hai dòng `---`:

```markdown
---
marp: true
theme: default
paginate: true
math: katex
style: |
  section { background: #0B1A2B; color: #F1F6FC; }
---

# KHÍ ELECTRON HAI CHIỀU (2DEG)
```

Preview ẩn metadata, editor giữ nguyên để chỉnh sửa/lưu. App chưa áp dụng theme/CSS Marp, chia slide hoặc xuất slide. Nếu bỏ hai dòng `---`, phần cấu hình hiện như văn bản.

## Xử lý lỗi

- **App còn đang mở:** lưu tài liệu, thoát MD Viewer rồi chạy lại lệnh cài. Bộ cài macOS không buộc đóng ứng dụng để tránh mất nội dung chưa lưu.
- **Có hai bản app trên macOS:** nếu bản hệ thống không có quyền ghi, bản mới nằm trong `~/Applications`; mở bản đó. Không chạy toàn bộ bộ cài bằng `sudo`.
- **Lỗi mạng, checksum hoặc tải npm:** kiểm tra Internet/proxy và chạy lại cùng lệnh. Không bỏ qua kiểm tra checksum hoặc audit.
- **Audit phát hiện lỗ hổng:** chờ bản repo cập nhật thư viện; gửi thông báo audit trên Issues. Không tự dùng `npm audit fix --force` để vượt kiểm tra.
- **Linux báo không có desktop hoặc sudo:** chạy từ Terminal trong phiên desktop bằng tài khoản có quyền sudo. SSH/máy chủ không giao diện chưa được hỗ trợ.
- **macOS chặn mở app:** bản tự cài chưa được Apple notarize. Sau khi xác nhận app do chính bộ cài này tạo, dùng **System Settings → Privacy & Security → Open Anyway** nếu tùy chọn xuất hiện. Không tắt Gatekeeper toàn hệ thống.
- **Công thức/CSS vẫn hiện như chữ:** kiểm tra cặp dấu `$`/`$$`, khối YAML có hai dòng `---` ở đầu file, và mở đúng app mới.

Nếu vẫn lỗi, mở <https://github.com/thientranvan/markdown_viewer/issues>, gửi hệ điều hành và toàn bộ thông báo lỗi. Không gửi mật khẩu, token hoặc tài liệu riêng tư.

## Người phát triển đã có repo

Từ thư mục repo, một lệnh cài mã nguồn hiện tại:

```bash
bash install.sh --local "$PWD"
```

Lệnh này không pull hoặc thay đổi checkout hiện tại; app được cài độc lập. Sửa mã nguồn rồi chạy lại để cập nhật app.

## Gỡ cài đặt

Linux: gỡ đăng ký desktop bằng Node.js do bộ cài quản lý nếu có:

```bash
"$HOME/.local/share/md-viewer/node/bin/node" "$HOME/.local/share/md-viewer/app/scripts/uninstall-desktop.js"
```

Nếu bộ cài đã dùng Node.js có sẵn, thay đường dẫn đầu bằng `node`. Sau đó có thể xóa thư mục app bằng trình quản lý file. Lệnh không xóa tài liệu Markdown.

macOS: đóng MD Viewer rồi chuyển app vào Trash bằng Finder. Các bản backup và tài liệu vẫn giữ nguyên.

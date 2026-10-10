# Cài Markdown Viewer — hướng dẫn cho người không chuyên

Markdown Viewer mở và chỉnh sửa file `.md`, hiển thị công thức toán và xem song song nội dung gốc với bản trình bày. Cần Internet khi cài; sau đó ứng dụng đọc file và render công thức ngay trên máy, không cần mạng.

Chọn phần phù hợp: [macOS](#macos) hoặc [Ubuntu/Debian](#ubuntudebian). Windows chưa có hướng dẫn cài được kiểm chứng trong repo.

## Cách dùng Terminal

Terminal là cửa sổ nhập lệnh. Sao chép từng khối lệnh bên dưới, dán vào Terminal rồi nhấn Enter. Chờ lệnh chạy xong và xuất hiện dòng nhập lệnh mới trước khi làm bước tiếp theo. Không nhập các dấu ``` bao quanh khối lệnh.

Nếu lệnh báo lỗi, dừng tại bước đó và xem phần xử lý lỗi cuối trang. Với lệnh `sudo`, máy có thể yêu cầu mật khẩu đăng nhập; khi gõ mật khẩu, màn hình không hiện ký tự.

## macOS

### 1. Cài công cụ cần thiết

1. Vào <https://nodejs.org/en/download>, tải bộ cài macOS `.pkg` của **Node.js 24 LTS**, mở file và hoàn thành cài đặt. npm được cài cùng Node.js. Yêu cầu tối thiểu của Electron hiện tại là Node.js **22.12.0**.
2. Mở Terminal: nhấn Command + Space, nhập `Terminal`, nhấn Enter.
3. Chạy lệnh sau để cài công cụ của Apple, gồm Git. Nếu máy báo đã cài thì bỏ qua; nếu xuất hiện cửa sổ cài đặt, hoàn thành và chờ cài xong.

```bash
xcode-select --install
```

Đóng Terminal, mở lại, kiểm tra:

```bash
node --version
npm --version
git --version
```

Cả ba lệnh cần hiện số phiên bản. Node.js nên hiện `v24...`.

### 2. Tải mã nguồn và kiểm tra

Chỉ chạy `git clone` lần đầu. Nếu đã có repo, dùng phần cập nhật bên dưới.

```bash
mkdir -p "$HOME/dev"
cd "$HOME/dev"
git clone https://github.com/thientranvan/markdown_viewer.git
cd markdown_viewer
npm ci
npm test
```

`npm ci` tải đúng phiên bản thư viện trong repo, có thể mất vài phút. Khi kiểm tra thành công, cuối kết quả có `MD Viewer check passed.` và `Markdown math and frontmatter checks passed.`.

Chạy thử:

```bash
npm start -- samples/demo.md
```

Đóng cửa sổ ứng dụng trước khi đóng gói.

### 3. Tạo ứng dụng và cài vào máy

Lệnh sau tải công cụ đóng gói Electron và tạo ứng dụng phù hợp với chip của máy hiện tại (Apple Silicon hoặc Intel). Không cần tự chọn kiến trúc.

```bash
cd "$HOME/dev/markdown_viewer"
npx --yes @electron/packager@20.3.0 . "MD Viewer" --platform=darwin --out=dist --overwrite --app-bundle-id=com.thientranvan.markdown-viewer
```

Ứng dụng được cài vào `~/Applications`, là thư mục Applications riêng của tài khoản. Nếu đã có bản cũ tại đây, khối lệnh sau giữ bản sao trước khi cập nhật. Hãy đóng MD Viewer và lưu các tài liệu đang chỉnh sửa trước khi chạy.

```bash
mkdir -p "$HOME/Applications"
MDVIEWER_ARCH="$(node -p 'process.arch')"
MDVIEWER_APP="$HOME/Applications/MD Viewer.app"
if [ -d "$MDVIEWER_APP" ]; then
  ditto "$MDVIEWER_APP" "$HOME/Applications/MD Viewer-backup-$(date +%Y%m%d-%H%M%S).app"
fi
ditto "dist/MD Viewer-darwin-$MDVIEWER_ARCH/MD Viewer.app" "$MDVIEWER_APP"
open "$MDVIEWER_APP"
```

Các biến trong khối lệnh này cần chạy trong cùng cửa sổ Terminal. Có thể mở lại app từ Finder: chọn **Go → Go to Folder**, nhập `~/Applications`, mở **MD Viewer.app**. Nếu máy đã có bản khác trong `/Applications`, mở đúng bản trong `~/Applications` để sử dụng thay đổi mới.

Bản tự đóng gói chưa được Apple notarize. Nếu macOS chặn mở, kiểm tra rằng bạn vừa tạo app từ repo này rồi dùng **System Settings → Privacy & Security → Open Anyway** nếu tùy chọn xuất hiện. Không cần tắt Gatekeeper toàn hệ thống.

Bản đóng gói bằng lệnh trên dùng icon Electron và chưa tự đăng ký mở `.md` bằng cách nhấp đúp. Dùng nút **Open** trong ứng dụng để chọn tài liệu.

## Ubuntu/Debian

Các lệnh dưới đây dành cho Ubuntu/Debian có giao diện desktop; không dành cho máy chủ chỉ có dòng lệnh. Fedora, Arch và các bản Linux khác cần lệnh cài gói tương ứng.

### 1. Cài công cụ hệ thống

Mở Terminal bằng Ctrl + Alt + T:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates xdg-utils libglib2.0-bin desktop-file-utils shared-mime-info
```

### 2. Cài Node.js 24 LTS

Khối lệnh này tải và chạy bộ cài nvm từ repo chính thức `nvm-sh/nvm`. nvm quản lý Node.js trong tài khoản của bạn, không cần `sudo npm`.

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh -o /tmp/mdviewer-nvm-install.sh
bash /tmp/mdviewer-nvm-install.sh
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 24
nvm alias default 24
node --version
npm --version
```

### 3. Tải, kiểm tra và đăng ký ứng dụng

```bash
mkdir -p "$HOME/dev"
cd "$HOME/dev"
git clone https://github.com/thientranvan/markdown_viewer.git
cd markdown_viewer
npm ci
npm test
npm run install-desktop
npm start -- samples/demo.md
```

Khi kiểm tra thành công, kết quả có `MD Viewer check passed.` và `Markdown math and frontmatter checks passed.`. Sau đăng ký, tìm **MD Viewer** trong danh sách ứng dụng hoặc nhấp đúp file `.md`, `.markdown`, `.mdown`, `.mkd`.

Giữ thư mục `~/dev/markdown_viewer`: ứng dụng Linux chạy từ đó. Nếu chuyển thư mục, vào vị trí mới và chạy lại `npm run install-desktop`.

Kiểm tra ứng dụng mặc định:

```bash
xdg-mime query default text/markdown
xdg-mime query default text/x-markdown
```

Kết quả mong đợi: `mdviewer.desktop`.

## Cập nhật khi có phiên bản mới

Lưu tài liệu và đóng ứng dụng trước khi cập nhật. Nếu đã tự chỉnh mã nguồn, `git pull --ff-only` có thể dừng để bảo vệ thay đổi; không dùng lệnh xóa hoặc reset để xử lý.

```bash
cd "$HOME/dev/markdown_viewer"
git pull --ff-only
npm ci
npm test
```

- **macOS:** chạy lại toàn bộ bước 3 trong phần macOS để đóng gói và thay bản trong `~/Applications`.
- **Linux:** chạy `npm run install-desktop`, rồi mở lại ứng dụng.

## Sử dụng

- **Open:** chọn file hoặc thư mục; nếu chọn thư mục, app tìm `README.md` hoặc file Markdown đầu tiên.
- **Save:** lưu thay đổi vào file hiện tại.
- **Save As:** lưu thành file khác.
- **View / Split / Edit:** xem bản trình bày / xem và chỉnh sửa song song / chỉ chỉnh sửa.
- Trong **Split**, cuộn một bên sẽ cuộn bên còn lại theo nội dung tương ứng.

Công thức trong dòng:

```markdown
Mật độ electron là $n_{2D}$.
```

Công thức riêng một dòng hoặc nhiều dòng:

```markdown
$$ N_D L = n_{2D} $$

$$
\boxed{n_{2D}\approx\frac{\varepsilon_0\varepsilon_b}{e^2}\frac{\Delta E_c-E_{DD}}{s+h+\tfrac14 a_B}}
$$
```

KaTeX hỗ trợ tập con của LaTeX; xem <https://katex.org/docs/supported.html>. Công thức không hợp lệ không làm dừng toàn bộ preview. Dấu `$` trong code block hoặc đoạn code trong dấu backtick không được render thành toán.

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

Preview ẩn khối metadata này, editor vẫn giữ nguyên để chỉnh sửa và lưu. App hiện xem như tài liệu Markdown thông thường: chưa áp dụng theme/CSS Marp, chưa chia slide hoặc xuất slide. Nếu bỏ hai dòng `---`, phần cấu hình sẽ xuất hiện như văn bản.

## Xử lý lỗi thường gặp

- **`node: command not found` hoặc `npm: command not found`:** hoàn thành bước cài Node.js, đóng và mở lại Terminal. Trên Linux chạy `. "$HOME/.nvm/nvm.sh"` nếu đang dùng nvm.
- **Lỗi phiên bản Node.js:** kiểm tra `node --version`, cài Node.js 24 LTS rồi chạy lại `npm ci`.
- **`destination path ... already exists`:** repo đã có; dùng phần cập nhật thay vì clone lại.
- **Không tải được thư viện:** kiểm tra Internet/proxy rồi chạy lại `npm ci`. Không dùng `sudo npm ci`.
- **Lệnh mở app báo Electron chưa cài:** vào đúng `~/dev/markdown_viewer` và chạy `npm ci`.
- **Linux báo thiếu thư viện hệ thống:** dùng tên thư viện trong thông báo để xác định gói phù hợp với phiên bản Linux; không tắt sandbox bằng `--no-sandbox` để né lỗi.
- **Linux báo `node` không tìm thấy khi mở từ menu:** Node.js cài bằng nvm có thể chỉ có trong môi trường Terminal. Mở Terminal, chạy `cd "$HOME/dev/markdown_viewer"` rồi `npm start` để dùng ứng dụng; đăng ký desktop không tự cấu hình PATH cho nvm.
- **Linux nhấp đúp chưa mở đúng app:** đóng cửa sổ app cũ, chạy lại `npm run install-desktop`, kiểm tra với `xdg-mime` ở trên.
- **Công thức vẫn hiện dạng chữ:** mở bản app mới, kiểm tra cặp dấu `$`/`$$`; khối code không render toán.
- **CSS/Marp hiện thành chữ:** kiểm tra khối YAML có hai dòng `---` và nằm ngay đầu file.

Nếu vẫn lỗi, mở <https://github.com/thientranvan/markdown_viewer/issues>, gửi hệ điều hành, kết quả `node --version`, lệnh đã chạy và thông báo lỗi. Tránh gửi nội dung tài liệu riêng tư.

## Gỡ cài đặt

Linux: gỡ đăng ký desktop bằng lệnh sau. Lệnh không xóa repo hoặc tài liệu Markdown.

```bash
cd "$HOME/dev/markdown_viewer"
npm run uninstall-desktop
```

macOS: đóng MD Viewer rồi chuyển `~/Applications/MD Viewer.app` vào Trash bằng Finder. Repo và tài liệu của bạn vẫn giữ nguyên; các bản backup có thể giữ để khôi phục.

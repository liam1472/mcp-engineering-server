# MASTER PLAN  
## Tận dụng hạ tầng Web để “thiết quân luật” cho Nhúng  
**From Low-Hanging Fruit → High-Tech Intelligence**

---

## I. TƯ DUY CHỦ ĐẠO

Bạn đang **ngồi trên mỏ vàng hạ tầng Web**:

- Quản lý session
- Quét Regex
- Indexing / Knowledge Base
- Prompt orchestration

… nhưng lại muốn **đào khoáng sản Nhúng**.

👉 Thay vì xây AI Nhúng từ đầu, ta **tận dụng triệt để khung sẵn có**:
- `/eng-security` → Cảnh sát
- `/eng-init` → Hiến pháp
- `/eng-start` → Tiêm luật vào não AI

🎯 Mục tiêu tổng quát:

> **Không cần AI quá thông minh — chỉ cần nó “biết sợ luật”.**

---

# II. GIAI ĐOẠN 1 — “THIẾT QUÂN LUẬT” (THE ENFORCER)

🎯 **Mục tiêu:**  
Chặn ngay code Nhúng “bẩn” bằng luật cứng.  
Không ML. Không suy luận. **Luật là luật.**

---

## 1. Nâng cấp `/eng-security` — Cảnh sát vào cuộc (Quick Win)

### Hiện trạng
- `/eng-security` đã có logic quét Regex (API key, secret).

### Action
- Mở `src/config/security.ts` (hoặc file tương đương).
- Thêm khái niệm **Security Profile**:
  - `web`
  - `embedded`
  - `dotnet`

### Task
Tạo file:

patterns.embedded.yaml


```yaml
- name: "Dynamic Memory"
  regex: "\\b(malloc|calloc|free|new)\\b"
  level: "CRITICAL"
  message: "Cấm dùng bộ nhớ động! Hãy dùng Static Buffer."

- name: "Blocking Delay"
  regex: "\\bdelay\\([0-9]{3,}\\)"
  level: "WARNING"
  message: "Delay > 100ms sẽ chặn hệ thống. Dùng millis() hoặc timer."
Kết quả
Chạy /eng-security trên project Nhúng → lỗi đỏ ngay lập tức

Dev viết ẩu → bị bắt tại trận

Không cần AI, nhưng kỷ luật xuất hiện ngay

2. Manifesto Template — Hiến pháp kỹ thuật (Impact cao nhất)
Action
Tạo thư mục:

src/templates/manifestos/
Task
Viết các “hiến pháp” theo domain:

embedded.md
❌ Cấm malloc/free/new

❌ Cấm delay blocking

✅ Bắt buộc watchdog

✅ Static buffer, deterministic timing

web.md
❌ Cấm blocking main thread

❌ Cấm callback hell

✅ Clean architecture

✅ Proper error handling

dotnet.md
❌ Cấm async void

❌ Cấm service locator

✅ Dependency Injection

✅ Explicit lifetime scope

Update /eng-init
Logic khởi tạo:

Detect package.json → copy web.md

Detect platformio.ini → copy embedded.md

Detect .csproj → copy dotnet.md

📁 Output cố định:

.engineering/manifesto.md
Kết quả
Project mới luôn có luật

Luật nằm chình ình trong repo

Không ai có thể nói “em không biết”

3. Tiêm luật vào não AI — /eng-start (x10 hiệu quả)
Action
Sửa handler của:

/eng-start
Task
Đọc .engineering/manifesto.md

Append nội dung vào system prompt gửi lên AI

Pseudo-flow:

System Prompt
+ Engineering Manifesto
+ User Request
Kết quả
AI tự nhiên viết code đúng luật

Ít phải nhắc lại

Prompt thông minh hơn mà không tăng token hỏi đáp

👉 Đây là điểm ROI cao nhất toàn hệ thống.

III. GIAI ĐOẠN 2 — “BỘ NÃO THỨ HAI” (THE SECOND BRAIN)
🎯 Mục tiêu:
Giải quyết:

Quên bài

Context nặng

Knowledge Base phình to

1. Tái cấu trúc Knowledge Base (Long-term bắt buộc)
Hiện trạng
knowledge/base.yaml chứa cả metadata + nội dung dài

MCP startup chậm

Token gửi đi dư thừa

Action
Viết migration script hoặc sửa logic lưu knowledge.

Cấu trúc mới
knowledge/
├── index.yaml
└── details/
    ├── 2026-01-17_fix-i2c-timeout.md
    ├── 2026-01-20_dma-buffer-rule.md
Quy tắc lưu
index.yaml:

title

tags

summary (1–2 dòng)

path tới file detail

details/*.md:

Nội dung đầy đủ

Code

Bài học rút ra

Kết quả
MCP khởi động nhanh

Context load nhẹ

Knowledge scale được dài hạn

2. Nâng cấp /eng-knowledge — Retrieval thông minh
Task
Implement Fuzzy Search trên knowledge/index.yaml

Chỉ load file detail khi thực sự cần

Flow
User question
→ Fuzzy search index
→ Pick best match
→ Load 1 markdown duy nhất
Kết quả
Trả lời nhanh

Ít token

Không “đọc lại cả cuộc đời”

IV. GIAI ĐOẠN 3 — “TỰ ĐỘNG HÓA KINH NGHIỆM” (THE LEARNING LOOP)
🎯 Mục tiêu:
Biến refactor hằng ngày thành tri thức tích lũy.
Đây là Killer Feature.

1. /eng-refactor --learn — Hệ thống tự học
Action
Nâng cấp lệnh:

/eng-refactor --learn
Logic
Refactor code như bình thường

Gửi request phụ tới AI:

"So sánh code trước và sau.
Rút ra 1 quy tắc kỹ thuật ≤ 20 từ."
Append rule vào:

.engineering/manifesto.md
Ví dụ rule sinh ra
“Không dùng malloc trong ISR”

“I2C luôn có timeout”

“Không delay trong main loop”

Kết quả
Lỗi hôm nay → luật ngày mai

Hệ thống tự tiến hóa

Không cần họp rút kinh nghiệm

2. Onboarding thông minh — /eng-init nâng cao
Action
Mở rộng /eng-init

Task
Quét project cũ:

Đọc platformio.ini → xác định MCU

Sinh hardware.yaml

Phân tích folder structure

Nhận diện kiến trúc hiện tại

Kết quả
AI hiểu dự án ngay từ ngày đầu

Không cần giải thích thủ công

Onboarding nhanh, ít lỗi

V. LỘ TRÌNH TRIỂN KHAI (ACTIONABLE SPRINT PLAN)
Sprint 1 — Quick Win (≈ 2 ngày)
Tạo templates/manifestos/

Update /eng-init để copy manifesto

Update /eng-security load regex Nhúng

✅ Có luật
✅ Có cảnh sát

Sprint 2 — Core Value (≈ 3 ngày)
Update /eng-start

Inject manifesto vào system prompt

🚀 AI viết code đúng luật ngay từ đầu

Sprint 3 — Intelligence Layer (≈ 5 ngày)
Split Knowledge Index / Details

Implement /eng-refactor --learn

🧠 Hệ thống bắt đầu tự học & tích lũy kinh nghiệm

KẾT LUẬN
Bạn không xây AI Nhúng.
Bạn đang xây HỆ ĐIỀU HÀNH KỶ LUẬT KỸ THUẬT.

Luật rõ ràng → AI ngoan → Code sạch → Hệ thống tiến hóa.
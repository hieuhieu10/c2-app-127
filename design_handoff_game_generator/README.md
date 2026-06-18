# Handoff: AI Learning Game Generator - Chat & Preview Flow

Thư mục này chứa tài liệu handoff thiết kế cho luồng tạo game bằng AI và màn preview/review. Các file HTML trong thư mục là **design reference**, không phải production code để copy trực tiếp.

## Mục Tiêu

Thiết kế mô tả một công cụ cho giáo viên trong bối cảnh GDPT 2018. Giáo viên nhập prompt, chọn môn/lớp/difficulty, có thể đính kèm giáo án hoặc slide, sau đó xem pipeline AI tạo game và chuyển sang màn chỉnh sửa nội dung.

Luồng có hai màn chính:

1. **Generator Chat**: giáo viên nhập yêu cầu, xem pipeline chạy theo từng bước như parse tài liệu, retrieval GDPT, recommend game, generate, safety gate, schema validation và build.
2. **Preview / Approve / Publish**: giáo viên xem trước game, chỉnh sửa từng câu hỏi/cặp matching, kiểm tra safety/fidelity và publish.

## Cách Dùng File Thiết Kế

- Các file HTML chỉ dùng để tham khảo layout, copy, spacing và visual style.
- Không copy trực tiếp wrapper như `<x-dc>`, `<helmet>`, `support.js` hoặc `data-props`.
- Styling trong prototype là inline style; khi implement cần chuyển thành pattern phù hợp với codebase hiện tại.
- Pipeline, safety result và game content trong prototype là mock/sample data; production phải nối với backend thật.
- Icon trong prototype là inline SVG; khi code nên dùng icon library đang có, ví dụ Lucide.

## Design Tokens

### Màu Chính

| Token | Giá trị | Cách dùng |
|---|---|---|
| `primary` | `#4f46e5` | Button chính, active nav, link, accent |
| `primary-strong` | `#3730a3` | Text indigo ở trạng thái active |
| `primary-tint` | `#eef0fe` | Background cho active nav, avatar, chip |
| `ink` | `#1b2333` | Text chính |
| `ink-secondary` | `#5b6577` | Text phụ |
| `ink-muted` | `#8b94a6` / `#9aa2b2` | Caption, metadata |
| `bg-app` | `#f4f5f8` | Background app |
| `surface` | `#ffffff` | Card, sidebar, top bar |
| `border` | `#e9ebf1` | Border/divider mặc định |
| `success` | `#0d9f6e` | Check/pass |
| `warning` | `#d98a04` | Warning |
| `warning-tint` | `#fdf3e0` | Background warning/draft |

### Typography

- Font: `Be Vietnam Pro`, fallback `sans-serif`.
- Base size: `15px`.
- Weight chính: `400`, `500`, `600`, `700`.
- Heading trong panel nên gọn, không dùng hero-scale type.

### Spacing Và Radius

- Spacing theo nhịp gần `8px`: các giá trị thường dùng là `6`, `8`, `10`, `14`, `16`, `18`, `22`, `26`, `30`.
- Radius: chip `7-9px`, button `9-12px`, card `13-16px`, composer `18px`.
- Border mặc định `1px`, tile active/matched có thể `1.5px` hoặc `2px`.

## Screen 1 - Generator Chat

Màn này là giao diện tạo game.

Thành phần chính:

- Sidebar cố định `256px`, có logo, nút tạo game mới, nav và danh sách gần đây.
- Top bar có breadcrumb, trạng thái bản nháp và nút lưu.
- Thread chat hiển thị yêu cầu của giáo viên và phản hồi của AI.
- Pipeline card hiển thị các bước chỉ khi bước đó bắt đầu chạy.
- Recommendation cards hiển thị các game phù hợp sau `/recommend/games`.
- Safety gate card hiển thị kết quả kiểm định.
- Ready card dẫn sang màn preview/review.
- Composer gồm subject, grade, difficulty, prompt và file attachment.

Yêu cầu interaction:

- Send bị disable khi pipeline đang chạy.
- Stage chuyển trạng thái `pending -> running -> done/warning/error`.
- Game recommendation phải cho giáo viên chọn game trước khi generate content.
- Khi backend stream event, UI cập nhật từng bước theo event.

## Screen 2 - Preview / Approve / Publish

Màn này dùng để xem và chỉnh sửa nội dung game.

Thành phần chính:

- Top bar có nút quay lại chat, title game, trạng thái draft/published và action publish.
- Cột trái là content editor cho câu hỏi hoặc matching pairs.
- Vùng giữa là game shell preview/play-test.
- Cột phải là safety summary và publish settings.

Yêu cầu interaction:

- Teacher có thể click từng item để sửa.
- Preview/play toggle chuyển giữa xem tĩnh và chơi thử.
- Publish chỉ cho phép khi safety/schema đạt yêu cầu.
- Sau khi publish, UI chuyển sang trạng thái published và hiển thị share link.

## State Gợi Ý

```ts
pipelineRun: Array<{
  id: string
  label: string
  subtitle: string
  tag: string | null
  status: 'pending' | 'running' | 'done' | 'warning' | 'error'
}>

safetyReport: {
  overall: 'pass' | 'warning' | 'fail'
  checks: Array<{ id: string; label: string; detail: string; status: string }>
  schemaValid: boolean
}

gameContent: {
  templateId: string
  items: unknown[]
}
```

## File Trong Thư Mục

- `Game Generator Chat v2.dc.html`: reference cho màn tạo game.
- `Game Preview Approve.dc.html`: reference cho màn preview/review/publish.

Ưu tiên bám tinh thần thiết kế, nhưng khi code cần dùng component, route và state management hiện có của project.

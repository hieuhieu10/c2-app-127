# Handoff: AI Learning Game Generator — Chat & Preview Flow

## Overview
A teacher-facing tool for the GDPT-2018 (Vietnamese K-12) context that turns a prompt + curriculum objective + optional PDF into a playable, schema-valid learning game. The flow has two screens:

1. **Generator Chat** — a focused chat where the teacher specifies subject/class/difficulty + prompt + objective + PDF, then watches the full generation pipeline run inline (parse → RAG → recommend → generate → safety gate → schema → build), ending in a "ready" card.
2. **Preview / Approve / Publish** — a full-screen workspace to edit the generated content, play-test the game, review the safety/fidelity gate, and publish to a class.

The two screens are linked: the chat's "Xem trước & duyệt" button navigates to the preview screen; the preview's "Quay lại chat" navigates back.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes that show the intended look, copy, and behavior. **They are not production code to copy directly.** The task is to **recreate these designs in the target codebase using its existing environment and patterns** (React/Vue/etc., your component library, your routing, your state layer). If no frontend environment exists yet, pick the most appropriate framework for the project and implement there.

Notes specific to this prototype:
- Built as single self-contained HTML files. Ignore the `<x-dc>`, `<helmet>`, `support.js`, and `data-props` wrappers — those are artifacts of the prototyping tool, **not** part of the design.
- All styling is inline. Pull the values from the Design Tokens section below rather than scraping inline styles.
- The pipeline, safety results, and game content are **mock/sample data**. Wire them to your real backend (the pipeline described by the user).
- Icons are simple inline SVGs. Replace with your icon library (Lucide, Heroicons, etc.) — shapes are described per component.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and layout are intended to be reproduced faithfully using your codebase's component library. The language is **Vietnamese** — keep all copy as-is (and ideally route it through your i18n layer).

---

## Design Tokens

### Colors
| Token | Hex | Usage |
|---|---|---|
| `primary` | `#4f46e5` | Brand indigo — buttons, active nav, links, accents |
| `primary-strong` | `#3730a3` | Pressed/active indigo text |
| `primary-tint` | `#eef0fe` | Indigo backgrounds (active nav, avatars, chips) |
| `primary-tint-border` | `#dfe1fc` / `#e0e2fb` | Borders on indigo tints |
| `primary-grad` | `linear-gradient(120deg,#4f46e5,#6d5ef0)` | Game header |
| `ink` | `#1b2333` | Primary text |
| `ink-secondary` | `#5b6577` | Secondary text |
| `ink-muted` | `#8b94a6` / `#9aa2b2` | Muted/caption text |
| `bg-app` | `#f4f5f8` | App canvas background |
| `surface` | `#ffffff` | Cards, sidebars, bars |
| `surface-subtle` | `#fbfcfe` / `#fbfbfd` | Subtle inner panels, game board bg |
| `border` | `#e9ebf1` | Default borders/dividers |
| `border-strong` | `#e3e6ee` | Inputs, buttons, game shell |
| `divider-faint` | `#f1f2f6` / `#f4f5f8` | Row dividers inside cards |
| `success` | `#0d9f6e` | Pass icon/dot |
| `success-text` | `#047a55` | Pass label text |
| `success-tint` | `#e7f7f0` | Pass backgrounds |
| `success-tint-border` | `#c4ecd9` | Pass borders |
| `warning` | `#d98a04` | Warning dot |
| `warning-icon` | `#b06f00` | Warning icon/text |
| `warning-tint` | `#fdf3e0` | Warning/draft backgrounds |
| `warning-tint-border` | `#f5e2bb` / `#f3deb0` | Warning/draft borders |
| `toggle-off` | `#dfe3ee` | Off switch track |
| `star` | `#ffd34d` | Score star (play mode) |

### Typography
- **Font family:** `'Be Vietnam Pro', sans-serif` (Google Fonts, weights 400/500/600/700). Chosen for full Vietnamese diacritic support.
- **Base size:** 15px. Scale used: 11.5px (caption/overline), 12–12.5px (meta), 13–13.5px (secondary/buttons), 14–14.5px (body/labels), 15–16px (titles), 22px (game tiles).
- **Weights:** 400 body, 500 medium (chips/nav), 600 semibold (labels/buttons), 700 bold (titles, game tiles).
- **Letter-spacing:** `-.2px` on titles; `.4–.6px` + `uppercase` on overline labels.

### Spacing & Radius
- **Spacing:** roughly an 8px-ish rhythm — common values 6, 7, 8, 10, 11, 13, 14, 16, 18, 22, 26, 30px.
- **Radius:** chips/pills `7–9px`; buttons `9–12px`; cards `13–16px`; composer/large cards `18px`; icon circles `50%`; status icon squares `9–11px`.
- **Borders:** `1px` standard, `1.5px` tiles, `2px` matched/active.

### Shadows
| Token | Value |
|---|---|
| card | `0 1px 2px rgba(16,24,40,.04), 0 6px 20px rgba(16,24,40,.04)` |
| card-emphasis | `0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.05)` |
| composer | `0 2px 6px rgba(16,24,40,.05), 0 12px 30px rgba(16,24,40,.06)` |
| game-shell | `0 4px 12px rgba(16,24,40,.06), 0 18px 50px rgba(16,24,40,.1)` |
| primary-btn | `0 5px 14px rgba(79,70,229,.28)` (≈`.25–.3` alpha by size) |
| tile | `0 2px 5px rgba(16,24,40,.05)` |

---

## Screens / Views

### Screen 1 — Generator Chat
**File:** `Game Generator Chat v2.dc.html`
**Purpose:** Teacher describes the game they want and watches the AI pipeline build it.

**Layout:** Full-viewport flex row.
- **Sidebar** — `256px` fixed, white, right border `#e9ebf1`, padding `18px 16px`, vertical flex.
- **Main** — flex column: top bar (`60px`, white, bottom border) → scrolling thread (`bg-app`) → composer (sticky bottom, on `bg-app`).
- Thread + composer content are centered in a `max-width:800px` column.

**Components:**

1. **Sidebar logo** — 36px indigo rounded-square (`radius 10px`, primary shadow) with a white play-triangle glyph; wordmark "Học Mà Chơi" (16px/700) + caption "Trình tạo trò chơi · AI" (11.5px muted).
2. **"+ Tạo trò chơi mới" button** — full-width primary, 11px padding, radius 11px, primary-btn shadow, plus icon.
3. **Nav** — 4 items (grid icon "Trò chơi của tôi" [active: primary text on `primary-tint`], book "Thư viện mẫu", users "Lớp học của tôi", bar-chart "Phân tích"). Inactive text `#5b6577`, 14px, 9px radius rows.
4. **Recent list** — overline "Gần đây" (11.5px/600, uppercase, `.6px`); 4 items, first active (`bg #f4f5f8`, ink), rest muted 13.5px.
5. **User row** — top divider; 34px circle avatar "NL" (`#dfe3ee`/`#4a5570`), name "Cô Nguyễn Lan" (13.5px/600) + role "GV Toán · Lớp 4A" (11.5px muted), gear icon.
6. **Top bar** — breadcrumb "Trò chơi của tôi / **Phân số bằng nhau**" + amber "Bản nháp" chip; right: ghost "Lưu nháp" button + 34px help-icon square.
7. **Teacher message** — right-aligned, max-width 80%, **primary background**, white text, radius `16px 16px 5px 16px`, primary shadow. Top: input chips on `rgba(255,255,255,.18)` (Môn: Toán / Lớp 4 / Độ khó: Trung bình / Mục tiêu: Phân số bằng nhau / 📄 phanso.pdf). Body 15px/line-height 1.5.
8. **Assistant block** — 38px indigo-tint rounded-square avatar with a sparkle glyph + content column (gap 14px):
   - Intro line: "Mình đã chạy xong quy trình tạo trò chơi · hoàn tất trong 12 giây" (14px, secondary/muted).
   - **Pipeline card** (white, radius 16px, card shadow, padding `6px 18px`): 4 step rows, each = 30px success-tint circle with check + title (14.5px/600) + subtitle (13px muted) + right-aligned **stage tag pill** (12px). Rows divided by `#f1f2f6`.
     - Step 1 "Phân tích tài liệu" / "Đọc 4 trang PDF · trích 12 đoạn nội dung" / tag **PyMuPDF · OCR** (neutral pill).
     - Step 2 "Tra cứu khung chương trình GDPT 2018" / "3 yêu cầu cần đạt liên quan · Toán lớp 4 — Số & phép tính" / tag **RAG** (neutral).
     - Step 3 "Đề xuất mẫu trò chơi" / "Chọn mẫu **Ghép cặp khái niệm** · độ phù hợp 86%" / tag **Bộ điều phối** (indigo pill — supervisor).
     - Step 4 "Sinh nội dung trò chơi" / "8 cặp ghép · JSON hợp lệ theo schema của mẫu" / tag **Bộ sinh nội dung** (indigo — worker).
   - **Safety gate card** (white, radius 16px, card-emphasis shadow) — the visual focal point:
     - Header (`bg #fbfcfe`, bottom border): 32px shield icon square (indigo-tint) + title "Kiểm định nội dung & an toàn" (15px/700) + subtitle "Bộ kiểm định tự động trước khi xuất bản" + right verdict pill. Verdict has two states: **"Đạt · 1 cảnh báo"** (amber pill w/ dot) or **"Đạt toàn bộ"** (green pill w/ dot).
     - 3 check rows (26px status circle + title 14px/600 + subtitle 12.5px + right status word):
       - "Đáp án được tài liệu xác nhận" / "Kiểm tra suy luận đáp án (entailment) — 8/8 câu khớp nguồn" → **Đạt** (green).
       - "Phương án nhiễu sai một cách rõ ràng" → warning state: amber "!" icon, "Phát hiện 1 phương án có thể gây nhầm — đã tự loại & tạo lại", status **Đã khắc phục** (amber). Pass state: green check, "Tất cả phương án nhiễu đều được xác minh là sai", status **Đạt**.
       - "Phù hợp độ tuổi & chương trình" / "Bộ phân loại: phù hợp lớp 4 · bám sát yêu cầu cần đạt GDPT 2018" → **Đạt** (green).
   - **Post-gate card** (white): "Kiểm tra cấu trúc dữ liệu (schema)" / "Hợp lệ — đúng định dạng của mẫu 'Ghép cặp khái niệm'"; "Dựng trò chơi" / "Đã ghép nội dung vào khung trò chơi có sẵn". Both green check.
   - **Ready card** — `linear-gradient(180deg,#f3f4ff,#eef0fe)`, indigo-tint border, radius 16px. Left: "Trò chơi đã sẵn sàng" (15.5px/700) + "Xem trước, chỉnh sửa từng câu rồi duyệt & xuất bản cho lớp của bạn." Right: primary "Xem trước & duyệt" button with arrow → **navigates to Screen 2**.
9. **Composer** — white card, border `#e3e6ee`, radius 18px, composer shadow, padding `13px 15px`:
   - Chips row: "Môn: Toán" (indigo-tint), "Lớp 4", "Độ khó: Trung bình" (neutral), each with chevron-down. (A "Mục tiêu GDPT" chip was intentionally removed by the designer — do not add it back.)
   - Placeholder line "Mô tả trò chơi bạn muốn tạo, hoặc yêu cầu chỉnh sửa…" — implement as a real textarea/input.
   - Bottom row: attached-file pill "📄 phanso.pdf ✕" (green doc icon), "Đính kèm" button (paperclip), and right-aligned 42px primary send circle (arrow-up).

---

### Screen 2 — Preview / Approve / Publish
**File:** `Game Preview Approve.dc.html`
**Purpose:** Edit generated content, play-test, review the gate, and publish.

**Layout:** Full-viewport flex column.
- **Top bar** — `62px`, white, bottom border, padding `0 22px`.
- **Body** — flex row, 3 regions:
  - **Left aside** — `332px` fixed, white, right border. Header + scrollable list.
  - **Center** — flex, `bg #eef0f4`. A `48px` toolbar + a centered game shell (`max-width 720px`).
  - **Right aside** — `340px` fixed, white, left border. Scroll area + sticky footer.

**Components:**

1. **Top bar** — "Quay lại chat" ghost button (chevron-left) → **navigates to Screen 1**; then a divider, 34px indigo-tint game icon, title "Ghép cặp: Phân số bằng nhau" (16px/600) + meta "Toán · Lớp 4 · 8 cặp ghép" (12px), and a status chip: **"Bản nháp"** (amber) or **"Đã xuất bản"** (green w/ dot). Right: ghost "Chỉnh sửa toàn bộ" (pencil) + primary action that swaps with state: **"Duyệt & Xuất bản"** (indigo, check icon) when draft, **"Sao chép liên kết"** (green, link icon) when published.
2. **Left — content editor.** Header: "Nội dung trò chơi" (15px/700) + "8 cặp" count pill + hint "Bấm vào từng cặp để chỉnh sửa nội dung". Scrollable list of pair rows: 22px numbered square + "2/4 ↔ 1/2" (14px/500, target bold) + pencil icon. **Row 1 is the selected/active state** (indigo-tint bg `#f7f8ff`, border `#e0e2fb`, indigo number + indigo pencil); the rest are neutral white with muted pencil. Sample pairs: 2/4↔1/2, 3/6↔1/2, 4/8↔1/2, 2/6↔1/3, 3/9↔1/3, 5/10↔1/2. Footer: dashed "+ Thêm cặp ghép" button.
3. **Center toolbar.** "Xem trước trò chơi" label + a segmented toggle **"Xem trước / Chơi thử"** (track `#e2e5ec`, active segment white w/ shadow) + right "Máy tính · 16:9" device note.
4. **Center — game shell.** White card, border `#e3e6ee`, radius 18px, game-shell shadow.
   - **Header:** `primary-grad`, white. 34px translucent icon square + "Ghép phân số bằng nhau" (16px/700) + "Nối phân số ở cột trái với phân số tối giản tương ứng" (12px/.85). In **Chơi thử** mode, right side adds score "⭐ 2/8" (yellow star) + timer "⏱ 01:48".
   - **Board:** padding `26–30px`, bg `#fbfbfd`. Two columns separated by an "↔" connector. Each column has an overline header ("Phân số" / "Phân số tối giản") then tiles (radius 13px, 22px/700 numbers, tile shadow). Left tiles: 2/4, 3/9, 5/10, 2/6. Right tiles: 1/2 (or 1/3), 3/4, 1/2, 1/3.
   - **State difference:** In **Chơi thử** mode the first left tile (2/4) and first right tile (1/2) render **matched** — green border `#c4ecd9`, bg `success-tint`, green text, left tile shows a check. In **Xem trước** mode all tiles are neutral white.
5. **Right — verify & publish.**
   - **Safety summary** — title "Kiểm định & an toàn" + amber "Đạt · 1 cảnh báo" pill. A bordered group of 3 condensed check rows (24px status circles): "Đáp án đúng (entailment)" / "8/8 câu khớp tài liệu nguồn" (green); "Phương án nhiễu sai rõ ràng" / "Đã loại & tạo lại 1 phương án gây nhầm" (amber "!"); "Phù hợp độ tuổi & chương trình" / "Lớp 4 · bám sát YCCĐ GDPT 2018" (green). Below, a standalone row "Cấu trúc dữ liệu hợp lệ (schema)" (green check, `bg #fbfcfe`).
   - **Publish settings** (top divider, "Thiết lập xuất bản" 14.5px/700) — 3 toggle rows: "Chia sẻ cho lớp 4A" / "32 học sinh" (**on**), "Cho phép xem điểm" / "Hiển thị kết quả sau khi chơi" (**on**), "Công khai trong thư viện trường" / "Giáo viên khác có thể dùng lại" (**off**). Toggle = 40×23px pill track, 18px white knob; on = primary, off = `#dfe3ee`. Then a link field "🔗 hocmachoi.vn/g/phanso-4a" with a copy icon.
   - **Footer (sticky).** Draft state: full-width primary "Duyệt & Xuất bản" (check icon) + fine print "Bạn là người chịu trách nhiệm cuối cùng về nội dung". Published state: a green confirmation banner "✓ Đã xuất bản cho lớp 4A".

---

## Interactions & Behavior

### Navigation
- Chat "Xem trước & duyệt" → Preview screen.
- Preview "Quay lại chat" → Chat screen.
- Sidebar "Trò chơi của tôi" is the active route; "+ Tạo trò chơi mới" starts a fresh chat.

### Chat / Pipeline
- The 8 pipeline stages should **stream in sequentially as the backend reports progress** — render each step as: pending → in-progress (spinner) → done (green check) / warning (amber) / error (red). The prototype shows the completed end-state only; design the in-progress and error states to match (swap the circle's color/icon, keep the row layout).
- Stage tags (PyMuPDF · OCR, RAG, Bộ điều phối, Bộ sinh nội dung) label which subsystem ran. Neutral pill for tooling, indigo pill for the agent roles (supervisor/worker).
- The safety gate verdict and per-check states are **driven by real gate output**. Support at least: pass (green "Đạt"), auto-fixed (amber "Đã khắc phục"), and fail (red — add a rose `#e11d48`/`#fee2e6` variant and block publish).
- Composer: chips open selectors (subject/class/difficulty/objective), attach button opens a file picker, send submits. Disable send while a pipeline run is in flight.

### Preview / Publish
- "Xem trước / Chơi thử" toggle switches the center board between a static preview and an interactive play state (score + timer + live matching). In a real build, "Chơi thử" should mount the actual game runtime.
- Content rows are click-to-edit (inline or modal); pencil + active-row highlight indicate selection. "+ Thêm cặp ghép" appends an editable empty pair.
- Toggles flip publish settings. "Duyệt & Xuất bản" validates → publishes → transitions the whole screen to the **published** state (status chip green, footer banner, top action becomes "Sao chép liên kết"). Link field copy button writes the URL to clipboard.

### Micro-states
- Buttons: add a subtle hover darken on indigo (`#4338ca`) and a pressed scale; ghost buttons hover to `#f7f8fa`.
- Cards/rows: hover background `#f4f5f8` on clickable list rows.
- Transitions: ~150–200ms ease on color/background; toggle knob slide ~180ms.

## State Management
- `pipelineRun`: ordered list of stages `{ id, label, subtitle, tag, status: 'pending'|'running'|'done'|'warning'|'error' }`.
- `safetyReport`: `{ overall: 'pass'|'warning'|'fail', checks: [{ id, label, detail, status }], schemaValid: bool }`.
- `gameContent`: template id + array of items (here, matching pairs `{ left, right }`); editable.
- `selectedItemId`: which content row is active in the editor.
- `previewMode`: `'preview' | 'play'`.
- `publishState`: `'draft' | 'published'`; `shareSettings`: `{ classShare, showScores, publicLibrary }`; `shareUrl`.
- Data fetching: POST teacher input → stream pipeline events; on completion fetch generated `gameContent` + `safetyReport`; PATCH on edits; POST publish.

## Assets
- **Font:** Be Vietnam Pro (Google Fonts) — load 400/500/600/700.
- **Icons:** inline SVGs in the prototype (plus, grid, book, users, bar-chart, gear, help, doc, paperclip, arrow-up, check, shield, warning, link, copy, clock, star, pencil, chevrons, monitor). Replace with your icon library; shapes are described above.
- **No raster/brand images** are used. No external image assets to migrate.

## Files
- `Game Generator Chat v2.dc.html` — Screen 1 (generator chat). Open in a browser to see the hifi reference. The earlier `Game Generator Chat.dc.html` (sketchy wireframe with 3 layout explorations) is **not** included — v2 is the chosen direction.
- `Game Preview Approve.dc.html` — Screen 2 (preview / approve / publish).
- Tweakable states baked into the prototypes (via the tool's controls, not part of your build): chat = safety result (pass/warning) + show stage tags; preview = published (draft/published) + previewMode (preview/play). These map to the state variables above — implement them as real app state.

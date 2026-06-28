# Weekly Journal — AI20K-040 · AI Science Communication Assistant · Team-127

**WEEK 1**
---

## TL;DR

Tuần này không code, tập trung định hình lại bài toán sau review của mentor. Hai quyết định lớn: (1) pivot **toàn bộ sang Mode Pitcher**, gác Mode Explain; (2) chốt **sinh content bằng tiếng Anh trước**, mở rộng tiếng Việt sau nếu kịp. Đã hoàn thiện bộ tài liệu nền (brief, user stories, PRD song ngữ) và bản thiết kế đầu tiên (UI flow + 7 wireframe trong Figma).

## Quyết định lớn trong tuần

- **Pivot sang Mode Pitcher duy nhất.** Bỏ hướng multi-output cũ (lay summary / policy brief / social), đưa Mode Explain ra khỏi scope chính → roadmap. Lý do: đủ hẹp để chứng minh được trong 6 tuần.
- **Persona = nhóm "adviser".** TTO officer (primary), VC analyst (secondary) — người có hiểu biết lĩnh vực nhưng không chuyên sâu nghiên cứu, đánh giá paper để cấp vốn / thương mại hóa. Đã **bỏ persona admin**.
- **Hướng xử lý:** simplify + visualize + summarize → tái cấu trúc thành proposal theo *problem → solution → evidence → feasibility* + differentiation + impact, bằng ngôn ngữ thường.
- **Knowledge Base** paraphrase ngôn ngữ học thuật → ngôn ngữ thông dụng là tài sản cốt lõi / yếu tố khác biệt so với prompt generic.
- **Metrics:** #1 là độ tương đồng generated–source (NLI entailment > 0.80); làm sớm reader comprehension; phụ trợ readability delta (Flesch-Kincaid) + hallucination rate < 5%.
- **(Mới) Ngôn ngữ content:** sinh **tiếng Anh trước**, expand tiếng Việt nếu có thời gian.

## Deliverables đã hoàn thành

- **1-page Brief** (VN → EN), font sans-serif, full black, professional.
- **User stories:** 7 epic, 17 FR có priority (P0/P1/P2) + acceptance criteria cho các luồng P0.
- **PRD hoàn chỉnh** (VN, 14 mục) → chuyển **EN**, làm rõ pain point trong Problem statement, bỏ toàn bộ phần admin.
- **UI Flow** (FigJam) + **7 wireframe lo-fi** (Figma design): Login, Dashboard, Upload, Processing, Proposal workspace, Export, History.

## Ghi chú kỹ thuật — faithfulness / NLI

- Phân biệt quan trọng: "độ tương đồng" phải dùng **NLI entailment có hướng** (premise = source, hypothesis = claim), không phải cosine similarity (không bắt được over-claim).
- Quy trình: chunk source (SBERT) → tách claim nguyên tử → retrieve top-k đoạn nguồn → NLI từng cặp, lấy max P(entailment) → ngưỡng 0.80; contradiction cao → cờ hallucination → điểm tài liệu = trung bình P(entailment) hoặc tỉ lệ claim được support.
- Premise lấy từ **full text**, không chỉ abstract (tránh flag oan).

## Hệ quả của quyết định ngôn ngữ content

- Content tiếng Anh + paper tiếng Anh ⇒ **NLI trở thành monolingual (Anh–Anh)**, bỏ được rủi ro cross-lingual (mDeBERTa-XNLI / back-translation) đã lo trước đó → faithfulness chính xác hơn và bớt một lớp phức tạp.
- Đổi lại: readability/comprehension test cần làm trên đối tượng đọc tiếng Anh; Flesch-Kincaid vẫn hợp.



**Week 2**: Đổi đề tài -> game học đường

## TL;DR

Hợp nhất nhánh `dang` (slice recommend + generate + các game shell) vào `develop`. Bổ sung **4 game mới** — `cat_jump`, `feed_the_cats`, `beat_forge`, `farm_builder` — nối đầy đủ qua cả 3 tầng (schema backend → mapper BE_Web → registry + React shell FE). Dọn repo và xử lý xung đột khi merge với nhánh RAG của team.

## Việc đã làm

- **4 game mới**, mỗi game wiring đủ 3 tầng: `SPEC` (playable) ở `backend/app/templates/schemas/`, mapper + đăng ký ở `BE_Web/app/services/`, entry + shell ở `FE/src/features/game-shells/`. Làm lại lớn phần Battleship (âm thanh, nhân vật, UI).
- **Dọn repo:** bỏ track `be_web.db` (tự sinh bởi `create_all` khi khởi động) và `tsconfig.tsbuildinfo`; xóa thư mục `assets/` trùng lặp (~6MB, app thực tế phục vụ từ `FE/public`); thêm các mục `.gitignore`.
- **Hợp nhất với develop:** develop đã đổi kiến trúc persist game sang `create_game_from_generation` / `map_content_to_items` dùng `ChatSession`. Gỡ các dict điều phối cũ (`PRODUCT_TEMPLATE_TO_AI_TEMPLATE`…), port 4 game mới sang `map_content_to_items` mới; giữ bản treasure-hunt V2 của develop.

## Ghi chú kỹ thuật

- Bài học: thêm game mới phải nhớ tầng BE_Web (mapper + đăng ký), nếu không sẽ HTTP 400 khi generate. Khi merge, lớp điều phối có thể bị thay kiến trúc — cần **port lại logic** chứ không chọn một phía của xung đột.
- Chạy test sau merge: **backend 84 passed, BE_Web 26 passed**; cả hai app compile sạch.

## Ghi chú kỹ thuật — DeepSeek thinking mode & chuẩn bị deploy

- **Bug "no tool call":** generate thỉnh thoảng fail vì `DEFAULT_MODEL=deepseek-v4-flash` là model *thinking* — nó từ chối forced `tool_choice` và đốt `max_tokens` vào `reasoning_content`, nên request lớn bị `finish_reason='length'` trước khi kịp emit tool call → không có tool_calls, content rỗng → lỗi. Bài học: model thinking **không hợp** để ép structured-JSON tool call nếu không kiểm soát ngân sách token.
- **Cách sửa:** dò trực tiếp API và tìm ra `extra_body={"thinking": {"type": "disabled"}}` — tắt thinking là cho phép forced `tool_choice` + không reasoning đốt token. Giữ được `deepseek-v4-flash` (nhanh/rẻ), không phải hạ về `deepseek-chat`. Verify E2E: 15 câu @ `max_tokens=4096` (đúng budget từng truncate) chạy ổn; full backend **97 passed**.
- **Deploy Docker/VPS:** cách test chắc ăn là chạy đúng compose prod ở local (`docker compose --env-file .env.production up -d --build`), chờ tất cả service `healthy`, rồi smoke test luồng FE→BE_Web→BE_AI→tạo game. Gotcha lớn: `NEXT_PUBLIC_BE_WEB_URL`/`CORS_ORIGINS` là build-time và đang trỏ `localhost` — phải đổi sang domain VPS trước khi deploy thật, và đổi `JWT_SECRET_KEY`.
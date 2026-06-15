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
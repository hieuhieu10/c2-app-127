from __future__ import annotations

from conftest import auth_headers
from app.services.lesson_chunking import rank_source_text_chunks


def test_lesson_upload_requires_authentication(client):
    response = client.post(
        "/api/uploads/lesson-file",
        files={"file": ("giao_an.txt", b"Noi dung giao an", "text/plain")},
    )

    assert response.status_code == 401


def test_lesson_upload_rejects_unsupported_file_type(client):
    headers = auth_headers(client)

    response = client.post(
        "/api/uploads/lesson-file",
        headers=headers,
        files={"file": ("bang_tinh.xlsx", b"not supported", "application/vnd.ms-excel")},
    )

    assert response.status_code == 415


def test_lesson_upload_extracts_txt_and_returns_source_text(client, monkeypatch, tmp_path):
    from app.api import uploads as uploads_api

    monkeypatch.setattr(uploads_api.settings, "upload_dir", str(tmp_path))
    headers = auth_headers(client)

    content = "Tên bài: Phép nhân là phép cộng lặp\nHoạt động 10 phút cuối giờ"
    response = client.post(
        "/api/uploads/lesson-file",
        headers=headers,
        files={"file": ("giao_an_toan_3.txt", content.encode("utf-8"), "text/plain")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["uploadedFileId"]
    assert body["uploadType"] == "lesson_plan"
    assert body["retentionPolicy"] == "session"
    assert body["sessionId"] is None
    assert body["originalFilename"] == "giao_an_toan_3.txt"
    assert "Phép nhân" in body["sourceText"]
    assert body["charCount"] == len(body["sourceText"])
    assert body["chunkCount"] >= 1


def test_rank_source_text_chunks_distinguishes_lesson_and_session_numbers():
    source_text = (
        "Bai 01: On tap cac so den 1000 (T1) - Trang 6\n"
        "Doc, viet, xep thu tu cac so den 1000. Cau tao tram, chuc, don vi.\n\n"
        "Bai 01: On tap cac so den 1000 - Luyen tap (T2) - Trang 7\n"
        "So sanh so, tim so lon nhat, so be nhat.\n\n"
        "Bai 02: Phep cong trong pham vi 1000 (T1) - Trang 8\n"
        "Cong cac so co ba chu so."
    )

    chunks = rank_source_text_chunks(source_text, prompt="tao game ve bai 1 tiet 1")

    assert chunks
    assert "T1" in (chunks[0].draft.title or chunks[0].draft.text)
    assert all("T2" not in (chunk.draft.title or "") for chunk in chunks[:1])

from __future__ import annotations

from conftest import auth_headers


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

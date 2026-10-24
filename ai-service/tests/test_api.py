from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_extract_returns_structured_output():
    res = client.post("/v1/extract", json={"text": "Hackathon by Coding Club on 15 November. Register at https://example.com/r"})
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "rules"
    assert body["announcements"][0]["category"] == "hackathon"


def test_extract_rejects_short_input():
    assert client.post("/v1/extract", json={"text": "hi"}).status_code == 422


def test_assistant_answers_from_records_only():
    res = client.post("/v1/assistant", json={"question": "Which hackathons?", "records": [
        {"title": "AI Hackathon", "category": "hackathon", "registrationDeadline": "2026-11-10T00:00:00+05:30"},
    ]})
    assert "AI Hackathon" in res.json()["answer"]


def test_assistant_says_unknown_without_records():
    res = client.post("/v1/assistant", json={"question": "Any cricket events?", "records": []})
    assert "could not find" in res.json()["answer"]

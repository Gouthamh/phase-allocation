import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from calc import calculate  # noqa: E402
from main import app  # noqa: E402

EXAMPLE = [
    {"current": 139, "cos": 0.8, "connection": "L1"},
    {"current": 130, "cos": 1, "connection": "L2"},
    {"current": 200, "cos": 1, "connection": "L1-L2"},
]


def test_example():
    r = calculate(EXAMPLE)
    p1, p2, p3 = r["phases"]
    assert p1["current"] == pytest.approx(284.9, abs=0.1)
    assert p1["angle"] == pytest.approx(3.3, abs=0.1)
    assert p1["state"] == "leading"
    assert p2["current"] == pytest.approx(319.3, abs=0.1)
    assert p2["angle"] == pytest.approx(-138.2, abs=0.1)
    assert p2["state"] == "lagging"
    assert p1["reactive"] == pytest.approx(16.6, abs=0.1)
    assert p2["reactive"] == pytest.approx(-100.0, abs=0.1)
    assert p3["current"] == 0
    assert r["ib"] == pytest.approx(319.3, abs=0.1)
    assert r["neutral"] == pytest.approx(201.4, abs=0.1)
    n = r["neutral_row"]
    assert n["angle"] == pytest.approx(-76.7, abs=0.1)
    assert n["active"] == pytest.approx(46.2, abs=0.1)
    assert n["reactive"] == pytest.approx(-196.0, abs=0.1)
    assert r["most_loaded"] == "Ph2"
    assert r["unbalance"] == pytest.approx(100.0)
    assert r["arithmetic_sum"] == pytest.approx(469.0)


def test_balanced_three_phase():
    r = calculate([{"current": 100, "cos": 0.9, "connection": "3P"}])
    assert [p["current"] for p in r["phases"]] == pytest.approx([100] * 3)
    assert r["neutral"] == pytest.approx(0, abs=1e-6)
    assert r["ib"] == pytest.approx(100)
    assert r["unbalance"] == pytest.approx(0, abs=1e-6)


def test_api_ok_and_validation():
    c = TestClient(app)
    response = c.post("/api/calculate", json={"loads": EXAMPLE})
    assert response.status_code == 200
    assert response.json() == calculate(EXAMPLE)
    bad = {"loads": [{"current": 10, "cos": 0, "connection": "L1"}]}
    assert c.post("/api/calculate", json=bad).status_code == 422
    bad = {"loads": [{"current": -5, "cos": 1, "connection": "L1"}]}
    assert c.post("/api/calculate", json=bad).status_code == 422


def test_health():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_api_route():
    response = TestClient(app).get("/api/nonexistent")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}

"""latest_findings QA fixes: one rating per person (BUG-20), mandatory Pujari photo (BUG-11),
Seva proof access (BUG-10). Endpoint functions are called directly against a scripted fake DB."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.routers.lifecycle import RatingIn, submit_rating
from app.routers.pujari import PHOTO_REQUIRED_MESSAGE, PujariProfileIn, patch_profile
from app.routers.seva import seva_registration_proof

CUST = "00000000-0000-0000-0000-0000000000c1"
PUJ = "00000000-0000-0000-0000-0000000000a1"
BK = "00000000-0000-0000-0000-0000000000b1"


class _Result:
    def __init__(self, row=None, scalar=None):
        self._row, self._scalar = row, scalar

    def mappings(self):
        return self

    def first(self):
        return self._row

    def all(self):
        return self._row or []

    def scalar(self):
        return self._scalar


class FakeDB:
    """Answers each SQL statement with the first matching (substring, result) rule; records writes."""

    def __init__(self, rules):
        self.rules, self.writes = rules, []

    def execute(self, stmt, params=None):
        sql = str(stmt)
        if sql.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE")):
            self.writes.append(sql)
        for needle, result in self.rules:
            if needle in sql:
                return result
        return _Result()

    def commit(self):
        pass

    def rollback(self):
        pass


def _booking(**extra):
    return {"id": BK, "status": "completed", "customer_id": CUST, "pujari_id": PUJ, "rating_status": "pending", **extra}


def test_second_rating_is_rejected_without_overwriting():
    db = FakeDB([("FROM bookings", _Result(_booking())), ("SELECT skipped FROM ratings", _Result((False,)))])
    with pytest.raises(HTTPException) as e:
        submit_rating(BK, RatingIn(stars=2, skip=False), user={"id": CUST, "role": "customer"}, db=db)
    assert e.value.status_code == 409
    assert db.writes == []


def test_repeat_skip_is_idempotent():
    db = FakeDB([("FROM bookings", _Result(_booking())), ("SELECT skipped FROM ratings", _Result((True,)))])
    out = submit_rating(BK, RatingIn(skip=True), user={"id": PUJ, "role": "pujari"}, db=db)
    assert out["my_rating"] == "skipped"
    assert db.writes == []


def test_rating_after_skip_is_allowed_and_marked_rated():
    db = FakeDB(
        [
            ("FROM bookings", _Result(_booking())),
            ("SELECT skipped FROM ratings", _Result((True,))),
            ("SELECT role_from, skipped FROM ratings", _Result([{"role_from": "customer", "skipped": False}])),
        ]
    )
    out = submit_rating(BK, RatingIn(stars=5, skip=False), user={"id": CUST, "role": "customer"}, db=db)
    assert out == {"ok": True, "rating_status": "customer_done", "my_rating": "rated"}


def test_rating_needs_an_assigned_pujari_and_a_participant():
    db = FakeDB([("FROM bookings", _Result(_booking(pujari_id=None)))])
    with pytest.raises(HTTPException) as e:
        submit_rating(BK, RatingIn(stars=4), user={"id": CUST, "role": "customer"}, db=db)
    assert e.value.status_code == 400
    db = FakeDB([("FROM bookings", _Result(_booking()))])
    with pytest.raises(HTTPException) as e:
        submit_rating(BK, RatingIn(stars=4), user={"id": "someone-else", "role": "customer"}, db=db)
    assert e.value.status_code == 403


def test_personal_profile_save_requires_photo():
    db = FakeDB([("profile_photo_path", _Result(scalar=False))])
    with pytest.raises(HTTPException) as e:
        patch_profile(PujariProfileIn(full_name="Ravi Sharma"), user={"id": PUJ, "role": "pujari"}, db=db)
    assert e.value.status_code == 400 and e.value.detail == PHOTO_REQUIRED_MESSAGE
    assert db.writes == []


def _registration(**extra):
    return {
        "customer_id": CUST,
        "proof_image_path": None,
        "proof_released": False,
        "event_proof_image_path": None,
        "event_proof_released": False,
        **extra,
    }


def test_seva_proof_is_owner_only():
    db = FakeDB([("FROM seva_event_registrations", _Result(_registration(proof_released=True, proof_image_path="x.jpg")))])
    with pytest.raises(HTTPException) as e:
        seva_registration_proof("r1", user={"id": "other-customer", "role": "customer"}, db=db)
    assert e.value.status_code == 403


def test_seva_proof_not_released_gives_clear_404():
    # Unreleased path must not leak even if a file path exists.
    db = FakeDB([("FROM seva_event_registrations", _Result(_registration(proof_image_path="x.jpg")))])
    with pytest.raises(HTTPException) as e:
        seva_registration_proof("r1", user={"id": CUST, "role": "customer"}, db=db)
    assert e.value.status_code == 404 and "not been shared" in e.value.detail


def test_seva_proof_falls_back_to_released_event_proof_url():
    db = FakeDB(
        [
            (
                "FROM seva_event_registrations",
                _Result(_registration(event_proof_released=True, event_proof_image_path="https://cdn.example/p.jpg")),
            )
        ]
    )
    resp = seva_registration_proof("r1", user={"id": CUST, "role": "customer"}, db=db)
    assert resp.status_code == 307 and resp.headers["location"] == "https://cdn.example/p.jpg"

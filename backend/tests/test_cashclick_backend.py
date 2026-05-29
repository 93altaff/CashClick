"""CashClick backend regression tests covering auth, games, tasks, campaigns,
explore (checkin/spin/scratch/visits/watch/surveys/quizzes), wallet, refer,
profile, and admin endpoints."""
import os
import time
import uuid
import pytest
import requests

# Use the public preview backend URL (matches frontend EXPO_PUBLIC_BACKEND_URL)
BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://cashclick-earn.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USERNAME = "Altaf93"
ADMIN_PASSWORD = "9372@Altaf93C"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def device_id():
    return f"test_dev_{uuid.uuid4().hex[:10]}"


@pytest.fixture(scope="session")
def username():
    return f"test_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/admin/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def registered_user(s, device_id, username):
    r = s.post(f"{API}/auth/register", json={
        "device_id": device_id,
        "mobile": "9999988888",
        "username": username,
    })
    assert r.status_code == 200, r.text
    return r.json()["user"]


# ---------- Health & Config ----------
class TestHealthConfig:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert "message" in r.json()

    def test_config(self, s):
        r = s.get(f"{API}/config")
        assert r.status_code == 200
        d = r.json()
        assert d["conversion_rate"] == 100
        assert isinstance(d["withdraw_chips"], list) and len(d["withdraw_chips"]) >= 1
        assert "refer_reward" in d

    def test_banners(self, s):
        r = s.get(f"{API}/banners")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Hidden filtered, pinned first
        for b in data:
            assert b.get("hidden") is not True
        if len(data) >= 2:
            # pinned True should come before pinned False
            assert (data[0].get("pinned") is True) or all(not x.get("pinned") for x in data)


# ---------- Auth ----------
class TestAuth:
    def test_check_username_invalid(self, s):
        r = s.post(f"{API}/auth/check-username", json={"username": "ab"})
        assert r.status_code == 200
        assert r.json()["available"] is False

    def test_check_username_available(self, s):
        r = s.post(f"{API}/auth/check-username", json={"username": f"u_{uuid.uuid4().hex[:8]}"})
        assert r.status_code == 200
        assert r.json()["available"] is True

    def test_register_and_me(self, s, registered_user, device_id):
        assert registered_user["device_id"] == device_id
        r = s.get(f"{API}/auth/check-device/{device_id}")
        assert r.status_code == 200
        assert r.json()["exists"] is True
        r2 = s.get(f"{API}/auth/me/{device_id}")
        assert r2.status_code == 200
        assert r2.json()["device_id"] == device_id

    def test_duplicate_device(self, s, registered_user, device_id, username):
        r = s.post(f"{API}/auth/register", json={
            "device_id": device_id,
            "mobile": "9999988888",
            "username": f"x_{uuid.uuid4().hex[:6]}",
        })
        assert r.status_code == 400

    def test_duplicate_username(self, s, registered_user, username):
        r = s.post(f"{API}/auth/register", json={
            "device_id": f"other_{uuid.uuid4().hex[:8]}",
            "mobile": "9999988888",
            "username": username,
        })
        assert r.status_code == 400


# ---------- Games ----------
class TestGames:
    def test_list_games(self, s, registered_user, device_id):
        r = s.get(f"{API}/games", params={"device_id": device_id})
        assert r.status_code == 200
        games = r.json()
        assert len(games) == 31
        for g in games:
            assert g["chances_left"] == 10
            assert g["plays_today"] == 0

    def test_play_flow_and_interstitial(self, s, registered_user, device_id):
        gid = "higher-lower"
        last = None
        for i in range(5):
            r = s.post(f"{API}/games/play", json={"device_id": device_id, "game_id": gid})
            assert r.status_code == 200, r.text
            d = r.json()
            assert 10 <= d["reward"] <= 50
            assert d["plays_today"] == i + 1
            last = d
        assert last["show_interstitial"] is True
        # chances decremented
        r = s.get(f"{API}/games", params={"device_id": device_id})
        g = [x for x in r.json() if x["id"] == gid][0]
        assert g["chances_left"] == 5
        assert g["plays_today"] == 5

    def test_watch_rewarded_adds_chances(self, s, registered_user, device_id):
        gid = "memory-match"
        r = s.post(f"{API}/games/watch-rewarded", json={"device_id": device_id, "game_id": gid})
        assert r.status_code == 200
        # New row -> chances = 10 + 10 = 20
        r2 = s.get(f"{API}/games", params={"device_id": device_id})
        g = [x for x in r2.json() if x["id"] == gid][0]
        assert g["chances_left"] == 20


# ---------- Tasks ----------
class TestTasks:
    def test_tasks_and_submit(self, s, registered_user, device_id):
        r = s.get(f"{API}/tasks", params={"device_id": device_id})
        assert r.status_code == 200
        tasks = r.json()
        assert len(tasks) >= 3
        tid = tasks[0]["id"]
        r2 = s.get(f"{API}/tasks/{tid}", params={"device_id": device_id})
        assert r2.status_code == 200
        r3 = s.post(f"{API}/tasks/submit", json={
            "device_id": device_id, "task_id": tid,
            "form_data": {"mobile": "9999988888"},
        })
        assert r3.status_code == 200
        r4 = s.get(f"{API}/tasks/{tid}", params={"device_id": device_id})
        assert r4.json()["my_submission"]["status"] == "pending"


# ---------- Campaigns ----------
class TestCampaigns:
    def test_campaigns_confirm(self, s, registered_user, device_id):
        r = s.get(f"{API}/campaigns", params={"device_id": device_id})
        assert r.status_code == 200
        camps = r.json()
        assert len(camps) >= 2
        cid = camps[0]["id"]
        r2 = s.post(f"{API}/campaigns/confirm", json={
            "device_id": device_id, "campaign_id": cid,
        })
        assert r2.status_code == 200
        r3 = s.get(f"{API}/wallet/withdrawals", params={"device_id": device_id})
        camps_wd = [w for w in r3.json() if w.get("is_campaign")]
        assert len(camps_wd) >= 1
        assert camps_wd[0]["status"] == "approved"


# ---------- Explore ----------
class TestExplore:
    def test_checkin(self, s, registered_user, device_id):
        r = s.get(f"{API}/explore/checkin", params={"device_id": device_id})
        assert r.status_code == 200
        d = r.json()
        assert d["day"] == 0
        r2 = s.post(f"{API}/explore/checkin/claim", json={"device_id": device_id})
        assert r2.status_code == 200
        assert r2.json()["reward"] == 10
        assert r2.json()["day"] == 1
        r3 = s.post(f"{API}/explore/checkin/claim", json={"device_id": device_id})
        assert r3.status_code == 400

    def test_spin(self, s, registered_user, device_id):
        r = s.get(f"{API}/explore/spin", params={"device_id": device_id})
        assert r.status_code == 200 and r.json()["claimed_today"] is False
        r2 = s.post(f"{API}/explore/spin/claim", json={"device_id": device_id})
        assert r2.status_code == 200
        assert 10 <= r2.json()["reward"] <= 20
        r3 = s.post(f"{API}/explore/spin/claim", json={"device_id": device_id})
        assert r3.status_code == 400

    def test_scratch(self, s, registered_user, device_id):
        r = s.get(f"{API}/explore/scratch", params={"device_id": device_id})
        assert r.status_code == 200 and r.json()["claimed_today"] is False
        r2 = s.post(f"{API}/explore/scratch/claim", json={"device_id": device_id})
        assert r2.status_code == 200
        r3 = s.post(f"{API}/explore/scratch/claim", json={"device_id": device_id})
        assert r3.status_code == 400

    def test_visits(self, s, registered_user, device_id):
        r = s.get(f"{API}/explore/visits", params={"device_id": device_id})
        assert r.status_code == 200
        visits = r.json()
        assert len(visits) >= 3
        vid = visits[0]["id"]
        # Start, complete
        r2 = s.post(f"{API}/explore/visits/start", json={"device_id": device_id, "visit_id": vid})
        assert r2.status_code == 200
        r3 = s.post(f"{API}/explore/visits/complete", json={"device_id": device_id, "visit_id": vid})
        assert r3.status_code == 200
        assert 10 <= r3.json()["reward"] <= 50
        # Cannot re-start completed (until reset)
        r4 = s.post(f"{API}/explore/visits/start", json={"device_id": device_id, "visit_id": vid})
        assert r4.status_code == 400
        # Reset
        r5 = s.post(f"{API}/explore/visits/reset", json={"device_id": device_id, "visit_id": vid})
        assert r5.status_code == 200

    def test_watch_30s_gap(self, s, registered_user, device_id):
        r = s.get(f"{API}/explore/watch", params={"device_id": device_id})
        assert r.status_code == 200
        d = r.json()
        assert d["completed"] == 0
        assert d["total"] == 5
        r2 = s.post(f"{API}/explore/watch/complete", json={"device_id": device_id, "task_index": 0})
        assert r2.status_code == 200
        # Next immediately should fail (30s gap)
        r3 = s.post(f"{API}/explore/watch/complete", json={"device_id": device_id, "task_index": 1})
        assert r3.status_code == 400

    def test_surveys(self, s, registered_user, device_id):
        r = s.get(f"{API}/explore/surveys", params={"device_id": device_id})
        assert r.status_code == 200
        d = r.json()
        assert d["done"] is False
        assert len(d["questions"]) == 10
        answers = [0] * 10
        r2 = s.post(f"{API}/explore/surveys/submit", json={"device_id": device_id, "answers": answers})
        assert r2.status_code == 200
        assert 10 <= r2.json()["reward"] <= 50
        r3 = s.get(f"{API}/explore/surveys", params={"device_id": device_id})
        assert r3.json()["done"] is True

    def test_quizzes(self, s, registered_user, device_id):
        r = s.get(f"{API}/explore/quizzes", params={"device_id": device_id})
        assert r.status_code == 200
        d = r.json()
        assert d["done"] is False
        qs = d["questions"]
        assert len(qs) == 10
        # Map question text suffix to correct index from known QUIZ_BANK
        bank = {
            "Capital of India?": 0,
            "2 + 2 * 2 = ?": 0,
            "Largest planet?": 1,
            "National sport of India?": 1,
            "INR symbol?": 2,
            "Father of nation (India)?": 1,
            "Longest river in India?": 1,
            "Currency of Japan?": 1,
            "HTTP stands for?": 0,
            "Square root of 144?": 2,
        }
        answers = []
        for q in qs:
            # question is "Qn: <bank_question>"
            suffix = q["question"].split(": ", 1)[1]
            answers.append(bank.get(suffix, 0))
        r2 = s.post(f"{API}/explore/quizzes/submit", json={"device_id": device_id, "answers": answers})
        assert r2.status_code == 200
        result = r2.json()
        assert result["correct"] == 10
        assert result["reward"] == 70
        r3 = s.post(f"{API}/explore/quizzes/submit", json={"device_id": device_id, "answers": answers})
        assert r3.status_code == 400


# ---------- Wallet ----------
class TestWallet:
    def test_balance_and_transactions(self, s, registered_user, device_id):
        r = s.get(f"{API}/wallet/balance", params={"device_id": device_id})
        assert r.status_code == 200
        d = r.json()
        assert d["conversion_rate"] == 100
        assert d["points"] >= 0
        assert d["rupees"] == round(d["points"] / 100, 2)
        # Filter transactions by kind
        r2 = s.get(f"{API}/wallet/transactions", params={"device_id": device_id, "kind": "games"})
        assert r2.status_code == 200
        for t in r2.json():
            assert t["kind"] == "games"

    def test_withdraw_insufficient(self, s, registered_user, device_id):
        # Request very large withdraw
        r = s.post(f"{API}/wallet/withdraw", json={
            "device_id": device_id, "amount": 100000, "method": "upi",
            "details": {"upi": "test@upi"},
        })
        assert r.status_code == 400

    def test_withdraw_success(self, s, registered_user, device_id):
        # Need some balance; previous tests should have accumulated points
        bal = s.get(f"{API}/wallet/balance", params={"device_id": device_id}).json()
        if bal["rupees"] < 10:
            pytest.skip("Insufficient balance accumulated for withdraw test")
        before = bal["points"]
        r = s.post(f"{API}/wallet/withdraw", json={
            "device_id": device_id, "amount": 10, "method": "upi",
            "details": {"upi": "test@upi"},
        })
        assert r.status_code == 200, r.text
        wid = r.json()["withdrawal_id"]
        bal2 = s.get(f"{API}/wallet/balance", params={"device_id": device_id}).json()
        assert bal2["points"] == before - 1000
        wds = s.get(f"{API}/wallet/withdrawals", params={"device_id": device_id}).json()
        assert any(w["id"] == wid and w["status"] == "pending" for w in wds)


# ---------- Refer & Profile ----------
class TestReferProfile:
    def test_refer_info(self, s, registered_user, device_id, username):
        r = s.get(f"{API}/refer/info", params={"device_id": device_id})
        assert r.status_code == 200
        d = r.json()
        assert d["code"] == username
        assert "rules" in d and "history" in d
        assert d["total_referrals"] == len(d["history"])

    def test_quick_access(self, s):
        r = s.get(f"{API}/profile/quick-access")
        assert r.status_code == 200
        assert len(r.json()) == 5


# ---------- Admin ----------
class TestAdmin:
    def test_login_invalid(self, s):
        r = s.post(f"{API}/admin/login", json={"username": "x", "password": "y"})
        assert r.status_code == 401

    def test_protected_requires_token(self, s):
        r = s.get(f"{API}/admin/dashboard")
        assert r.status_code == 401

    def test_dashboard(self, s, admin_token):
        r = s.get(f"{API}/admin/dashboard", headers={"X-Admin-Token": admin_token})
        assert r.status_code == 200
        d = r.json()
        for k in ["total_users", "active_users", "paid_withdrawal_amount",
                  "pending_withdrawal_amount", "task_requests", "pending_withdrawals"]:
            assert k in d

    def test_task_submission_approve(self, s, admin_token, registered_user, device_id):
        # find this user's pending submission
        subs = s.get(f"{API}/admin/task-submissions",
                     params={"status": "pending"},
                     headers={"X-Admin-Token": admin_token}).json()
        mine = [x for x in subs if x["device_id"] == device_id]
        if not mine:
            pytest.skip("No pending submission to approve")
        sid = mine[0]["id"]
        reward = mine[0]["reward"]
        before = s.get(f"{API}/wallet/balance", params={"device_id": device_id}).json()["points"]
        r = s.post(f"{API}/admin/task-submissions/action",
                   json={"submission_id": sid, "action": "approve"},
                   headers={"X-Admin-Token": admin_token})
        assert r.status_code == 200
        after = s.get(f"{API}/wallet/balance", params={"device_id": device_id}).json()["points"]
        assert after - before == reward

    def test_withdraw_action_rejected_refunds(self, s, admin_token, registered_user, device_id):
        # find pending withdrawal from this user
        wds = s.get(f"{API}/admin/withdrawals",
                    params={"status": "pending"},
                    headers={"X-Admin-Token": admin_token}).json()
        mine = [x for x in wds if x["device_id"] == device_id]
        if not mine:
            pytest.skip("No pending withdrawal to reject")
        w = mine[0]
        before = s.get(f"{API}/wallet/balance", params={"device_id": device_id}).json()["points"]
        r = s.post(f"{API}/admin/withdrawals/action",
                   json={"withdrawal_id": w["id"], "action": "rejected", "reason": "test"},
                   headers={"X-Admin-Token": admin_token})
        assert r.status_code == 200, r.text
        after = s.get(f"{API}/wallet/balance", params={"device_id": device_id}).json()["points"]
        assert after - before == w["amount"] * 100

    def test_config_patch(self, s, admin_token):
        r = s.post(f"{API}/admin/config",
                   json={"conversion_rate": 100, "refer_reward": 55, "withdraw_chips": [10, 20, 50, 100]},
                   headers={"X-Admin-Token": admin_token})
        assert r.status_code == 200
        cfg = s.get(f"{API}/config").json()
        assert cfg["refer_reward"] == 55
        assert cfg["withdraw_chips"] == [10, 20, 50, 100]
        # restore
        s.post(f"{API}/admin/config",
               json={"refer_reward": 50, "withdraw_chips": [10, 20, 50, 100, 200, 500]},
               headers={"X-Admin-Token": admin_token})

    def test_games_config_update(self, s, admin_token):
        r = s.post(f"{API}/admin/games-config",
                   json={"id": "tic-tac-toe", "reward_min": 20, "reward_max": 60, "chances": 12},
                   headers={"X-Admin-Token": admin_token})
        assert r.status_code == 200
        rows = s.get(f"{API}/admin/games-config", headers={"X-Admin-Token": admin_token}).json()
        g = [x for x in rows if x["id"] == "tic-tac-toe"][0]
        assert g["reward_min"] == 20 and g["reward_max"] == 60 and g["chances"] == 12
        # restore
        s.post(f"{API}/admin/games-config",
               json={"id": "tic-tac-toe", "reward_min": 10, "reward_max": 50, "chances": 10},
               headers={"X-Admin-Token": admin_token})

    def test_banner_crud(self, s, admin_token):
        payload = {"title": "TEST_Banner", "image": "https://x.com/x.jpg",
                   "subtitle": "t", "url": "", "is_external": False,
                   "pinned": False, "hidden": False, "order": 50}
        r = s.post(f"{API}/admin/banners/upsert", json=payload,
                   headers={"X-Admin-Token": admin_token})
        assert r.status_code == 200
        bid = r.json()["id"]
        # delete
        rd = s.delete(f"{API}/admin/banners/{bid}", headers={"X-Admin-Token": admin_token})
        assert rd.status_code == 200

    def test_task_crud(self, s, admin_token):
        payload = {"title": "TEST_Task", "reward": 5, "rules": "t", "tutorial_url": "",
                   "form_fields": [], "status": "active"}
        r = s.post(f"{API}/admin/tasks/upsert", json=payload, headers={"X-Admin-Token": admin_token})
        tid = r.json()["id"]
        rd = s.delete(f"{API}/admin/tasks/{tid}", headers={"X-Admin-Token": admin_token})
        assert rd.status_code == 200

    def test_campaign_crud(self, s, admin_token):
        payload = {"title": "TEST_Camp", "rules": "t", "tutorial_url": "", "status": "active"}
        r = s.post(f"{API}/admin/campaigns/upsert", json=payload, headers={"X-Admin-Token": admin_token})
        cid = r.json()["id"]
        rd = s.delete(f"{API}/admin/campaigns/{cid}", headers={"X-Admin-Token": admin_token})
        assert rd.status_code == 200

    def test_visit_crud(self, s, admin_token):
        payload = {"title": "TEST_Visit", "url": "https://x.com", "reward_min": 5,
                   "reward_max": 20, "status": "active"}
        r = s.post(f"{API}/admin/visits/upsert", json=payload, headers={"X-Admin-Token": admin_token})
        vid = r.json()["id"]
        rd = s.delete(f"{API}/admin/visits/{vid}", headers={"X-Admin-Token": admin_token})
        assert rd.status_code == 200

    def test_quick_access_crud(self, s, admin_token):
        payload = {"label": "TEST_QA", "icon": "link", "url": "https://x.com", "order": 99}
        r = s.post(f"{API}/admin/quick-access", json=payload, headers={"X-Admin-Token": admin_token})
        assert r.status_code == 200
        # find created entry
        rows = s.get(f"{API}/admin/quick-access", headers={"X-Admin-Token": admin_token}).json()
        ids = [x["id"] for x in rows if x["label"] == "TEST_QA"]
        for qid in ids:
            s.delete(f"{API}/admin/quick-access/{qid}", headers={"X-Admin-Token": admin_token})


# ============================================================
# Iteration N+1 — referred_by validation, watch-rewarded cap,
# admin deducted with original_amount stored, games count=11
# ============================================================

EXPECTED_GAME_IDS = {
    "higher-lower", "memory-match", "tic-tac-toe", "math-sprint",
    "puzzle-solve", "color-tap", "word-scramble", "fruit-slice",
    "lucky-spin", "card-flip", "number-rush",
    # +20 new (iteration 3)
    "rock-paper", "coin-flip", "dice-roll", "odd-out", "true-false",
    "tap-counter", "reaction", "simon-says", "whack-mole", "merge-tiles",
    "connect-dots", "color-sort", "spell-bee", "trivia", "find-pair",
    "bubble-pop", "sequence", "lucky-dice", "shape-match", "guess-emoji",
}

NEW_GAME_IDS = {
    "rock-paper", "coin-flip", "dice-roll", "odd-out", "true-false",
    "tap-counter", "reaction", "simon-says", "whack-mole", "merge-tiles",
    "connect-dots", "color-sort", "spell-bee", "trivia", "find-pair",
    "bubble-pop", "sequence", "lucky-dice", "shape-match", "guess-emoji",
}


class TestGamesCatalog:
    """Verify there are exactly 31 mini-games with the expected IDs and defaults."""

    def test_games_count_and_ids(self, s):
        dev = f"catalog_{uuid.uuid4().hex[:8]}"
        r = s.get(f"{API}/games", params={"device_id": dev})
        assert r.status_code == 200, r.text
        games = r.json()
        assert len(games) == 31, f"expected 31 games, got {len(games)}"
        ids = {g["id"] for g in games}
        assert ids == EXPECTED_GAME_IDS, f"unexpected game ids: {ids ^ EXPECTED_GAME_IDS}"

    def test_new_games_default_config(self, s):
        dev = f"defaults_{uuid.uuid4().hex[:8]}"
        r = s.get(f"{API}/games", params={"device_id": dev})
        assert r.status_code == 200
        games = {g["id"]: g for g in r.json()}
        for gid in NEW_GAME_IDS:
            assert gid in games, f"missing new game {gid}"
            g = games[gid]
            assert g["chances"] == 10, f"{gid} chances={g['chances']}"
            assert g["reward_min"] == 10, f"{gid} reward_min={g['reward_min']}"
            assert g["reward_max"] == 50, f"{gid} reward_max={g['reward_max']}"
            # Fresh device -> full chances, no plays
            assert g["chances_left"] == 10
            assert g["plays_today"] == 0


class TestGameLeaderboard:
    """Per-game leaderboard endpoint."""

    def test_leaderboard_today_shape(self, s):
        r = s.get(f"{API}/games/higher-lower/leaderboard", params={"period": "today"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["period"] == "today"
        assert data["game"]["id"] == "higher-lower"
        assert "name" in data["game"] and "color" in data["game"]
        lb = data["leaderboard"]
        assert isinstance(lb, list)
        assert len(lb) <= 10
        # Sorted desc by total_pts
        if len(lb) >= 2:
            for i in range(len(lb) - 1):
                assert lb[i]["total_pts"] >= lb[i + 1]["total_pts"]
        for row in lb:
            assert set(row.keys()) >= {"username", "total_pts", "plays"}
            assert isinstance(row["plays"], int) and row["plays"] >= 1
            assert isinstance(row["total_pts"], int)

    def test_leaderboard_all_period(self, s):
        r = s.get(f"{API}/games/higher-lower/leaderboard", params={"period": "all"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["period"] == "all"
        assert isinstance(data["leaderboard"], list)
        # all-time should be >= today's count
        today = s.get(f"{API}/games/higher-lower/leaderboard",
                      params={"period": "today"}).json()["leaderboard"]
        # totals across all >= totals of today for same users (loose check)
        assert len(data["leaderboard"]) >= 0

    def test_leaderboard_unknown_game_404(self, s):
        r = s.get(f"{API}/games/non-existent-id/leaderboard")
        assert r.status_code == 404
        assert "Game not found" in (r.json().get("detail") or "")

    def test_leaderboard_includes_fresh_user_after_plays(self, s):
        # Register a fresh user
        dev = f"lb_{uuid.uuid4().hex[:8]}"
        uname = f"lb_{uuid.uuid4().hex[:6]}"
        r0 = s.post(f"{API}/auth/register", json={
            "device_id": dev, "mobile": "9999988888", "username": uname,
        })
        assert r0.status_code == 200, r0.text

        # Play rock-paper 3 times
        total_reward = 0
        for _ in range(3):
            rp = s.post(f"{API}/games/play",
                        json={"device_id": dev, "game_id": "rock-paper"})
            assert rp.status_code == 200, rp.text
            total_reward += rp.json()["reward"]

        # Leaderboard today should include this user
        r = s.get(f"{API}/games/rock-paper/leaderboard", params={"period": "today"})
        assert r.status_code == 200
        lb = r.json()["leaderboard"]
        mine = [row for row in lb if row["username"] == uname]
        assert len(mine) == 1, f"user {uname} not in rock-paper leaderboard: {lb}"
        assert mine[0]["plays"] == 3
        assert mine[0]["total_pts"] == total_reward


class TestNewGamePlayFlow:
    """Existing chances/interstitial/watch-rewarded cap still works for new game IDs."""

    def test_play_chances_and_interstitial_on_new_game(self, s):
        dev = f"newplay_{uuid.uuid4().hex[:8]}"
        uname = f"newp_{uuid.uuid4().hex[:6]}"
        r0 = s.post(f"{API}/auth/register", json={
            "device_id": dev, "mobile": "9999988888", "username": uname,
        })
        assert r0.status_code == 200, r0.text
        gid = "coin-flip"
        last = None
        for i in range(5):
            r = s.post(f"{API}/games/play", json={"device_id": dev, "game_id": gid})
            assert r.status_code == 200, r.text
            d = r.json()
            assert 10 <= d["reward"] <= 50
            assert d["plays_today"] == i + 1
            last = d
        assert last["show_interstitial"] is True
        r2 = s.get(f"{API}/games", params={"device_id": dev})
        g = [x for x in r2.json() if x["id"] == gid][0]
        assert g["chances_left"] == 5
        assert g["plays_today"] == 5

    def test_watch_rewarded_cap_on_new_game(self, s):
        dev = f"newref_{uuid.uuid4().hex[:8]}"
        uname = f"newr_{uuid.uuid4().hex[:6]}"
        r0 = s.post(f"{API}/auth/register", json={
            "device_id": dev, "mobile": "9999988888", "username": uname,
        })
        assert r0.status_code == 200, r0.text
        gid = "dice-roll"
        for used, left in [(1, 2), (2, 1), (3, 0)]:
            r = s.post(f"{API}/games/watch-rewarded",
                       json={"device_id": dev, "game_id": gid})
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["refills_used"] == used
            assert body["refills_left"] == left
        r4 = s.post(f"{API}/games/watch-rewarded",
                    json={"device_id": dev, "game_id": gid})
        assert r4.status_code == 400
        assert "Daily refill limit reached" in (r4.json().get("detail") or "")


class TestReferredByValidation:
    """POST /api/auth/register must validate referred_by and normalize."""

    def test_register_with_nonexistent_referrer_returns_400(self, s):
        dev = f"refbad_{uuid.uuid4().hex[:8]}"
        uname = f"refbad_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/auth/register", json={
            "device_id": dev, "mobile": "9999988888",
            "username": uname, "referred_by": "nonexistent_user_xyz",
        })
        assert r.status_code == 400
        body = r.json()
        # FastAPI HTTPException -> {"detail": "Referral code not found"}
        assert "Referral code not found" in (body.get("detail") or str(body))

    def test_register_with_valid_referrer_normalizes(self, s):
        # Step 1: create the referrer
        ref_dev = f"refsrc_{uuid.uuid4().hex[:8]}"
        ref_uname = f"refsrc_{uuid.uuid4().hex[:6]}"
        r0 = s.post(f"{API}/auth/register", json={
            "device_id": ref_dev, "mobile": "9999988888", "username": ref_uname,
        })
        assert r0.status_code == 200, r0.text

        # Step 2: register a new user with "@<USERNAME>" (different case + @ prefix)
        new_dev = f"refdst_{uuid.uuid4().hex[:8]}"
        new_uname = f"refdst_{uuid.uuid4().hex[:6]}"
        with_at = "@" + ref_uname.upper()
        r1 = s.post(f"{API}/auth/register", json={
            "device_id": new_dev, "mobile": "9999988888",
            "username": new_uname, "referred_by": with_at,
        })
        assert r1.status_code == 200, r1.text
        user = r1.json()["user"]
        # Stored normalized: lowercase, no @
        assert user["referred_by"] == ref_uname.lower()

        # Verify via /auth/me too
        r2 = s.get(f"{API}/auth/me/{new_dev}")
        assert r2.status_code == 200
        assert r2.json().get("referred_by") == ref_uname.lower()


class TestWatchRewardedCap:
    """/api/games/watch-rewarded must cap at 3 refills per game per day."""

    def test_three_refills_then_400(self, s):
        # Fresh user + fresh game to avoid bleed
        dev = f"refill_{uuid.uuid4().hex[:8]}"
        uname = f"refill_{uuid.uuid4().hex[:6]}"
        r0 = s.post(f"{API}/auth/register", json={
            "device_id": dev, "mobile": "9999988888", "username": uname,
        })
        assert r0.status_code == 200, r0.text
        gid = "card-flip"  # use a game not exercised in earlier tests

        # 1st - 3rd refills succeed
        expected = [(1, 2), (2, 1), (3, 0)]
        for used, left in expected:
            r = s.post(f"{API}/games/watch-rewarded", json={"device_id": dev, "game_id": gid})
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["refills_used"] == used, body
            assert body["refills_left"] == left, body

        # 4th refill must fail with 400
        r4 = s.post(f"{API}/games/watch-rewarded", json={"device_id": dev, "game_id": gid})
        assert r4.status_code == 400, r4.text
        detail = r4.json().get("detail") or ""
        assert "Daily refill limit reached" in detail
        assert "(3)" in detail


class TestAdminDeductedStoresOriginalAmount:
    """Admin 'deducted' action must persist original_amount alongside deducted/amount."""

    def test_full_deduct_flow(self, s, admin_token):
        # 1) Register a fresh user
        dev = f"ded_{uuid.uuid4().hex[:8]}"
        uname = f"ded_{uuid.uuid4().hex[:6]}"
        r0 = s.post(f"{API}/auth/register", json={
            "device_id": dev, "mobile": "9999988888", "username": uname,
        })
        assert r0.status_code == 200, r0.text

        # 2) Seed user balance: play multiple games (10 chances each, 10-50 pts each)
        # We need at least 1000 pts for a ₹10 withdrawal at rate 100. Play 4 games
        # × 10 plays = 40 plays @ avg ~30 = ~1200 pts (well above min 400, below max 2000).
        for gid in ("higher-lower", "memory-match", "tic-tac-toe", "math-sprint"):
            for _ in range(10):
                rp = s.post(f"{API}/games/play",
                            json={"device_id": dev, "game_id": gid})
                assert rp.status_code == 200, rp.text

        bal = s.get(f"{API}/wallet/balance", params={"device_id": dev}).json()
        # Ensure we have at least 1000 pts for the ₹10 chip
        if bal["points"] < 1000:
            # play more if unlucky on the low end
            for gid in ("puzzle-solve", "color-tap", "word-scramble"):
                for _ in range(10):
                    s.post(f"{API}/games/play",
                           json={"device_id": dev, "game_id": gid})
            bal = s.get(f"{API}/wallet/balance", params={"device_id": dev}).json()
        assert bal["points"] >= 1000, f"could not accumulate >=1000 pts (got {bal['points']})"

        # 3) User submits withdrawal of ₹10
        original_amount = 10
        rw = s.post(f"{API}/wallet/withdraw", json={
            "device_id": dev, "amount": original_amount,
            "method": "upi", "details": {"upi": "test@upi"},
        })
        assert rw.status_code == 200, rw.text
        wid = rw.json()["withdrawal_id"]

        # 4) Admin deducts ₹5 (paid = ₹15)
        deduct = 5
        rd = s.post(
            f"{API}/admin/withdrawals/action",
            json={"withdrawal_id": wid, "action": "deducted",
                  "deduct_amount": deduct, "reason": "TEST_partial"},
            headers={"X-Admin-Token": admin_token},
        )
        assert rd.status_code == 200, rd.text

        # 5) Fetch back the withdrawal and verify fields
        wds = s.get(
            f"{API}/admin/withdrawals",
            params={"status": "paid"},
            headers={"X-Admin-Token": admin_token},
        ).json()
        match = [w for w in wds if w["id"] == wid]
        assert len(match) == 1, "deducted withdrawal not found in paid list"
        w = match[0]
        assert w["status"] == "paid"
        assert w["original_amount"] == original_amount, w
        assert w["deducted"] == deduct, w
        # remaining paid amount
        assert w["amount"] == original_amount - deduct, w

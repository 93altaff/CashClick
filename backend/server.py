"""CashClick backend - task earning app."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import uuid
import secrets
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="CashClick API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============================================================
# Helpers
# ============================================================
IST = timezone(timedelta(hours=5, minutes=30))

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def today_ist() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")

def gen_id() -> str:
    return str(uuid.uuid4())

def clean(d: dict) -> dict:
    if not d:
        return d
    d.pop("_id", None)
    return d

# ============================================================
# Models
# ============================================================
class RegisterIn(BaseModel):
    device_id: str
    mobile: str
    username: str
    referred_by: Optional[str] = None

class UsernameCheck(BaseModel):
    username: str

class GamePlayIn(BaseModel):
    device_id: str
    game_id: str

class WatchRewardedIn(BaseModel):
    device_id: str
    game_id: str

class WithdrawIn(BaseModel):
    device_id: str
    amount: int  # in rupees
    method: str  # upi | bank
    details: Dict[str, Any]

class TaskSubmitIn(BaseModel):
    device_id: str
    task_id: str
    form_data: Dict[str, Any]

class CampaignConfirmIn(BaseModel):
    device_id: str
    campaign_id: str

class ExploreClaimIn(BaseModel):
    device_id: str
    multiplier: float = 1.0  # use rewarded ad multiplier

class VisitStartIn(BaseModel):
    device_id: str
    visit_id: str

class VisitCompleteIn(BaseModel):
    device_id: str
    visit_id: str
    multiplier: float = 1.0

class WatchCompleteIn(BaseModel):
    device_id: str
    task_index: int  # 0..4
    multiplier: float = 1.0

class SurveyAnswersIn(BaseModel):
    device_id: str
    answers: List[int]  # selected option index per survey
    multiplier: float = 1.0

class QuizAnswersIn(BaseModel):
    device_id: str
    answers: List[int]
    multiplier: float = 1.0

class AdminLoginIn(BaseModel):
    username: str
    password: str

# ============================================================
# Auth helpers
# ============================================================
ADMIN_USERNAME = "Altaf93"
ADMIN_PASSWORD = "9372@Altaf93C"

async def get_user(device_id: str) -> dict:
    u = await db.users.find_one({"device_id": device_id}, {"_id": 0})
    if not u:
        raise HTTPException(404, "User not found. Please login again.")
    return u

async def require_admin(x_admin_token: Optional[str] = Header(None)) -> bool:
    if not x_admin_token:
        raise HTTPException(401, "Admin auth required")
    sess = await db.admin_sessions.find_one({"token": x_admin_token})
    if not sess:
        raise HTTPException(401, "Invalid admin token")
    return True

async def add_transaction(device_id: str, amount_pts: int, kind: str, tag: str, note: str = ""):
    """kind: games | task | campaigns | refer | explore | withdraw"""
    tx = {
        "id": gen_id(),
        "device_id": device_id,
        "amount_pts": amount_pts,
        "kind": kind,
        "tag": tag,
        "note": note,
        "created_at": now_utc().isoformat(),
    }
    await db.transactions.insert_one(tx)
    if amount_pts != 0:
        await db.users.update_one(
            {"device_id": device_id},
            {"$inc": {"points": amount_pts, "total_earned": max(amount_pts, 0)}},
        )
    return tx

# ============================================================
# Config / Seeding
# ============================================================
DEFAULT_CONFIG = {
    "key": "app",
    "conversion_rate": 100,  # 100 points = 1 INR
    "refer_reward": 50,  # points per successful referral
    "refer_qualify_points": 100,  # user must earn this to qualify
    "refer_qualify_modes": ["points", "withdraw", "checkin"],  # which conditions count
    "refer_checkin_rewards": {"1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7},  # rupees by day
    "withdraw_chips": [10, 20, 50, 100, 200, 500],
    "min_withdraw": 10,
    "ad_config": {
        "test_mode": True,
        "banner": {"android": "", "ios": ""},
        "interstitial": {"android": "", "ios": ""},
        "rewarded": {"android": "", "ios": ""},
        "native": {"android": "", "ios": ""},
    },
    "app_version": "1.0.0",
    "force_update": False,
}

DEFAULT_GAMES = [
    # original 11
    {"id": "higher-lower", "name": "Higher Lower", "icon": "trending-up", "color": "#10B981", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "memory-match", "name": "Memory Match", "icon": "grid", "color": "#3B82F6", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "tic-tac-toe", "name": "Tic Tac Toe", "icon": "hash", "color": "#F59E0B", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "math-sprint", "name": "Math Sprint", "icon": "zap", "color": "#EF4444", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "puzzle-solve", "name": "Puzzle Solve", "icon": "puzzle", "color": "#8B5CF6", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "color-tap", "name": "Color Tap", "icon": "circle", "color": "#EC4899", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "word-scramble", "name": "Word Scramble", "icon": "type", "color": "#06B6D4", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "fruit-slice", "name": "Fruit Slice", "icon": "scissors", "color": "#84CC16", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "lucky-spin", "name": "Lucky Spin", "icon": "refresh-cw", "color": "#F97316", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "card-flip", "name": "Card Flip", "icon": "credit-card", "color": "#14B8A6", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "number-rush", "name": "Number Rush", "icon": "hash", "color": "#6366F1", "chances": 10, "reward_min": 10, "reward_max": 50},
    # +20 new
    {"id": "rock-paper", "name": "Rock Paper Scissors", "icon": "hand", "color": "#F43F5E", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "coin-flip", "name": "Coin Flip", "icon": "disc", "color": "#FACC15", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "dice-roll", "name": "Dice Duel", "icon": "box", "color": "#A855F7", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "odd-out", "name": "Odd One Out", "icon": "alert-triangle", "color": "#0EA5E9", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "true-false", "name": "True or False", "icon": "check-square", "color": "#22C55E", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "tap-counter", "name": "Tap Storm", "icon": "target", "color": "#FB923C", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "reaction", "name": "Reaction Test", "icon": "activity", "color": "#16A34A", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "simon-says", "name": "Simon Says", "icon": "play", "color": "#7C3AED", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "whack-mole", "name": "Whack-a-Mole", "icon": "crosshair", "color": "#65A30D", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "merge-tiles", "name": "Merge 2048", "icon": "layers", "color": "#DB2777", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "connect-dots", "name": "Connect Dots", "icon": "share-2", "color": "#0891B2", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "color-sort", "name": "Color Sort", "icon": "filter", "color": "#9333EA", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "spell-bee", "name": "Spell It", "icon": "edit-3", "color": "#0D9488", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "trivia", "name": "Trivia Pop", "icon": "book", "color": "#CA8A04", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "find-pair", "name": "Find the Pair", "icon": "copy", "color": "#E11D48", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "bubble-pop", "name": "Bubble Pop", "icon": "wind", "color": "#2563EB", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "sequence", "name": "Sequence Recall", "icon": "list", "color": "#C026D3", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "lucky-dice", "name": "Lucky Dice", "icon": "gift", "color": "#059669", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "shape-match", "name": "Shape Match", "icon": "square", "color": "#D97706", "chances": 10, "reward_min": 10, "reward_max": 50},
    {"id": "guess-emoji", "name": "Guess the Emoji", "icon": "smile", "color": "#DC2626", "chances": 10, "reward_min": 10, "reward_max": 50},
]

DEFAULT_BANNERS = [
    {"id": gen_id(), "title": "Refer & Earn ₹50", "subtitle": "Invite friends and earn rewards", "image": "https://images.pexels.com/photos/20843727/pexels-photo-20843727.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "url": "/refer", "is_external": False, "pinned": True, "hidden": False, "order": 1},
    {"id": gen_id(), "title": "Daily Check-in Bonus", "subtitle": "Up to 100 points every day", "image": "https://images.unsplash.com/photo-1624365168898-1f7189831f41?w=940", "url": "/explore/checkin", "is_external": False, "pinned": False, "hidden": False, "order": 2},
]

DEFAULT_QUICK_ACCESS = [
    {"id": gen_id(), "label": "Telegram", "icon": "send", "url": "https://t.me/cashclick", "order": 1},
    {"id": gen_id(), "label": "WhatsApp", "icon": "message-circle", "url": "https://wa.me/919999999999", "order": 2},
    {"id": gen_id(), "label": "Help & Support", "icon": "help-circle", "url": "mailto:support@cashclick.app", "order": 3},
    {"id": gen_id(), "label": "Terms", "icon": "file-text", "url": "https://cashclick.app/terms", "order": 4},
    {"id": gen_id(), "label": "Privacy", "icon": "shield", "url": "https://cashclick.app/privacy", "order": 5},
]

# Sample tasks/campaigns/visits/watch/surveys/quizzes
SAMPLE_TASKS = [
    {"id": gen_id(), "title": "Install ShopApp & Open", "reward": 25, "rules": "Install app from Play Store, open and stay 1 minute. Submit your registered mobile.", "tutorial_url": "", "form_fields": [{"key": "mobile", "label": "Registered Mobile", "type": "text"}], "status": "active", "created_at": now_utc().isoformat()},
    {"id": gen_id(), "title": "Sign up on FinanceX", "reward": 40, "rules": "Sign up using your email. Verify and submit screenshot.", "tutorial_url": "", "form_fields": [{"key": "email", "label": "Email used", "type": "text"}], "status": "active", "created_at": now_utc().isoformat()},
    {"id": gen_id(), "title": "Watch demo video", "reward": 15, "rules": "Watch the full video and answer the keyword shown at the end.", "tutorial_url": "", "form_fields": [{"key": "keyword", "label": "Keyword", "type": "text"}], "status": "active", "created_at": now_utc().isoformat()},
]
SAMPLE_CAMPAIGNS = [
    {"id": gen_id(), "title": "Premium Loan Offer", "reward": 0, "rules": "Apply for loan. If you receive disbursement, confirm payment received.", "tutorial_url": "", "status": "active", "created_at": now_utc().isoformat()},
    {"id": gen_id(), "title": "Cashback on Bill Pay", "reward": 0, "rules": "Pay any bill via partner. If you receive cashback, confirm here.", "tutorial_url": "", "status": "active", "created_at": now_utc().isoformat()},
]
SAMPLE_VISITS = [
    {"id": gen_id(), "title": "Visit NewsHub", "url": "https://example.com", "reward_min": 10, "reward_max": 30, "status": "active", "created_at": now_utc().isoformat()},
    {"id": gen_id(), "title": "Visit SportZone", "url": "https://example.com", "reward_min": 15, "reward_max": 40, "status": "active", "created_at": now_utc().isoformat()},
    {"id": gen_id(), "title": "Visit DealMart", "url": "https://example.com", "reward_min": 20, "reward_max": 50, "status": "active", "created_at": now_utc().isoformat()},
]

# 100 surveys (compact)
SURVEY_TOPICS = [
    "favorite color", "preferred cuisine", "online shopping frequency", "social media usage",
    "fitness routine", "favorite sport", "preferred OTT platform", "travel preference",
    "mobile brand preference", "music genre", "movie genre", "reading habit",
    "morning routine", "evening drink", "shopping app", "payment app",
    "vehicle preference", "pet preference", "weather preference", "season preference",
]
def build_surveys(n=100):
    out = []
    opts_pool = [
        ["Yes", "No", "Maybe", "Not sure"],
        ["Daily", "Weekly", "Monthly", "Rarely"],
        ["Excellent", "Good", "Average", "Poor"],
        ["Always", "Often", "Sometimes", "Never"],
    ]
    for i in range(n):
        topic = SURVEY_TOPICS[i % len(SURVEY_TOPICS)]
        out.append({
            "id": gen_id(),
            "question": f"Q{i+1}: What is your view on {topic}?",
            "options": opts_pool[i % len(opts_pool)],
        })
    return out

QUIZ_BANK = [
    ("Capital of India?", ["Delhi", "Mumbai", "Kolkata", "Chennai"], 0),
    ("2 + 2 * 2 = ?", ["6", "8", "4", "10"], 0),
    ("Largest planet?", ["Earth", "Jupiter", "Mars", "Saturn"], 1),
    ("National sport of India?", ["Cricket", "Hockey", "Kabaddi", "Football"], 1),
    ("INR symbol?", ["$", "€", "₹", "£"], 2),
    ("Father of nation (India)?", ["Nehru", "Gandhi", "Patel", "Bose"], 1),
    ("Longest river in India?", ["Yamuna", "Ganga", "Godavari", "Krishna"], 1),
    ("Currency of Japan?", ["Yuan", "Yen", "Won", "Ringgit"], 1),
    ("HTTP stands for?", ["HyperText Transfer Protocol", "High Tech Tunnel Protocol", "Hyper Text Transmission Protocol", "Home Text Transfer Protocol"], 0),
    ("Square root of 144?", ["10", "11", "12", "14"], 2),
]
def build_quizzes(n=100):
    out = []
    for i in range(n):
        q, opts, correct = QUIZ_BANK[i % len(QUIZ_BANK)]
        out.append({"id": gen_id(), "question": f"Q{i+1}: {q}", "options": opts, "correct": correct})
    return out

async def ensure_seed():
    cfg = await db.config.find_one({"key": "app"})
    if not cfg:
        await db.config.insert_one(DEFAULT_CONFIG.copy())
        logger.info("Seeded default config")

    if await db.games_config.count_documents({}) == 0:
        await db.games_config.insert_many([g.copy() for g in DEFAULT_GAMES])
        logger.info("Seeded games config")
    else:
        # Upsert any games newly added in DEFAULT_GAMES without overwriting admin tweaks.
        existing_ids = {d["id"] async for d in db.games_config.find({}, {"id": 1, "_id": 0})}
        new_games = [g.copy() for g in DEFAULT_GAMES if g["id"] not in existing_ids]
        if new_games:
            await db.games_config.insert_many(new_games)
            logger.info("Added %d new games", len(new_games))

    if await db.banners.count_documents({}) == 0:
        valid = [b for b in DEFAULT_BANNERS if b.get("title")]
        if valid:
            await db.banners.insert_many(valid)
            logger.info("Seeded banners")

    if await db.quick_access.count_documents({}) == 0:
        await db.quick_access.insert_many([q.copy() for q in DEFAULT_QUICK_ACCESS])

    if await db.tasks.count_documents({}) == 0:
        await db.tasks.insert_many([t.copy() for t in SAMPLE_TASKS])
        logger.info("Seeded tasks")

    if await db.campaigns.count_documents({}) == 0:
        await db.campaigns.insert_many([c.copy() for c in SAMPLE_CAMPAIGNS])

    if await db.visits.count_documents({}) == 0:
        await db.visits.insert_many([v.copy() for v in SAMPLE_VISITS])

    if await db.surveys_pool.count_documents({}) == 0:
        await db.surveys_pool.insert_many(build_surveys(100))
        logger.info("Seeded surveys")

    if await db.quizzes_pool.count_documents({}) == 0:
        await db.quizzes_pool.insert_many(build_quizzes(100))
        logger.info("Seeded quizzes")

@app.on_event("startup")
async def on_startup():
    await ensure_seed()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ============================================================
# Public config
# ============================================================
@api_router.get("/")
async def root():
    return {"message": "CashClick API"}

@api_router.get("/config")
async def get_config():
    cfg = await db.config.find_one({"key": "app"}, {"_id": 0})
    return cfg or DEFAULT_CONFIG

@api_router.get("/banners")
async def list_banners():
    rows = await db.banners.find({"hidden": {"$ne": True}}, {"_id": 0}).sort([("pinned", -1), ("order", 1)]).to_list(100)
    return rows

# ============================================================
# Auth
# ============================================================
@api_router.get("/auth/check-device/{device_id}")
async def check_device(device_id: str):
    u = await db.users.find_one({"device_id": device_id}, {"_id": 0})
    return {"exists": u is not None, "user": u}

@api_router.post("/auth/check-username")
async def check_username(data: UsernameCheck):
    uname = data.username.strip().lower()
    if not uname or len(uname) < 3 or len(uname) > 20 or not uname.replace("_", "").isalnum():
        return {"available": False, "reason": "Invalid username"}
    exists = await db.users.find_one({"username": uname})
    return {"available": exists is None}

@api_router.post("/auth/register")
async def register(data: RegisterIn):
    device_id = data.device_id.strip()
    mobile = data.mobile.strip()
    uname = data.username.strip().lower()
    if not device_id or not mobile or not uname:
        raise HTTPException(400, "All fields required")
    if not mobile.isdigit() or len(mobile) < 10:
        raise HTTPException(400, "Invalid mobile")
    if await db.users.find_one({"device_id": device_id}):
        raise HTTPException(400, "Device already registered")
    if await db.users.find_one({"username": uname}):
        raise HTTPException(400, "Username taken")

    referred_by = None
    if data.referred_by:
        ref_clean = data.referred_by.lstrip("@").strip().lower()
        if ref_clean:
            referrer = await db.users.find_one({"username": ref_clean})
            if not referrer:
                raise HTTPException(400, "Referral code not found")
            referred_by = ref_clean

    user = {
        "id": gen_id(),
        "device_id": device_id,
        "mobile": mobile,
        "username": uname,
        "points": 0,
        "total_earned": 0,
        "total_withdrawn": 0,
        "referred_by": referred_by,
        "referral_qualified": False,
        "created_at": now_utc().isoformat(),
        "last_active": now_utc().isoformat(),
    }
    await db.users.insert_one(user.copy())
    user.pop("_id", None)
    return {"ok": True, "user": user}

@api_router.get("/auth/me/{device_id}")
async def me(device_id: str):
    u = await get_user(device_id)
    await db.users.update_one({"device_id": device_id}, {"$set": {"last_active": now_utc().isoformat()}})
    return u

# ============================================================
# Home: games
# ============================================================
@api_router.get("/games")
async def list_games(device_id: str):
    games = await db.games_config.find({}, {"_id": 0}).to_list(100)
    today = today_ist()
    # fetch chances state per game for the user
    state_rows = await db.game_state.find({"device_id": device_id, "date": today}, {"_id": 0}).to_list(100)
    state_map = {s["game_id"]: s for s in state_rows}
    out = []
    for g in games:
        st = state_map.get(g["id"])
        chances_left = st["chances_left"] if st else g["chances"]
        plays_today = st["plays_today"] if st else 0
        out.append({**g, "chances_left": chances_left, "plays_today": plays_today})
    return out

@api_router.get("/games/{game_id}/leaderboard")
async def games_leaderboard(game_id: str, period: str = "today"):
    """Top players for a game by total points earned. period=today|all"""
    g = await db.games_config.find_one({"id": game_id}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Game not found")
    match: Dict[str, Any] = {"kind": "games", "tag": g["name"]}
    if period == "today":
        today_start_ist = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0)
        match["created_at"] = {"$gte": today_start_ist.astimezone(timezone.utc).isoformat()}
    pipeline = [
        {"$match": match},
        {"$group": {"_id": "$device_id", "total": {"$sum": "$amount_pts"}, "plays": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 10},
    ]
    rows = await db.transactions.aggregate(pipeline).to_list(20)
    out = []
    for r in rows:
        u = await db.users.find_one({"device_id": r["_id"]}, {"_id": 0, "username": 1})
        out.append({"username": (u or {}).get("username", "anon"), "total_pts": int(r["total"]), "plays": r["plays"]})
    return {"game": {"id": g["id"], "name": g["name"], "color": g["color"]}, "period": period, "leaderboard": out}

@api_router.post("/games/watch-rewarded")
async def games_watch_rewarded(data: WatchRewardedIn):
    """Add chances after watching a rewarded ad (max 3 refills per game per day)."""
    g = await db.games_config.find_one({"id": data.game_id}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Game not found")
    today = today_ist()
    st = await db.game_state.find_one({"device_id": data.device_id, "game_id": data.game_id, "date": today})
    refills = (st or {}).get("ad_refills", 0)
    MAX_REFILLS = 3
    if refills >= MAX_REFILLS:
        raise HTTPException(400, f"Daily refill limit reached ({MAX_REFILLS}). Come back tomorrow.")
    extra = g["chances"]
    if st:
        await db.game_state.update_one(
            {"device_id": data.device_id, "game_id": data.game_id, "date": today},
            {"$inc": {"chances_left": extra, "ad_refills": 1}},
        )
    else:
        await db.game_state.insert_one({
            "device_id": data.device_id, "game_id": data.game_id, "date": today,
            "chances_left": g["chances"] + extra, "plays_today": 0, "ad_refills": 1,
        })
    return {"ok": True, "added": extra, "refills_used": refills + 1, "refills_left": MAX_REFILLS - refills - 1}

@api_router.post("/games/play")
async def games_play(data: GamePlayIn):
    g = await db.games_config.find_one({"id": data.game_id}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Game not found")
    today = today_ist()
    st = await db.game_state.find_one({"device_id": data.device_id, "game_id": data.game_id, "date": today})
    if not st:
        st = {"device_id": data.device_id, "game_id": data.game_id, "date": today,
              "chances_left": g["chances"], "plays_today": 0}
        await db.game_state.insert_one(st.copy())
    if st["chances_left"] <= 0:
        raise HTTPException(400, "No chances left. Watch a rewarded ad to get more.")
    reward = random.randint(g["reward_min"], g["reward_max"])
    new_plays = st["plays_today"] + 1
    show_interstitial = (new_plays % 5 == 0)
    await db.game_state.update_one(
        {"device_id": data.device_id, "game_id": data.game_id, "date": today},
        {"$inc": {"chances_left": -1, "plays_today": 1}},
    )
    await add_transaction(data.device_id, reward, "games", g["name"], f"Reward from {g['name']}")
    user = await get_user(data.device_id)
    return {
        "ok": True, "reward": reward, "chances_left": st["chances_left"] - 1,
        "plays_today": new_plays, "show_interstitial": show_interstitial,
        "points": user["points"],
    }

# ============================================================
# Tasks
# ============================================================
@api_router.get("/tasks")
async def list_tasks(device_id: str):
    tasks = await db.tasks.find({"status": "active"}, {"_id": 0}).sort([("created_at", -1)]).to_list(200)
    submissions = await db.task_submissions.find({"device_id": device_id}, {"_id": 0}).to_list(500)
    sub_map = {s["task_id"]: s for s in submissions}
    out = []
    for t in tasks:
        s = sub_map.get(t["id"])
        t["my_status"] = s["status"] if s else None  # pending | approved | rejected | None
        out.append(t)
    # short latest first then approved then rejected based on user's submissions
    def key(t):
        ms = t.get("my_status")
        return (0 if ms is None else (1 if ms == "approved" else 2), t["created_at"])
    out.sort(key=key, reverse=True)
    return out

@api_router.get("/tasks/{task_id}")
async def get_task(task_id: str, device_id: str):
    t = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Task not found")
    sub = await db.task_submissions.find_one({"device_id": device_id, "task_id": task_id}, {"_id": 0})
    return {**t, "my_submission": sub}

@api_router.post("/tasks/submit")
async def submit_task(data: TaskSubmitIn):
    t = await db.tasks.find_one({"id": data.task_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Task not found")
    exists = await db.task_submissions.find_one({"device_id": data.device_id, "task_id": data.task_id})
    if exists and exists.get("status") in ("pending", "approved"):
        raise HTTPException(400, "Already submitted")
    sub = {
        "id": gen_id(), "device_id": data.device_id, "task_id": data.task_id,
        "form_data": data.form_data, "status": "pending", "reward": t["reward"],
        "task_title": t["title"], "created_at": now_utc().isoformat(),
    }
    if exists:
        await db.task_submissions.update_one(
            {"device_id": data.device_id, "task_id": data.task_id},
            {"$set": {**sub}}
        )
    else:
        await db.task_submissions.insert_one(sub.copy())
    return {"ok": True}

# ============================================================
# Campaigns
# ============================================================
@api_router.get("/campaigns")
async def list_campaigns(device_id: str):
    rows = await db.campaigns.find({"status": "active"}, {"_id": 0}).sort([("created_at", -1)]).to_list(200)
    return rows

@api_router.get("/campaigns/{cid}")
async def get_campaign(cid: str):
    c = await db.campaigns.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Not found")
    return c

@api_router.post("/campaigns/confirm")
async def campaign_confirm(data: CampaignConfirmIn):
    """User confirms they received payment from campaign — creates a withdrawal-style entry tagged Campaign."""
    c = await db.campaigns.find_one({"id": data.campaign_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Campaign not found")
    wd = {
        "id": gen_id(), "device_id": data.device_id, "amount": 0,
        "method": "campaign", "details": {"campaign": c["title"]},
        "status": "approved", "is_campaign": True, "campaign_id": c["id"],
        "created_at": now_utc().isoformat(), "processed_at": now_utc().isoformat(),
    }
    await db.withdrawals.insert_one(wd.copy())
    await add_transaction(data.device_id, 0, "campaigns", c["title"], "Campaign payment confirmed")
    return {"ok": True}

# ============================================================
# Explore: Check-in
# ============================================================
@api_router.get("/explore/checkin")
async def checkin_status(device_id: str):
    s = await db.checkins.find_one({"device_id": device_id}, {"_id": 0})
    today = today_ist()
    if not s:
        return {"day": 0, "claimed_today": False, "next_reward": 10}
    last = s.get("last_date")
    streak = s.get("streak", 0)
    claimed_today = (last == today)
    yesterday = (datetime.now(IST) - timedelta(days=1)).strftime("%Y-%m-%d")
    if last and last != today and last != yesterday:
        # streak broken
        streak = 0
    next_day = streak + 1 if not claimed_today else streak
    base = min(10 + (next_day - 1) * 10, 100) if next_day > 0 else 10
    return {"day": streak, "claimed_today": claimed_today, "next_reward": base, "next_day": next_day}

@api_router.post("/explore/checkin/claim")
async def checkin_claim(data: ExploreClaimIn):
    today = today_ist()
    s = await db.checkins.find_one({"device_id": data.device_id})
    yesterday = (datetime.now(IST) - timedelta(days=1)).strftime("%Y-%m-%d")
    streak = 0
    if s:
        if s.get("last_date") == today:
            raise HTTPException(400, "Already claimed today")
        if s.get("last_date") == yesterday:
            streak = s.get("streak", 0)
        else:
            streak = 0
    next_day = streak + 1
    if next_day > 30:
        next_day = 1
    base = min(10 + (next_day - 1) * 10, 100)
    reward = int(base * data.multiplier)
    if s:
        await db.checkins.update_one(
            {"device_id": data.device_id},
            {"$set": {"last_date": today, "streak": next_day}},
        )
    else:
        await db.checkins.insert_one({"device_id": data.device_id, "last_date": today, "streak": next_day})
    await add_transaction(data.device_id, reward, "explore", "Daily Check-in", f"Day {next_day}")
    # refer qualify check via checkin streak
    await maybe_qualify_referral(data.device_id, streak_day=next_day)
    return {"ok": True, "reward": reward, "day": next_day}

# ============================================================
# Explore: Spin
# ============================================================
@api_router.get("/explore/spin")
async def spin_status(device_id: str):
    today = today_ist()
    s = await db.spin_state.find_one({"device_id": device_id, "date": today}, {"_id": 0})
    return {"claimed_today": bool(s)}

@api_router.post("/explore/spin/claim")
async def spin_claim(data: ExploreClaimIn):
    today = today_ist()
    exists = await db.spin_state.find_one({"device_id": data.device_id, "date": today})
    if exists:
        raise HTTPException(400, "Already spun today")
    base = random.randint(10, 20)
    reward = int(base * data.multiplier)
    await db.spin_state.insert_one({"device_id": data.device_id, "date": today, "reward": reward})
    await add_transaction(data.device_id, reward, "explore", "Spin", "Spin reward")
    return {"ok": True, "reward": reward, "base": base}

# ============================================================
# Explore: Scratch
# ============================================================
@api_router.get("/explore/scratch")
async def scratch_status(device_id: str):
    today = today_ist()
    s = await db.scratch_state.find_one({"device_id": device_id, "date": today}, {"_id": 0})
    return {"claimed_today": bool(s)}

@api_router.post("/explore/scratch/claim")
async def scratch_claim(data: ExploreClaimIn):
    today = today_ist()
    exists = await db.scratch_state.find_one({"device_id": data.device_id, "date": today})
    if exists:
        raise HTTPException(400, "Already scratched today")
    base = random.randint(10, 20)
    reward = int(base * data.multiplier)
    await db.scratch_state.insert_one({"device_id": data.device_id, "date": today, "reward": reward})
    await add_transaction(data.device_id, reward, "explore", "Scratch", "Scratch reward")
    return {"ok": True, "reward": reward, "base": base}

# ============================================================
# Explore: Visit
# ============================================================
@api_router.get("/explore/visits")
async def list_visits(device_id: str):
    today = today_ist()
    rows = await db.visits.find({"status": "active"}, {"_id": 0}).sort([("created_at", -1)]).to_list(200)
    done = await db.visit_state.find({"device_id": device_id, "date": today}, {"_id": 0}).to_list(500)
    done_ids = {d["visit_id"] for d in done if d.get("status") == "completed"}
    started = {d["visit_id"]: d for d in done}
    out = []
    for v in rows:
        st = started.get(v["id"])
        v["completed_today"] = v["id"] in done_ids
        v["state"] = st["status"] if st else None
        out.append(v)
    return out

@api_router.post("/explore/visits/start")
async def visit_start(data: VisitStartIn):
    today = today_ist()
    existing = await db.visit_state.find_one({"device_id": data.device_id, "visit_id": data.visit_id, "date": today})
    if existing and existing.get("status") == "completed":
        raise HTTPException(400, "Already completed today")
    rec = {"device_id": data.device_id, "visit_id": data.visit_id, "date": today,
           "status": "started", "started_at": now_utc().isoformat()}
    if existing:
        await db.visit_state.update_one(
            {"device_id": data.device_id, "visit_id": data.visit_id, "date": today},
            {"$set": rec},
        )
    else:
        await db.visit_state.insert_one(rec)
    return {"ok": True}

@api_router.post("/explore/visits/complete")
async def visit_complete(data: VisitCompleteIn):
    v = await db.visits.find_one({"id": data.visit_id}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Visit not found")
    today = today_ist()
    st = await db.visit_state.find_one({"device_id": data.device_id, "visit_id": data.visit_id, "date": today})
    if not st or st.get("status") != "started":
        raise HTTPException(400, "Visit not started")
    base = random.randint(v["reward_min"], v["reward_max"])
    reward = int(base * data.multiplier)
    await db.visit_state.update_one(
        {"device_id": data.device_id, "visit_id": data.visit_id, "date": today},
        {"$set": {"status": "completed", "reward": reward}},
    )
    await add_transaction(data.device_id, reward, "explore", f"Visit: {v['title']}", "Visit reward")
    return {"ok": True, "reward": reward, "base": base}

@api_router.post("/explore/visits/reset")
async def visit_reset(data: VisitStartIn):
    today = today_ist()
    await db.visit_state.delete_one({"device_id": data.device_id, "visit_id": data.visit_id, "date": today})
    return {"ok": True}

# ============================================================
# Explore: Watch
# ============================================================
@api_router.get("/explore/watch")
async def watch_status(device_id: str):
    today = today_ist()
    s = await db.watch_state.find_one({"device_id": device_id, "date": today}, {"_id": 0})
    completed = s["completed"] if s else 0
    last_at = s.get("last_at") if s else None
    return {"completed": completed, "total": 5, "last_at": last_at}

@api_router.post("/explore/watch/complete")
async def watch_complete(data: WatchCompleteIn):
    today = today_ist()
    s = await db.watch_state.find_one({"device_id": data.device_id, "date": today})
    completed = s["completed"] if s else 0
    if completed >= 5:
        raise HTTPException(400, "All watch tasks done today")
    if data.task_index != completed:
        raise HTTPException(400, "Invalid task index")
    last_at_str = s.get("last_at") if s else None
    if last_at_str:
        last_at = datetime.fromisoformat(last_at_str)
        if (now_utc() - last_at).total_seconds() < 30:
            raise HTTPException(400, "Please wait 30 seconds between watch tasks")
    base = random.randint(10, 50)
    reward = int(base * data.multiplier)
    if s:
        await db.watch_state.update_one(
            {"device_id": data.device_id, "date": today},
            {"$inc": {"completed": 1}, "$set": {"last_at": now_utc().isoformat()}},
        )
    else:
        await db.watch_state.insert_one({"device_id": data.device_id, "date": today, "completed": 1, "last_at": now_utc().isoformat()})
    await add_transaction(data.device_id, reward, "explore", "Watch", f"Watch task {data.task_index+1}")
    return {"ok": True, "reward": reward, "completed": completed + 1}

# ============================================================
# Explore: Surveys
# ============================================================
@api_router.get("/explore/surveys")
async def get_surveys(device_id: str):
    today = today_ist()
    s = await db.survey_state.find_one({"device_id": device_id, "date": today}, {"_id": 0})
    if s and s.get("done"):
        return {"done": True, "questions": [], "reward": s.get("reward", 0)}
    if s:
        ids = s["question_ids"]
    else:
        pool = await db.surveys_pool.find({}, {"_id": 0}).to_list(200)
        random.shuffle(pool)
        picks = pool[:10]
        ids = [q["id"] for q in picks]
        await db.survey_state.insert_one({"device_id": device_id, "date": today, "question_ids": ids, "done": False})
    qs = await db.surveys_pool.find({"id": {"$in": ids}}, {"_id": 0}).to_list(20)
    # preserve order
    by_id = {q["id"]: q for q in qs}
    ordered = [by_id[i] for i in ids if i in by_id]
    return {"done": False, "questions": ordered}

@api_router.post("/explore/surveys/submit")
async def submit_surveys(data: SurveyAnswersIn):
    today = today_ist()
    s = await db.survey_state.find_one({"device_id": data.device_id, "date": today})
    if not s or s.get("done"):
        raise HTTPException(400, "Already submitted or no surveys")
    base = random.randint(10, 50)
    reward = int(base * data.multiplier)
    await db.survey_state.update_one(
        {"device_id": data.device_id, "date": today},
        {"$set": {"done": True, "reward": reward}},
    )
    await add_transaction(data.device_id, reward, "explore", "Surveys", "Surveys completed")
    return {"ok": True, "reward": reward, "base": base}

# ============================================================
# Explore: Quizzes
# ============================================================
@api_router.get("/explore/quizzes")
async def get_quizzes(device_id: str):
    today = today_ist()
    s = await db.quiz_state.find_one({"device_id": device_id, "date": today}, {"_id": 0})
    if s and s.get("done"):
        return {"done": True, "questions": [], "reward": s.get("reward", 0)}
    if s:
        ids = s["question_ids"]
    else:
        pool = await db.quizzes_pool.find({}, {"_id": 0}).to_list(200)
        random.shuffle(pool)
        picks = pool[:10]
        ids = [q["id"] for q in picks]
        await db.quiz_state.insert_one({"device_id": device_id, "date": today, "question_ids": ids, "done": False})
    qs = await db.quizzes_pool.find({"id": {"$in": ids}}, {"_id": 0}).to_list(20)
    by_id = {q["id"]: q for q in qs}
    ordered = [by_id[i] for i in ids if i in by_id]
    # do not return correct answers
    safe = [{"id": q["id"], "question": q["question"], "options": q["options"]} for q in ordered]
    return {"done": False, "questions": safe}

@api_router.post("/explore/quizzes/submit")
async def submit_quizzes(data: QuizAnswersIn):
    today = today_ist()
    s = await db.quiz_state.find_one({"device_id": data.device_id, "date": today})
    if not s or s.get("done"):
        raise HTTPException(400, "Already submitted or no quizzes")
    ids = s["question_ids"]
    qs = await db.quizzes_pool.find({"id": {"$in": ids}}, {"_id": 0}).to_list(20)
    by_id = {q["id"]: q for q in qs}
    correct_count = 0
    for i, qid in enumerate(ids):
        q = by_id.get(qid)
        if q and i < len(data.answers) and data.answers[i] == q["correct"]:
            correct_count += 1
    base = correct_count * 7
    reward = int(base * data.multiplier)
    await db.quiz_state.update_one(
        {"device_id": data.device_id, "date": today},
        {"$set": {"done": True, "reward": reward, "correct": correct_count}},
    )
    if reward > 0:
        await add_transaction(data.device_id, reward, "explore", "Quizzes", f"{correct_count}/{len(ids)} correct")
    return {"ok": True, "reward": reward, "base": base, "correct": correct_count, "total": len(ids)}

# ============================================================
# Refer
# ============================================================
async def maybe_qualify_referral(device_id: str, streak_day: int = 0):
    user = await db.users.find_one({"device_id": device_id}, {"_id": 0})
    if not user or user.get("referral_qualified"):
        return
    if not user.get("referred_by"):
        return
    cfg = await db.config.find_one({"key": "app"}, {"_id": 0}) or DEFAULT_CONFIG
    modes = cfg.get("refer_qualify_modes", [])
    qualified = False
    if "points" in modes and user.get("total_earned", 0) >= cfg.get("refer_qualify_points", 100):
        qualified = True
    if not qualified and "withdraw" in modes:
        wd = await db.withdrawals.find_one({"device_id": device_id, "status": "paid"})
        if wd:
            qualified = True
    if not qualified and "checkin" in modes and streak_day > 0:
        rewards = cfg.get("refer_checkin_rewards", {})
        rupees = rewards.get(str(streak_day), 0)
        if rupees > 0:
            # award referrer with rupees as bonus
            referrer = await db.users.find_one({"username": user["referred_by"]})
            if referrer:
                pts = int(rupees * cfg.get("conversion_rate", 100))
                await add_transaction(referrer["device_id"], pts, "refer", f"Streak Day {streak_day}", f"Referral streak bonus from @{user['username']}")
            return  # streak bonus given but not marking fully qualified yet
    if qualified:
        await db.users.update_one({"device_id": device_id}, {"$set": {"referral_qualified": True}})
        referrer = await db.users.find_one({"username": user["referred_by"]})
        if referrer:
            await add_transaction(referrer["device_id"], cfg.get("refer_reward", 50), "refer", "Referral bonus", f"@{user['username']} qualified")

@api_router.get("/refer/info")
async def refer_info(device_id: str):
    u = await get_user(device_id)
    cfg = await db.config.find_one({"key": "app"}, {"_id": 0}) or DEFAULT_CONFIG
    # history: users referred by me and points earned
    refs = await db.users.find({"referred_by": u["username"]}, {"_id": 0}).to_list(500)
    history = []
    for r in refs:
        history.append({
            "username": r["username"],
            "joined_at": r["created_at"],
            "qualified": r.get("referral_qualified", False),
        })
    total_earned = await db.transactions.find({"device_id": device_id, "kind": "refer"}, {"_id": 0}).to_list(500)
    total_pts = sum(t["amount_pts"] for t in total_earned)
    return {
        "code": u["username"],
        "rules": {
            "refer_reward": cfg.get("refer_reward", 50),
            "qualify_points": cfg.get("refer_qualify_points", 100),
            "qualify_modes": cfg.get("refer_qualify_modes", []),
            "checkin_rewards": cfg.get("refer_checkin_rewards", {}),
            "conversion_rate": cfg.get("conversion_rate", 100),
        },
        "history": history,
        "total_referrals": len(history),
        "total_earned_pts": total_pts,
    }

# ============================================================
# Wallet & Withdraw
# ============================================================
@api_router.get("/wallet/balance")
async def wallet_balance(device_id: str):
    u = await get_user(device_id)
    cfg = await db.config.find_one({"key": "app"}, {"_id": 0}) or DEFAULT_CONFIG
    rate = cfg.get("conversion_rate", 100)
    rupees = round(u["points"] / rate, 2)
    return {"points": u["points"], "rupees": rupees, "conversion_rate": rate, "min_withdraw": cfg.get("min_withdraw", 10)}

@api_router.get("/wallet/transactions")
async def wallet_transactions(device_id: str, kind: Optional[str] = None):
    q = {"device_id": device_id}
    if kind and kind != "all":
        q["kind"] = kind
    rows = await db.transactions.find(q, {"_id": 0}).sort([("created_at", -1)]).to_list(500)
    return rows

@api_router.post("/wallet/withdraw")
async def wallet_withdraw(data: WithdrawIn):
    u = await get_user(data.device_id)
    cfg = await db.config.find_one({"key": "app"}, {"_id": 0}) or DEFAULT_CONFIG
    rate = cfg.get("conversion_rate", 100)
    pts_needed = data.amount * rate
    if u["points"] < pts_needed:
        raise HTTPException(400, "Insufficient balance")
    if data.amount < cfg.get("min_withdraw", 10):
        raise HTTPException(400, f"Minimum withdraw is ₹{cfg.get('min_withdraw',10)}")
    if data.method not in ("upi", "bank"):
        raise HTTPException(400, "Invalid method")
    wd = {
        "id": gen_id(), "device_id": data.device_id, "username": u["username"],
        "amount": data.amount, "method": data.method, "details": data.details,
        "status": "pending", "is_campaign": False,
        "created_at": now_utc().isoformat(), "processed_at": None,
    }
    await db.withdrawals.insert_one(wd.copy())
    # deduct points immediately (escrow)
    await add_transaction(data.device_id, -pts_needed, "withdraw", f"Withdrawal ₹{data.amount}", f"{data.method.upper()} requested")
    # mark referral as qualified by withdrawal
    await maybe_qualify_referral(data.device_id)
    return {"ok": True, "withdrawal_id": wd["id"]}

@api_router.get("/wallet/withdrawals")
async def wallet_withdrawals(device_id: str):
    rows = await db.withdrawals.find({"device_id": device_id}, {"_id": 0}).sort([("created_at", -1)]).to_list(500)
    return rows

# ============================================================
# Profile / Quick Access
# ============================================================
@api_router.get("/profile/quick-access")
async def profile_quick_access():
    rows = await db.quick_access.find({}, {"_id": 0}).sort([("order", 1)]).to_list(50)
    return rows

# ============================================================
# Admin
# ============================================================
@api_router.post("/admin/login")
async def admin_login(data: AdminLoginIn):
    if data.username != ADMIN_USERNAME or data.password != ADMIN_PASSWORD:
        raise HTTPException(401, "Invalid credentials")
    token = secrets.token_urlsafe(32)
    await db.admin_sessions.insert_one({"token": token, "created_at": now_utc().isoformat()})
    return {"token": token}

@api_router.get("/admin/dashboard")
async def admin_dashboard(_=Depends(require_admin)):
    total_users = await db.users.count_documents({})
    seven_days_ago = (now_utc() - timedelta(days=7)).isoformat()
    active_users = await db.users.count_documents({"last_active": {"$gte": seven_days_ago}})
    paid = await db.withdrawals.aggregate([
        {"$match": {"status": "paid"}},
        {"$group": {"_id": None, "amt": {"$sum": "$amount"}}},
    ]).to_list(1)
    paid_amt = paid[0]["amt"] if paid else 0
    pending = await db.withdrawals.aggregate([
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "amt": {"$sum": "$amount"}}},
    ]).to_list(1)
    pending_amt = pending[0]["amt"] if pending else 0
    task_requests = await db.task_submissions.count_documents({"status": "pending"})
    pending_withdrawals = await db.withdrawals.count_documents({"status": "pending"})
    return {
        "total_users": total_users,
        "active_users": active_users,
        "paid_withdrawal_amount": paid_amt,
        "pending_withdrawal_amount": pending_amt,
        "task_requests": task_requests,
        "pending_withdrawals": pending_withdrawals,
    }

@api_router.get("/admin/users")
async def admin_users(q: Optional[str] = None, _=Depends(require_admin)):
    query = {}
    if q:
        query = {"$or": [{"username": {"$regex": q.lower(), "$options": "i"}}, {"mobile": {"$regex": q}}]}
    rows = await db.users.find(query, {"_id": 0}).sort([("created_at", -1)]).to_list(200)
    return rows

@api_router.get("/admin/users/active")
async def admin_users_active(_=Depends(require_admin)):
    seven_days_ago = (now_utc() - timedelta(days=7)).isoformat()
    rows = await db.users.find({"last_active": {"$gte": seven_days_ago}}, {"_id": 0}).sort([("last_active", -1)]).to_list(500)
    return rows

@api_router.get("/admin/user-detail/{username}")
async def admin_user_detail(username: str, _=Depends(require_admin)):
    u = await db.users.find_one({"username": username.lower()}, {"_id": 0})
    if not u:
        raise HTTPException(404, "User not found")
    wd = await db.withdrawals.find({"device_id": u["device_id"]}, {"_id": 0}).sort([("created_at", -1)]).to_list(200)
    refs = await db.users.count_documents({"referred_by": u["username"]})
    cfg = await db.config.find_one({"key": "app"}, {"_id": 0}) or DEFAULT_CONFIG
    return {
        "user": u, "withdrawals": wd, "referrals": refs,
        "available_rupees": round(u["points"] / cfg.get("conversion_rate", 100), 2),
    }

@api_router.get("/admin/withdrawals")
async def admin_withdrawals(status: Optional[str] = None, _=Depends(require_admin)):
    q = {} if not status else {"status": status}
    rows = await db.withdrawals.find(q, {"_id": 0}).sort([("created_at", -1)]).to_list(500)
    return rows

class WithdrawActionIn(BaseModel):
    withdrawal_id: str
    action: str  # paid | rejected | deducted
    reason: Optional[str] = None
    deduct_amount: Optional[int] = None  # for partial paid

@api_router.post("/admin/withdrawals/action")
async def admin_withdraw_action(data: WithdrawActionIn, _=Depends(require_admin)):
    wd = await db.withdrawals.find_one({"id": data.withdrawal_id}, {"_id": 0})
    if not wd:
        raise HTTPException(404, "Withdrawal not found")
    if wd.get("status") != "pending":
        raise HTTPException(400, "Already processed")
    cfg = await db.config.find_one({"key": "app"}, {"_id": 0}) or DEFAULT_CONFIG
    rate = cfg.get("conversion_rate", 100)
    if data.action == "paid":
        await db.withdrawals.update_one(
            {"id": data.withdrawal_id},
            {"$set": {"status": "paid", "processed_at": now_utc().isoformat()}},
        )
        await db.users.update_one({"device_id": wd["device_id"]}, {"$inc": {"total_withdrawn": wd["amount"]}})
    elif data.action == "rejected":
        await db.withdrawals.update_one(
            {"id": data.withdrawal_id},
            {"$set": {"status": "rejected", "reason": data.reason or "", "processed_at": now_utc().isoformat()}},
        )
        # refund points
        await add_transaction(wd["device_id"], wd["amount"] * rate, "withdraw", "Refund", f"Withdrawal rejected: {data.reason or ''}")
    elif data.action == "deducted":
        amt = data.deduct_amount or 0
        if amt <= 0 or amt > wd["amount"]:
            raise HTTPException(400, "Invalid deduct amount")
        paid_amt = wd["amount"] - amt
        await db.withdrawals.update_one(
            {"id": data.withdrawal_id},
            {"$set": {
                "status": "paid", "amount": paid_amt, "original_amount": wd["amount"],
                "deducted": amt, "reason": data.reason or "", "processed_at": now_utc().isoformat(),
            }},
        )
        # refund deducted portion to user points
        await add_transaction(wd["device_id"], amt * rate, "withdraw", "Deduction refund", data.reason or "Admin deducted")
        await db.users.update_one({"device_id": wd["device_id"]}, {"$inc": {"total_withdrawn": paid_amt}})
    else:
        raise HTTPException(400, "Invalid action")
    return {"ok": True}

@api_router.get("/admin/tasks")
async def admin_tasks(_=Depends(require_admin)):
    rows = await db.tasks.find({}, {"_id": 0}).sort([("created_at", -1)]).to_list(200)
    return rows

class TaskUpsertIn(BaseModel):
    id: Optional[str] = None
    title: str
    reward: int
    rules: str
    tutorial_url: Optional[str] = ""
    form_fields: List[Dict[str, Any]] = []
    status: str = "active"

@api_router.post("/admin/tasks/upsert")
async def admin_task_upsert(data: TaskUpsertIn, _=Depends(require_admin)):
    payload = data.dict()
    if payload.get("id"):
        await db.tasks.update_one({"id": payload["id"]}, {"$set": payload}, upsert=True)
    else:
        payload["id"] = gen_id()
        payload["created_at"] = now_utc().isoformat()
        await db.tasks.insert_one(payload.copy())
    return {"ok": True, "id": payload["id"]}

@api_router.delete("/admin/tasks/{tid}")
async def admin_task_delete(tid: str, _=Depends(require_admin)):
    await db.tasks.delete_one({"id": tid})
    return {"ok": True}

@api_router.get("/admin/task-submissions")
async def admin_task_subs(status: Optional[str] = "pending", _=Depends(require_admin)):
    q = {} if not status else {"status": status}
    rows = await db.task_submissions.find(q, {"_id": 0}).sort([("created_at", -1)]).to_list(500)
    # join with user
    for r in rows:
        u = await db.users.find_one({"device_id": r["device_id"]}, {"_id": 0})
        r["username"] = u["username"] if u else "?"
    return rows

class TaskActionIn(BaseModel):
    submission_id: str
    action: str  # approve | reject | reset

@api_router.post("/admin/task-submissions/action")
async def admin_task_sub_action(data: TaskActionIn, _=Depends(require_admin)):
    sub = await db.task_submissions.find_one({"id": data.submission_id}, {"_id": 0})
    if not sub:
        raise HTTPException(404, "Submission not found")
    if data.action == "approve":
        if sub["status"] == "approved":
            return {"ok": True}
        await db.task_submissions.update_one({"id": data.submission_id}, {"$set": {"status": "approved", "processed_at": now_utc().isoformat()}})
        await add_transaction(sub["device_id"], sub["reward"], "task", sub["task_title"], "Task approved")
        await maybe_qualify_referral(sub["device_id"])
    elif data.action == "reject":
        await db.task_submissions.update_one({"id": data.submission_id}, {"$set": {"status": "rejected", "processed_at": now_utc().isoformat()}})
    elif data.action == "reset":
        await db.task_submissions.delete_one({"id": data.submission_id})
    else:
        raise HTTPException(400, "Invalid action")
    return {"ok": True}

@api_router.get("/admin/campaigns")
async def admin_campaigns(_=Depends(require_admin)):
    rows = await db.campaigns.find({}, {"_id": 0}).sort([("created_at", -1)]).to_list(200)
    return rows

class CampaignUpsertIn(BaseModel):
    id: Optional[str] = None
    title: str
    rules: str
    tutorial_url: Optional[str] = ""
    status: str = "active"

@api_router.post("/admin/campaigns/upsert")
async def admin_campaign_upsert(data: CampaignUpsertIn, _=Depends(require_admin)):
    payload = data.dict()
    payload["reward"] = 0
    if payload.get("id"):
        await db.campaigns.update_one({"id": payload["id"]}, {"$set": payload}, upsert=True)
    else:
        payload["id"] = gen_id()
        payload["created_at"] = now_utc().isoformat()
        await db.campaigns.insert_one(payload.copy())
    return {"ok": True, "id": payload["id"]}

@api_router.delete("/admin/campaigns/{cid}")
async def admin_campaign_delete(cid: str, _=Depends(require_admin)):
    await db.campaigns.delete_one({"id": cid})
    return {"ok": True}

@api_router.get("/admin/banners")
async def admin_banners(_=Depends(require_admin)):
    rows = await db.banners.find({}, {"_id": 0}).sort([("pinned", -1), ("order", 1)]).to_list(100)
    return rows

class BannerUpsertIn(BaseModel):
    id: Optional[str] = None
    title: str
    subtitle: str = ""
    image: str
    url: str = ""
    is_external: bool = False
    pinned: bool = False
    hidden: bool = False
    order: int = 99

@api_router.post("/admin/banners/upsert")
async def admin_banner_upsert(data: BannerUpsertIn, _=Depends(require_admin)):
    payload = data.dict()
    if payload.get("id"):
        await db.banners.update_one({"id": payload["id"]}, {"$set": payload}, upsert=True)
    else:
        payload["id"] = gen_id()
        await db.banners.insert_one(payload.copy())
    return {"ok": True, "id": payload["id"]}

@api_router.delete("/admin/banners/{bid}")
async def admin_banner_delete(bid: str, _=Depends(require_admin)):
    await db.banners.delete_one({"id": bid})
    return {"ok": True}

@api_router.get("/admin/visits")
async def admin_visits(_=Depends(require_admin)):
    rows = await db.visits.find({}, {"_id": 0}).sort([("created_at", -1)]).to_list(200)
    return rows

class VisitUpsertIn(BaseModel):
    id: Optional[str] = None
    title: str
    url: str
    reward_min: int = 10
    reward_max: int = 50
    status: str = "active"

@api_router.post("/admin/visits/upsert")
async def admin_visit_upsert(data: VisitUpsertIn, _=Depends(require_admin)):
    payload = data.dict()
    if payload.get("id"):
        await db.visits.update_one({"id": payload["id"]}, {"$set": payload}, upsert=True)
    else:
        payload["id"] = gen_id()
        payload["created_at"] = now_utc().isoformat()
        await db.visits.insert_one(payload.copy())
    return {"ok": True, "id": payload["id"]}

@api_router.delete("/admin/visits/{vid}")
async def admin_visit_delete(vid: str, _=Depends(require_admin)):
    await db.visits.delete_one({"id": vid})
    return {"ok": True}

class ConfigPatchIn(BaseModel):
    conversion_rate: Optional[int] = None
    refer_reward: Optional[int] = None
    refer_qualify_points: Optional[int] = None
    refer_qualify_modes: Optional[List[str]] = None
    refer_checkin_rewards: Optional[Dict[str, int]] = None
    withdraw_chips: Optional[List[int]] = None
    min_withdraw: Optional[int] = None
    ad_config: Optional[Dict[str, Any]] = None
    app_version: Optional[str] = None
    force_update: Optional[bool] = None

@api_router.post("/admin/config")
async def admin_config_patch(data: ConfigPatchIn, _=Depends(require_admin)):
    update = {k: v for k, v in data.dict().items() if v is not None}
    if not update:
        return {"ok": True}
    await db.config.update_one({"key": "app"}, {"$set": update}, upsert=True)
    return {"ok": True}

@api_router.get("/admin/games-config")
async def admin_games_cfg(_=Depends(require_admin)):
    return await db.games_config.find({}, {"_id": 0}).to_list(100)

class GameCfgIn(BaseModel):
    id: str
    chances: Optional[int] = None
    reward_min: Optional[int] = None
    reward_max: Optional[int] = None

@api_router.post("/admin/games-config")
async def admin_games_cfg_set(data: GameCfgIn, _=Depends(require_admin)):
    update = {k: v for k, v in data.dict().items() if v is not None and k != "id"}
    if update:
        await db.games_config.update_one({"id": data.id}, {"$set": update})
    return {"ok": True}

@api_router.get("/admin/quick-access")
async def admin_qa(_=Depends(require_admin)):
    return await db.quick_access.find({}, {"_id": 0}).sort([("order", 1)]).to_list(50)

class QAUpsertIn(BaseModel):
    id: Optional[str] = None
    label: str
    icon: str = "link"
    url: str
    order: int = 99

@api_router.post("/admin/quick-access")
async def admin_qa_upsert(data: QAUpsertIn, _=Depends(require_admin)):
    payload = data.dict()
    if payload.get("id"):
        await db.quick_access.update_one({"id": payload["id"]}, {"$set": payload}, upsert=True)
    else:
        payload["id"] = gen_id()
        await db.quick_access.insert_one(payload.copy())
    return {"ok": True}

@api_router.delete("/admin/quick-access/{qid}")
async def admin_qa_del(qid: str, _=Depends(require_admin)):
    await db.quick_access.delete_one({"id": qid})
    return {"ok": True}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

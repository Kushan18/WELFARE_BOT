import os
import re
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
import motor.motor_asyncio
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY environment variable not set")
MONGODB_URI = os.getenv("MONGODB_URI")
if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI environment variable not set")

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

# Initialize MongoDB clients
sync_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
async_client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)

# Collections (sync for fast look‑ups, async for chat history)
sync_db = sync_client["welfarebot"]
sync_users_collection = sync_db["users"]
sync_schemes_collection = sync_db["schemes"]
conversations_collection = async_client["welfarebot"]["conversations"]

# FastAPI app
app = FastAPI(title="WelfareBot Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logger = logging.getLogger(__name__)

# ---------- Constants ----------
REQUIRED_FIELDS = [
    "name",
    "language_preference",
    "state",
    "occupation",
    "caste_category",
    "gender",
    "age",
    "income_bracket",
]

SCHEME_KEYWORDS = [
    "scheme",
    "eligible",
    "scholarship",
    "benefit",
    "welfare",
    "apply",
    "government",
    "subsidy",
    "yojana",
    "assistance",
]

# ---------- Helper Functions ----------
def extract_first_name(text: str) -> str:
    """Extract a first name using regex patterns.
    Returns capitalised name or a fallback.
    """
    patterns = [
        r"my\s+name\s+is\s+(\\w+)",
        r"i\s+am\s+(\\w+)",
        r"i['’]?m\s+(\\w+)",
        r"call\s+me\s+(\\w+)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1).capitalize()
    # fallback – first word
    words = text.strip().split()
    return words[0].capitalize() if words else "Friend"

def safe_groq_chat(messages: List[Dict[str, str]], temperature: float = 0.7) -> str:
    """Call Groq chat completion with retries and timeout.
    Returns the response text or an empty string on failure.
    """
    max_retries = 2
    for attempt in range(1, max_retries + 1):
        try:
            resp = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                temperature=temperature,
                timeout=10,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Groq chat error (attempt {attempt}): {e}")
            if attempt == max_retries:
                return ""
    return ""

# ---------- Intent Detection & Handlers ----------
def detect_intent(state: Dict[str, Any]) -> Dict[str, Any]:
    """Determine user intent for routing.
    Updates `state["intent"]`.
    """
    message = state.get("message", "").lower()
    user_doc = state.get("user_profile", {})
    # Scheme‑related keywords
    is_scheme_question = any(kw in message for kw in SCHEME_KEYWORDS)
    profile_complete = all(user_doc.get(f) for f in REQUIRED_FIELDS)
    if is_scheme_question and not profile_complete:
        intent = "onboarding"
    elif is_scheme_question and profile_complete:
        intent = "scheme_query"
    else:
        intent = "faq"
    state["intent"] = intent
    logger.info(f"detect_intent -> {intent}")
    return state

def handle_onboarding(state: Dict[str, Any]) -> Dict[str, Any]:
    """Collect missing profile fields step‑by‑step.
    Uses `extract_first_name` for the first step.
    """
    session_id = state["session_id"]
    message = state["message"].strip()
    # Load current profile (or empty dict)
    user_doc = sync_users_collection.find_one({"session_id": session_id}) or {}
    current_step = user_doc.get("onboarding_step", "name")

    # Helper to persist step
    def update_profile(updates: Dict[str, Any]):
        sync_users_collection.update_one(
            {"session_id": session_id},
            {"$set": updates},
            upsert=True,
        )

    # STEP 1 – name extraction
    if current_step == "name":
        name = extract_first_name(message)
        update_profile({"name": name, "onboarding_step": "language_preference"})
        state["reply"] = (
            f"Hi {name}! 😊\n\n"
            "Which language do you prefer?\n[English] [हिंदी] [తెలుగు] [தமிழ்] [ಕನ್ನಡ]"
        )
        state["onboarding_step"] = "language_preference"
        return state

    # STEP 2 – language
    if current_step == "language_preference":
        lang_map = {
            "hindi": "hi",
            "हिंदी": "hi",
            "telugu": "te",
            "తెలుగు": "te",
            "tamil": "ta",
            "தமிழ்": "ta",
            "kannada": "kn",
            "ಕನ್ನಡ": "kn",
        }
        lower_msg = message.lower()
        lang = "en"
        for key, code in lang_map.items():
            if key in lower_msg:
                lang = code
                break
        # After language, ask if the user wants to continue with profile collection
        update_profile({"language_preference": lang, "onboarding_step": "continue_confirm"})
        state["reply"] = (
            "Great! Do you want to continue providing your details so I can find the best schemes for you? (yes/no)"
        )
        state["onboarding_step"] = "continue_confirm"
        return state

    # Subsequent fields order
    fields_order = [
        "state",
        "occupation",
        "caste_category",
        "gender",
        "age",
        "income_bracket",
    ]
    questions = {
        "state": "Which state are you from?",
        "occupation": "What is your occupation? (student/farmer/daily wage/business/govt/other)",
        "caste_category": "Caste category? (SC/ST/OBC/General)",
        "gender": "Gender? (Male/Female/Other)",
        "age": "How old are you?",
        "income_bracket": "Annual family income in rupees?",
    }
    if current_step == "continue_confirm":
        # User answered yes/no to continue profile collection
        if message.strip().lower() in ["yes", "y", "yeah", "sure"]:
            # Start collecting the first missing field (state)
            update_profile({"onboarding_step": "state"})
            state["reply"] = "Great! Which state are you from?"
            state["onboarding_step"] = "state"
        else:
            # User does not want to continue – switch to FAQ mode
            state["intent"] = "faq"
            state["reply"] = "No problem! Feel free to ask me any question about welfare schemes."
        return state
    if current_step in fields_order:
        update_profile({current_step: message, "onboarding_step": fields_order[fields_order.index(current_step) + 1] if current_step != fields_order[-1] else "completed"})
        # Determine next missing field
        user_doc = sync_users_collection.find_one({"session_id": session_id}) or {}
        missing = [f for f in REQUIRED_FIELDS if not user_doc.get(f)]
        if not missing:
            # Profile complete – forward to scheme query
            state["intent"] = "scheme_query"
            return handle_scheme_query(state)
        next_field = missing[0]
        state["reply"] = questions.get(next_field, f"Please provide your {next_field}.")
        state["onboarding_step"] = next_field
        return state

    # Fallback – should not reach here
    state["reply"] = "Could you provide more details?"
    return state

def handle_faq(state: Dict[str, Any]) -> Dict[str, Any]:
    """Answer generic questions via Groq without needing a profile."""
    user_doc = state.get("user_profile", {})
    name_part = f"The user's name is {user_doc.get('name')}. " if user_doc.get("name") else ""
    system_prompt = (
        "You are a helpful welfare officer assistant. "
        + name_part +
        "Answer questions about government schemes, eligibility, and how to apply. Be friendly and concise."
    )
    reply = safe_groq_chat(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": state["message"]},
        ],
        temperature=0.7,
    )
    state["reply"] = reply or "I’m here to help! Ask me about welfare schemes."
    return state

def handle_scheme_query(state: Dict[str, Any]) -> Dict[str, Any]:
    """Return matching schemes based on the stored user profile."""
    session_id = state["session_id"]
    user_doc = sync_users_collection.find_one({"session_id": session_id}) or {}
    try:
        from agent.eligibility import match_schemes
        schemes = match_schemes(user_doc, sync_schemes_collection)
        if schemes:
            scheme_text = "\n".join(
                [f"• **{s['name']}**: {s['description']}\n  Apply: {s['apply_link']}" for s in schemes[:5]]
            )
            state["reply"] = f"Here are the schemes that match your profile:\n{scheme_text}"
        else:
            state["reply"] = "No exact matches found right now. Check back later for new schemes!"
    except Exception as e:
        logger.error(f"Scheme query error: {e}")
        state["reply"] = "I’m having trouble fetching schemes right now. Please try again later."
    return state

# ---------- Request Models ----------
class ChatRequest(BaseModel):
    session_id: str
    message: str

class SubmitProfileRequest(BaseModel):
    session_id: str
    name: str
    language_preference: str
    state: str
    occupation: str
    caste_category: str
    gender: str
    age: str
    income_bracket: str
    aadhaar: Optional[str] = ""

class ChatResponse(BaseModel):
    reply: str

# ---------- API Endpoints ----------
@app.get("/health")
async def health():
    return {"status": "running", "db": "connected"}

@app.get("/schemes")
async def get_schemes():
    schemes = list(sync_schemes_collection.find({}, {"_id": 0}))
    return {"schemes": schemes}

@app.get("/session")
async def get_session(session_id: str):
    user = sync_users_collection.find_one({"session_id": session_id})
    return {"session_id": session_id, "profile": user or {}}

@app.post("/submit-profile")
async def submit_profile(request: SubmitProfileRequest):
    try:
        prof = request.dict()
        sync_users_collection.update_one(
            {"session_id": request.session_id},
            {"$set": prof},
            upsert=True,
        )
        from agent.eligibility import match_schemes
        schemes = match_schemes(prof, sync_schemes_collection)
        return {"status": "success", "schemes": schemes[:5]}
    except Exception as e:
        logger.error(f"submit_profile error: {e}")
        return {"error": str(e)}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    session_id = request.session_id
    message = request.message.strip()
    if not message:
        return ChatResponse(reply="Please say something.")
    # Load user profile for context
    user_doc = sync_users_collection.find_one({"session_id": session_id}) or {}
    state = {
        "session_id": session_id,
        "message": message,
        "user_profile": user_doc,
        "intent": None,
        "reply": None,
    }
    # Route via graph (will call appropriate handler)
    try:
        from agent.graph import welfare_graph
        result = welfare_graph.invoke(state)
        reply = result.get("reply", "Sorry, I couldn’t process that.")
    except Exception as e:
        logger.error(f"/chat error: {e}")
        reply = f"Error: {str(e)[:100]}"
    # Store conversation asynchronously
    await conversations_collection.insert_one({
        "session_id": session_id,
        "user_message": message,
        "bot_reply": reply,
        "timestamp": datetime.utcnow(),
    })
    return ChatResponse(reply=reply)
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import socketio
from emergentintegrations.llm.chat import LlmChat, UserMessage
import httpx
import tempfile

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Settings
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Security
security = HTTPBearer()

# Socket.IO setup
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Create the main app
app = FastAPI()

# Socket.IO app
socket_app = socketio.ASGIApp(sio, app)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserSignup(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Token(BaseModel):
    access_token: str
    token_type: str

class ChatMessage(BaseModel):
    message: str
    chat_type: Optional[str] = "text"  # text or voice

class Profile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    bio: str
    career: str
    university: str
    field: str  # AI, Economics, Business, etc.
    image: str  # base64 image
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SwipeAction(BaseModel):
    profile_id: str
    action: str  # "like" or "pass"

class Match(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    profile_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    match_id: str
    sender_id: str
    content: str
    message_type: str = "text"  # text, audio, video
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ==================== HELPER FUNCTIONS ====================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/signup", response_model=Token)
async def signup(user_data: UserSignup):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        name=user_data.name,
        hashed_password=hashed_password
    )
    
    await db.users.insert_one(user.dict())
    
    # Create token
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(
        data={"sub": user["id"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"]
    }

# ==================== AI CHAT ENDPOINTS ====================

@api_router.post("/chat/ai")
async def chat_with_ai(chat_data: ChatMessage, current_user: dict = Depends(get_current_user)):
    try:
        # Initialize Claude chat
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"user_{current_user['id']}_career_chat",
            system_message="""You are a helpful career guidance counselor. You help users explore career options, 
            provide advice on projects, certifications, and connect them with professionals in their field of interest.
            Be friendly, encouraging, and provide actionable advice. When users ask about specific fields, 
            suggest concrete next steps like courses, projects, or networking opportunities.
            
            IMPORTANT: If the user mentions wanting to collaborate, join, work with others, find partners, or meet people 
            in a specific field (like AI, Quantum, Business, etc.), respond in this EXACT format:
            SHOW_PROFILES:<field_name>
            Then add your normal encouraging message about connecting with others.
            
            Examples:
            - User: "I want to collaborate with AI people" -> Response: "SHOW_PROFILES:AI\nThat's great! Connecting with AI professionals can..."
            - User: "Looking to join a quantum computing project" -> Response: "SHOW_PROFILES:Quantum\nAwesome! Quantum computing is..."
            - User: "Want to work with business minded folks" -> Response: "SHOW_PROFILES:Business\nExcellent! Business...""""
        ).with_model("anthropic", "claude-3-7-sonnet-20250219")
        
        # Send message to Claude
        user_message = UserMessage(text=chat_data.message)
        response = await chat.send_message(user_message)
        
        # Check if response contains SHOW_PROFILES command
        profiles_data = None
        clean_response = response
        
        if "SHOW_PROFILES:" in response:
            # Extract field and clean response
            lines = response.split('\n')
            for line in lines:
                if line.startswith("SHOW_PROFILES:"):
                    field = line.replace("SHOW_PROFILES:", "").strip()
                    # Fetch 2 profiles from that field
                    profiles = await db.profiles.find({
                        "$or": [
                            {"field": {"$regex": field, "$options": "i"}},
                            {"career": {"$regex": field, "$options": "i"}}
                        ]
                    }).limit(2).to_list(2)
                    
                    if profiles:
                        profiles_data = [Profile(**p) for p in profiles]
                    
                    # Remove the command from response
                    clean_response = '\n'.join([l for l in lines if not l.startswith("SHOW_PROFILES:")])
                    break
        
        # Store conversation in DB
        conversation_entry = {
            "user_id": current_user["id"],
            "user_message": chat_data.message,
            "ai_response": clean_response,
            "chat_type": chat_data.chat_type,
            "created_at": datetime.utcnow()
        }
        await db.conversations.insert_one(conversation_entry)
        
        result = {
            "response": clean_response,
            "type": "text"
        }
        
        if profiles_data:
            result["profiles"] = [p.dict() for p in profiles_data]
            result["type"] = "profiles"
        
        return result
    except Exception as e:
        logger.error(f"Error in AI chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI chat error: {str(e)}")

@api_router.get("/chat/history")
async def get_chat_history(current_user: dict = Depends(get_current_user)):
    conversations = await db.conversations.find(
        {"user_id": current_user["id"]},
        {"_id": 0}  # Exclude MongoDB ObjectId
    ).sort("created_at", -1).limit(50).to_list(50)
    return conversations

# ==================== PROFILE ENDPOINTS ====================

@api_router.get("/profiles", response_model=List[Profile])
async def get_profiles(current_user: dict = Depends(get_current_user), field: Optional[str] = None, limit: Optional[int] = 20):
    # Get profiles that user hasn't swiped on yet
    user_swipes = await db.swipes.find({"user_id": current_user["id"]}).to_list(1000)
    swiped_profile_ids = [swipe["profile_id"] for swipe in user_swipes]
    
    query = {"id": {"$nin": swiped_profile_ids}}
    
    # Filter by field if provided
    if field:
        query["$or"] = [
            {"field": {"$regex": field, "$options": "i"}},
            {"career": {"$regex": field, "$options": "i"}},
            {"bio": {"$regex": field, "$options": "i"}}
        ]
    
    profiles = await db.profiles.find(query).to_list(limit)
    
    return [Profile(**profile) for profile in profiles]

@api_router.post("/profiles/swipe")
async def swipe_profile(swipe_data: SwipeAction, current_user: dict = Depends(get_current_user)):
    # Record swipe
    swipe_record = {
        "user_id": current_user["id"],
        "profile_id": swipe_data.profile_id,
        "action": swipe_data.action,
        "created_at": datetime.utcnow()
    }
    await db.swipes.insert_one(swipe_record)
    
    # If liked, create match
    if swipe_data.action == "like":
        match = Match(
            user_id=current_user["id"],
            profile_id=swipe_data.profile_id
        )
        await db.matches.insert_one(match.dict())
        return {"matched": True, "match_id": match.id}
    
    return {"matched": False}

# ==================== MATCH & MESSAGING ENDPOINTS ====================

@api_router.get("/matches")
async def get_matches(current_user: dict = Depends(get_current_user)):
    matches = await db.matches.find({"user_id": current_user["id"]}).to_list(100)
    
    # Get profile details for each match
    result = []
    for match in matches:
        profile = await db.profiles.find_one({"id": match["profile_id"]})
        if profile:
            result.append({
                "match_id": match["id"],
                "profile": Profile(**profile)
            })
    
    return result

@api_router.get("/messages/{match_id}")
async def get_messages(match_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find(
        {"match_id": match_id},
        {"_id": 0}  # Exclude MongoDB ObjectId
    ).sort("created_at", 1).to_list(1000)
    
    return messages

@api_router.post("/messages/{match_id}")
async def send_message(match_id: str, content: str, current_user: dict = Depends(get_current_user)):
    message = Message(
        match_id=match_id,
        sender_id=current_user["id"],
        content=content
    )
    await db.messages.insert_one(message.dict())
    
    # Emit socket event
    await sio.emit('new_message', message.dict(), room=match_id)
    
    return message

# ==================== SOCKET.IO EVENTS ====================

@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def join_match(sid, data):
    match_id = data.get('match_id')
    sio.enter_room(sid, match_id)
    logger.info(f"Client {sid} joined match room {match_id}")

@sio.event
async def send_message(sid, data):
    match_id = data.get('match_id')
    content = data.get('content')
    sender_id = data.get('sender_id')
    
    message = Message(
        match_id=match_id,
        sender_id=sender_id,
        content=content
    )
    await db.messages.insert_one(message.dict())
    
    await sio.emit('new_message', message.dict(), room=match_id)

# ==================== AUDIO TRANSCRIPTION ENDPOINT ====================

@api_router.post("/transcribe")
async def transcribe_audio(audio_file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Transcribe audio to text using OpenAI Whisper via Emergent proxy"""
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.m4a') as temp_file:
            content = await audio_file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Use OpenAI Whisper API through emergent proxy
        async with httpx.AsyncClient(timeout=30.0) as client:
            with open(temp_file_path, 'rb') as audio:
                files = {
                    'file': ('audio.m4a', audio, 'audio/m4a'),
                }
                data = {
                    'model': 'whisper-1',
                }
                headers = {
                    'Authorization': f'Bearer {os.environ.get("EMERGENT_LLM_KEY")}',
                }
                
                # Use emergent proxy URL for whisper
                proxy_url = os.getenv("INTEGRATION_PROXY_URL", "https://integrations.emergentagent.com")
                response = await client.post(
                    f'{proxy_url}/llm/v1/audio/transcriptions',
                    files=files,
                    data=data,
                    headers=headers
                )
                
                if response.status_code == 200:
                    result = response.json()
                    # Clean up temp file
                    os.unlink(temp_file_path)
                    return {"text": result.get('text', '')}
                else:
                    logger.error(f"Whisper API error: {response.text}")
                    os.unlink(temp_file_path)
                    raise HTTPException(status_code=500, detail="Failed to transcribe audio")
                    
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        # Try to clean up temp file if it exists
        try:
            if 'temp_file_path' in locals():
                os.unlink(temp_file_path)
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

# ==================== SEED DATA ENDPOINT ====================

@api_router.post("/seed/profiles")
async def seed_profiles():
    """Create mock profiles for testing"""
    
    # Check if profiles already exist
    existing_count = await db.profiles.count_documents({})
    if existing_count > 0:
        return {"message": f"Already have {existing_count} profiles"}
    
    mock_profiles = [
        {
            "name": "Sarah Chen",
            "bio": "AI Engineer with background in Economics. Love helping students transition into tech!",
            "career": "Senior ML Engineer at Google",
            "university": "Stanford University",
            "field": "AI & Economics",
            "image": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzRBOTBFMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjYwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnNDPC90ZXh0Pjwvc3ZnPg=="
        },
        {
            "name": "Michael Rodriguez",
            "bio": "Business Analyst turned Data Scientist. Happy to share my journey and mentor others!",
            "career": "Data Science Lead at Microsoft",
            "university": "UC Berkeley",
            "field": "Business & AI",
            "image": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzM0QTg1MyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjYwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk1SPC90ZXh0Pjwvc3ZnPg=="
        },
        {
            "name": "Emily Watson",
            "bio": "Economics PhD working on AI policy. Love discussing career transitions from social sciences to tech!",
            "career": "AI Policy Researcher at OpenAI",
            "university": "MIT",
            "field": "Economics & AI Policy",
            "image": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI0U5MUU2MyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjYwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVXPC90ZXh0Pjwvc3ZnPg=="
        },
        {
            "name": "David Kim",
            "bio": "Product Manager with Economics degree. Can help with career pivots and project ideas!",
            "career": "Senior PM at Meta",
            "university": "Harvard Business School",
            "field": "Business & Product",
            "image": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI0ZCQkMwNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjYwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkRLPC90ZXh0Pjwvc3ZnPg=="
        },
        {
            "name": "Priya Sharma",
            "bio": "Self-taught developer from Finance background. Passionate about helping career switchers!",
            "career": "Software Engineer at Stripe",
            "university": "NYU Stern",
            "field": "Finance & Tech",
            "image": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzlDMjdCMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjYwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlBTPC90ZXh0Pjwvc3ZnPg=="
        },
        {
            "name": "Alex Thompson",
            "bio": "Consultant turned AI Entrepreneur. Love sharing startup insights and AI project ideas!",
            "career": "Founder at AI Startup",
            "university": "Cambridge",
            "field": "Consulting & AI",
            "image": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI0ZGNTcyMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjYwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkFUPC90ZXh0Pjwvc3ZnPg=="
        }
    ]
    
    profiles = []
    for profile_data in mock_profiles:
        profile = Profile(**profile_data)
        profiles.append(profile.dict())
    
    await db.profiles.insert_many(profiles)
    
    return {"message": f"Created {len(profiles)} mock profiles"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Mount Socket.IO
app = socket_app

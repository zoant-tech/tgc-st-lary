from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pymongo import MongoClient
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import json
import uuid
import shutil
from pathlib import Path
import random

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB setup
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'tcg_pocket_db')

client = MongoClient(mongo_url)
db = client[db_name]

# Collections
cards_collection = db.cards
packs_collection = db.booster_packs
users_collection = db.users
user_collections_collection = db.user_collections

# Create uploads directory
uploads_dir = Path("/app/backend/uploads")
uploads_dir.mkdir(exist_ok=True)

# Serve static files
app.mount("/uploads", StaticFiles(directory="/app/backend/uploads"), name="uploads")

# Pydantic models
class Card(BaseModel):
    id: str
    name: str
    rarity: str  # Common, Uncommon, Rare, Holo, Ultra Rare, Secret Rare
    card_type: str  # Pokemon, Trainer, Energy
    hp: Optional[int] = None
    attack_1: Optional[str] = None
    attack_2: Optional[str] = None
    weakness: Optional[str] = None
    resistance: Optional[str] = None
    description: Optional[str] = None
    image_url: str
    set_name: Optional[str] = None

class RarityDistribution(BaseModel):
    rarity: str
    count: int
    guaranteed: bool = False

class BoosterPack(BaseModel):
    id: str
    name: str
    description: str
    card_count: int
    rarity_distribution: List[RarityDistribution]
    available_cards: List[str]  # Card IDs
    image_url: Optional[str] = None

class PackOpenRequest(BaseModel):
    pack_id: str
    user_id: Optional[str] = "default_user"

class UserCollection(BaseModel):
    user_id: str
    collected_cards: List[Dict[str, Any]]
    total_packs_opened: int
    created_at: str

# API Routes

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "TCG Pocket API is running"}

@app.post("/api/cards")
async def create_card(
    name: str = Form(...),
    rarity: str = Form(...),
    card_type: str = Form(...),
    hp: Optional[int] = Form(None),
    attack_1: Optional[str] = Form(None),
    attack_2: Optional[str] = Form(None),
    weakness: Optional[str] = Form(None),
    resistance: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    set_name: Optional[str] = Form(None),
    image: UploadFile = File(...)
):
    try:
        # Generate unique ID and save image
        card_id = str(uuid.uuid4())
        
        # Save uploaded image
        file_extension = image.filename.split('.')[-1] if '.' in image.filename else 'jpg'
        image_filename = f"{card_id}.{file_extension}"
        image_path = uploads_dir / image_filename
        
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        
        image_url = f"/uploads/{image_filename}"
        
        # Create card document
        card_data = {
            "id": card_id,
            "name": name,
            "rarity": rarity,
            "card_type": card_type,
            "hp": hp,
            "attack_1": attack_1,
            "attack_2": attack_2,
            "weakness": weakness,
            "resistance": resistance,
            "description": description,
            "image_url": image_url,
            "set_name": set_name
        }
        
        # Insert into MongoDB
        result = cards_collection.insert_one(card_data)
        
        # Remove the MongoDB _id field from response to avoid serialization issues
        card_data.pop('_id', None)
        
        return {"message": "Card created successfully", "card": card_data}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating card: {str(e)}")

@app.get("/api/cards")
async def get_cards():
    try:
        cards = list(cards_collection.find({}, {"_id": 0}))
        return {"cards": cards}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching cards: {str(e)}")

@app.get("/api/cards/{card_id}")
async def get_card(card_id: str):
    try:
        card = cards_collection.find_one({"id": card_id}, {"_id": 0})
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        return {"card": card}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching card: {str(e)}")

@app.post("/api/booster-packs")
async def create_booster_pack(pack: BoosterPack):
    try:
        pack_data = pack.dict()
        result = packs_collection.insert_one(pack_data)
        
        # Remove the MongoDB _id field from response to avoid serialization issues
        pack_data.pop('_id', None)
        
        return {"message": "Booster pack created successfully", "pack": pack_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating booster pack: {str(e)}")

@app.get("/api/booster-packs")
async def get_booster_packs():
    try:
        packs = list(packs_collection.find({}, {"_id": 0}))
        return {"packs": packs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching booster packs: {str(e)}")

@app.post("/api/open-pack")
async def open_pack(request: PackOpenRequest):
    try:
        # Get pack details
        pack = packs_collection.find_one({"id": request.pack_id}, {"_id": 0})
        if not pack:
            raise HTTPException(status_code=404, detail="Booster pack not found")
        
        # Get available cards for this pack
        available_card_ids = pack["available_cards"]
        if not available_card_ids:
            raise HTTPException(status_code=400, detail="No cards available in this pack")
        
        # Get cards from database
        available_cards = list(cards_collection.find(
            {"id": {"$in": available_card_ids}}, 
            {"_id": 0}
        ))
        
        if not available_cards:
            raise HTTPException(status_code=400, detail="No valid cards found for this pack")
        
        # Generate pack contents based on rarity distribution
        pulled_cards = []
        
        for distribution in pack["rarity_distribution"]:
            rarity = distribution["rarity"]
            count = distribution["count"]
            guaranteed = distribution.get("guaranteed", False)
            
            # Filter cards by rarity
            rarity_cards = [card for card in available_cards if card["rarity"] == rarity]
            
            if guaranteed and not rarity_cards:
                # If guaranteed but no cards of this rarity, skip
                continue
            
            if guaranteed and rarity_cards:
                # If guaranteed, ensure we get at least one of this rarity
                selected = random.sample(rarity_cards, min(count, len(rarity_cards)))
                pulled_cards.extend(selected)
            elif rarity_cards:
                # Normal probability-based selection
                for _ in range(count):
                    if rarity_cards:
                        selected_card = random.choice(rarity_cards)
                        pulled_cards.append(selected_card)
        
        # Fill remaining slots with random cards if needed
        target_count = pack["card_count"]
        while len(pulled_cards) < target_count and available_cards:
            random_card = random.choice(available_cards)
            pulled_cards.append(random_card)
        
        # Add cards to user's collection
        await add_cards_to_collection(request.user_id, pulled_cards)
        
        return {
            "message": "Pack opened successfully!",
            "pack_name": pack["name"],
            "cards": pulled_cards[:target_count]  # Ensure we don't exceed target count
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error opening pack: {str(e)}")

async def add_cards_to_collection(user_id: str, cards: List[Dict[str, Any]]):
    """Add opened cards to user's collection"""
    try:
        # Get or create user collection
        user_collection = user_collections_collection.find_one({"user_id": user_id})
        
        if not user_collection:
            # Create new collection
            user_collection = {
                "user_id": user_id,
                "collected_cards": [],
                "total_packs_opened": 0,
                "created_at": str(uuid.uuid4())
            }
        
        # Add timestamp to each card when collected
        timestamped_cards = []
        for card in cards:
            card_copy = card.copy()
            card_copy["collected_at"] = str(uuid.uuid4())  # Using uuid as timestamp placeholder
            timestamped_cards.append(card_copy)
        
        # Update collection
        user_collection["collected_cards"].extend(timestamped_cards)
        user_collection["total_packs_opened"] = user_collection.get("total_packs_opened", 0) + 1
        
        # Upsert to database
        user_collections_collection.update_one(
            {"user_id": user_id},
            {"$set": user_collection},
            upsert=True
        )
        
    except Exception as e:
        print(f"Error adding cards to collection: {str(e)}")

@app.get("/api/user-collection/{user_id}")
async def get_user_collection(user_id: str):
    try:
        collection = user_collections_collection.find_one({"user_id": user_id}, {"_id": 0})
        if not collection:
            return {
                "user_id": user_id,
                "collected_cards": [],
                "total_packs_opened": 0,
                "unique_cards": 0,
                "rarity_counts": {}
            }
        
        # Calculate statistics
        collected_cards = collection.get("collected_cards", [])
        unique_cards = len(set(card["id"] for card in collected_cards))
        
        # Count cards by rarity
        rarity_counts = {}
        for card in collected_cards:
            rarity = card.get("rarity", "Unknown")
            rarity_counts[rarity] = rarity_counts.get(rarity, 0) + 1
        
        return {
            "user_id": user_id,
            "collected_cards": collected_cards,
            "total_packs_opened": collection.get("total_packs_opened", 0),
            "unique_cards": unique_cards,
            "total_cards": len(collected_cards),
            "rarity_counts": rarity_counts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user collection: {str(e)}")

@app.get("/api/rarities")
async def get_rarities():
    return {
        "rarities": [
            "Common",
            "Uncommon", 
            "Rare",
            "Holo",
            "Ultra Rare",
            "Secret Rare"
        ]
    }

@app.get("/api/card-types")
async def get_card_types():
    return {
        "card_types": [
            "Pokemon",
            "Trainer",
            "Energy"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
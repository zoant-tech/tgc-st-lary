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
collections_db = db.card_collections  # Renamed to avoid conflict with MongoDB collections
users_collection = db.users
user_collections_collection = db.user_collections

# Create uploads directory
uploads_dir = Path("/app/backend/uploads")
uploads_dir.mkdir(exist_ok=True)

# Serve static files
app.mount("/uploads", StaticFiles(directory="/app/backend/uploads"), name="uploads")

# Rarity probabilities (like real Pokémon packs)
RARITY_PROBABILITIES = {
    "Common": 0.65,      # 65% chance
    "Uncommon": 0.20,    # 20% chance
    "Rare": 0.10,        # 10% chance
    "Holo": 0.03,        # 3% chance
    "Ultra Rare": 0.015, # 1.5% chance
    "Secret Rare": 0.005 # 0.5% chance
}

CARDS_PER_PACK = 6  # 6 cards per pack

# Pydantic models
class Card(BaseModel):
    id: str
    name: str
    rarity: str  # Common, Uncommon, Rare, Holo, Ultra Rare, Secret Rare
    card_type: str  # Pokemon, Trainer, Energy
    collection_id: str  # Which collection this card belongs to
    card_number: int  # Card number in the collection (e.g., 1, 2, 3...)
    hp: Optional[int] = None
    attack_1: Optional[str] = None
    attack_2: Optional[str] = None
    weakness: Optional[str] = None
    resistance: Optional[str] = None
    description: Optional[str] = None
    image_url: str
    set_name: Optional[str] = None

class CardCollection(BaseModel):
    id: str
    name: str
    description: str
    total_cards_in_set: int  # Total number of cards that should be in this collection
    release_date: Optional[str] = None
    image_url: Optional[str] = None

class PackOpenRequest(BaseModel):
    collection_id: str
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

@app.post("/api/collections")
async def create_collection(collection: CardCollection):
    try:
        collection_data = collection.dict()
        result = collections_db.insert_one(collection_data)
        
        # Remove the MongoDB _id field from response to avoid serialization issues
        collection_data.pop('_id', None)
        
        return {"message": "Collection created successfully", "collection": collection_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating collection: {str(e)}")

@app.get("/api/collections")
async def get_collections():
    try:
        collections = list(collections_db.find({}, {"_id": 0}))
        
        # Add actual card counts to each collection
        for collection in collections:
            card_count = cards_collection.count_documents({"collection_id": collection["id"]})
            collection["actual_cards"] = card_count
        
        return {"collections": collections}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching collections: {str(e)}")

@app.delete("/api/collections/{collection_id}")
async def delete_collection(collection_id: str):
    try:
        # Check if collection exists
        collection = collections_db.find_one({"id": collection_id})
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        # Check if there are cards in this collection
        card_count = cards_collection.count_documents({"collection_id": collection_id})
        if card_count > 0:
            raise HTTPException(status_code=400, detail=f"Cannot delete collection with {card_count} cards. Delete cards first.")
        
        # Delete the collection
        result = collections_db.delete_one({"id": collection_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        return {"message": "Collection deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting collection: {str(e)}")

@app.post("/api/cards-from-url")
async def create_card_from_url(card_data: dict):
    try:
        # Generate unique ID
        card_id = str(uuid.uuid4())
        
        # Create card document with URL-based image
        card_document = {
            "id": card_id,
            "name": card_data["name"],
            "rarity": card_data["rarity"],
            "card_type": card_data["card_type"],
            "collection_id": card_data["collection_id"],
            "card_number": card_data["card_number"],
            "hp": card_data.get("hp"),
            "attack_1": card_data.get("attack_1"),
            "attack_2": card_data.get("attack_2"),
            "weakness": card_data.get("weakness"),
            "resistance": card_data.get("resistance"),
            "description": card_data.get("description"),
            "image_url": card_data["image_url"],  # Use the provided URL directly
            "set_name": card_data.get("set_name")
        }
        
        # Check if card number already exists in this collection
        existing_card = cards_collection.find_one({
            "collection_id": card_data["collection_id"], 
            "card_number": card_data["card_number"]
        })
        if existing_card:
            raise HTTPException(status_code=400, detail=f"Card number {card_data['card_number']} already exists in this collection")
        
        # Insert into MongoDB
        result = cards_collection.insert_one(card_document)
        
        # Remove the MongoDB _id field from response to avoid serialization issues
        card_document.pop('_id', None)
        
        return {"message": "Card created successfully from URL", "card": card_document}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating card from URL: {str(e)}")

@app.post("/api/cards")
async def create_card(
    name: str = Form(...),
    rarity: str = Form(...),
    card_type: str = Form(...),
    collection_id: str = Form(...),
    card_number: int = Form(...),
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
        # Check if card number already exists in this collection
        existing_card = cards_collection.find_one({
            "collection_id": collection_id, 
            "card_number": card_number
        })
        if existing_card:
            raise HTTPException(status_code=400, detail=f"Card number {card_number} already exists in this collection")
        
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
            "collection_id": collection_id,
            "card_number": card_number,
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
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating card: {str(e)}")

@app.get("/api/cards")
async def get_cards():
    try:
        cards = list(cards_collection.find({}, {"_id": 0}))
        return {"cards": cards}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching cards: {str(e)}")

@app.get("/api/cards/collection/{collection_id}")
async def get_cards_by_collection(collection_id: str):
    try:
        cards = list(cards_collection.find({"collection_id": collection_id}, {"_id": 0}))
        return {"cards": cards}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching cards by collection: {str(e)}")

@app.get("/api/collection-overview/{collection_id}")
async def get_collection_overview(collection_id: str):
    try:
        # Get collection details
        collection = collections_db.find_one({"id": collection_id}, {"_id": 0})
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        # Get all cards in this collection
        cards = list(cards_collection.find({"collection_id": collection_id}, {"_id": 0}))
        
        # Sort cards by card number
        cards.sort(key=lambda x: x.get("card_number", 0))
        
        # Create complete overview with missing cards
        total_cards_in_set = collection.get("total_cards_in_set", 50)
        complete_set = []
        
        for i in range(1, total_cards_in_set + 1):
            # Find card with this number
            found_card = next((card for card in cards if card.get("card_number") == i), None)
            if found_card:
                complete_set.append({
                    "card_number": i,
                    "exists": True,
                    "card": found_card
                })
            else:
                complete_set.append({
                    "card_number": i,
                    "exists": False,
                    "card": None
                })
        
        return {
            "collection": collection,
            "complete_set": complete_set,
            "total_cards_in_set": total_cards_in_set,
            "actual_cards_created": len(cards)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching collection overview: {str(e)}")

@app.delete("/api/cards/{card_id}")
async def delete_card(card_id: str):
    try:
        # Find the card first to get the image path
        card = cards_collection.find_one({"id": card_id}, {"_id": 0})
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        
        # Delete the card from database
        result = cards_collection.delete_one({"id": card_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Card not found")
        
        # Try to delete the image file (optional, don't fail if file doesn't exist)
        try:
            if card.get("image_url"):
                image_filename = card["image_url"].replace("/uploads/", "")
                image_path = uploads_dir / image_filename
                if image_path.exists():
                    image_path.unlink()
        except Exception as img_error:
            print(f"Warning: Could not delete image file: {img_error}")
        
        return {"message": "Card deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting card: {str(e)}")

@app.post("/api/open-pack")
async def open_pack(request: PackOpenRequest):
    try:
        # Get collection details
        collection = collections_db.find_one({"id": request.collection_id}, {"_id": 0})
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        # Get all cards from this collection
        available_cards = list(cards_collection.find(
            {"collection_id": request.collection_id}, 
            {"_id": 0}
        ))
        
        if not available_cards:
            raise HTTPException(status_code=400, detail="No cards available in this collection")
        
        # Group cards by type for guaranteed selections
        pokemon_cards = [card for card in available_cards if card["card_type"] == "Pokemon"]
        trainer_cards = [card for card in available_cards if card["card_type"] == "Trainer"]
        energy_cards = [card for card in available_cards if card["card_type"] == "Energy"]
        
        pulled_cards = []
        
        # Guarantee 1 Energy card
        if energy_cards:
            energy_card = random.choice(energy_cards)
            pulled_cards.append(energy_card)
        elif available_cards:  # Fallback if no energy cards
            pulled_cards.append(random.choice(available_cards))
        
        # Guarantee 1 Trainer card
        if trainer_cards:
            trainer_card = random.choice(trainer_cards)
            pulled_cards.append(trainer_card)
        elif available_cards:  # Fallback if no trainer cards
            pulled_cards.append(random.choice(available_cards))
        
        # Fill remaining 4 slots with random cards based on rarity probabilities
        remaining_slots = CARDS_PER_PACK - len(pulled_cards)
        
        # Group all cards by rarity for probability-based selection
        cards_by_rarity = {}
        for card in available_cards:
            rarity = card["rarity"]
            if rarity not in cards_by_rarity:
                cards_by_rarity[rarity] = []
            cards_by_rarity[rarity].append(card)
        
        for _ in range(remaining_slots):
            # Generate random number to determine rarity based on probabilities
            rand = random.random()
            cumulative_prob = 0
            selected_rarity = "Common"  # default fallback
            
            for rarity, prob in RARITY_PROBABILITIES.items():
                cumulative_prob += prob
                if rand <= cumulative_prob:
                    selected_rarity = rarity
                    break
            
            # Select a random card of the chosen rarity
            if selected_rarity in cards_by_rarity and cards_by_rarity[selected_rarity]:
                selected_card = random.choice(cards_by_rarity[selected_rarity])
                pulled_cards.append(selected_card)
            else:
                # Fallback to any available card if selected rarity not available
                if available_cards:
                    selected_card = random.choice(available_cards)
                    pulled_cards.append(selected_card)
        
        # Add cards to user's collection
        await add_cards_to_collection(request.user_id, pulled_cards)
        
        return {
            "message": "Pack opened successfully!",
            "collection_name": collection["name"],
            "cards": pulled_cards
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
                "rarity_counts": {},
                "collection_stats": {}
            }
        
        # Calculate statistics
        collected_cards = collection.get("collected_cards", [])
        unique_cards = len(set(card["id"] for card in collected_cards))
        
        # Count cards by rarity
        rarity_counts = {}
        for card in collected_cards:
            rarity = card.get("rarity", "Unknown")
            rarity_counts[rarity] = rarity_counts.get(rarity, 0) + 1
        
        # Count cards by collection
        collection_stats = {}
        for card in collected_cards:
            coll_id = card.get("collection_id", "Unknown")
            if coll_id not in collection_stats:
                collection_stats[coll_id] = {"count": 0, "unique": set()}
            collection_stats[coll_id]["count"] += 1
            collection_stats[coll_id]["unique"].add(card["id"])
        
        # Convert sets to counts for JSON serialization
        for coll_id in collection_stats:
            collection_stats[coll_id]["unique"] = len(collection_stats[coll_id]["unique"])
        
        return {
            "user_id": user_id,
            "collected_cards": collected_cards,
            "total_packs_opened": collection.get("total_packs_opened", 0),
            "unique_cards": unique_cards,
            "total_cards": len(collected_cards),
            "rarity_counts": rarity_counts,
            "collection_stats": collection_stats
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

@app.get("/api/pack-probabilities")
async def get_pack_probabilities():
    return {
        "probabilities": RARITY_PROBABILITIES,
        "cards_per_pack": CARDS_PER_PACK
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
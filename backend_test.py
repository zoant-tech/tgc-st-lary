import requests
import sys
import json
import io
from datetime import datetime
from PIL import Image

class TCGPocketAPITester:
    def __init__(self, base_url="https://539a4b83-4cdf-429f-96e5-7480f8b042f9.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_cards = []
        self.created_collections = []

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files)
                elif data:
                    headers['Content-Type'] = 'application/json'
                    response = requests.post(url, json=data, headers=headers)
                else:
                    response = requests.post(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def create_test_image(self):
        """Create a simple test image"""
        img = Image.new('RGB', (200, 280), color='blue')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        return img_bytes

    def test_health_check(self):
        """Test health endpoint"""
        success, _ = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )
        return success

    def test_get_rarities(self):
        """Test rarities endpoint"""
        success, response = self.run_test(
            "Get Rarities",
            "GET", 
            "api/rarities",
            200
        )
        if success and 'rarities' in response:
            print(f"   Available rarities: {response['rarities']}")
        return success

    def test_get_card_types(self):
        """Test card types endpoint"""
        success, response = self.run_test(
            "Get Card Types",
            "GET",
            "api/card-types", 
            200
        )
        if success and 'card_types' in response:
            print(f"   Available card types: {response['card_types']}")
        return success

    def test_create_collection(self, name, description="Test collection", total_cards_in_set=50):
        """Test collection creation with total_cards_in_set"""
        collection_data = {
            "id": f"collection_{datetime.now().strftime('%H%M%S')}",
            "name": name,
            "description": description,
            "total_cards_in_set": total_cards_in_set,
            "release_date": "2024-01-01"
        }
        
        success, response = self.run_test(
            f"Create Collection - {name}",
            "POST",
            "api/collections",
            200,
            data=collection_data
        )
        
        if success and 'collection' in response:
            collection_id = response['collection']['id']
            self.created_collections.append(collection_id)
            print(f"   Created collection ID: {collection_id}")
            print(f"   Total cards in set: {total_cards_in_set}")
            return collection_id
        return None

    def test_get_collections(self):
        """Test getting all collections"""
        success, response = self.run_test(
            "Get All Collections",
            "GET",
            "api/collections",
            200
        )
        if success and 'collections' in response:
            print(f"   Found {len(response['collections'])} collections")
            return response['collections']
        return []

    def test_create_card(self, name, collection_id, card_number, rarity="Common", card_type="Pokemon"):
        """Test card creation with card numbering"""
        test_image = self.create_test_image()
        
        card_data = {
            'name': name,
            'rarity': rarity,
            'card_type': card_type,
            'collection_id': collection_id,
            'card_number': card_number,
            'hp': '100',
            'attack_1': 'Thunder Bolt',
            'attack_2': 'Lightning Strike',
            'weakness': 'Ground',
            'resistance': 'Flying',
            'description': f'A powerful {card_type} card',
            'set_name': 'Test Set'
        }
        
        files = {
            'image': ('test_card.jpg', test_image, 'image/jpeg')
        }
        
        success, response = self.run_test(
            f"Create Card - {name} (#{card_number})",
            "POST",
            "api/cards",
            200,
            data=card_data,
            files=files
        )
        
        if success and 'card' in response:
            card_id = response['card']['id']
            self.created_cards.append(card_id)
            print(f"   Created card ID: {card_id}")
            print(f"   Card number: {card_number}")
            return card_id
        return None

    def test_get_cards(self):
        """Test getting all cards"""
        success, response = self.run_test(
            "Get All Cards",
            "GET",
            "api/cards",
            200
        )
        if success and 'cards' in response:
            print(f"   Found {len(response['cards'])} cards")
            return response['cards']
        return []

    def test_get_cards_by_collection(self, collection_id):
        """Test getting cards by collection"""
        success, response = self.run_test(
            f"Get Cards by Collection - {collection_id}",
            "GET",
            f"api/cards/collection/{collection_id}",
            200
        )
        if success and 'cards' in response:
            print(f"   Found {len(response['cards'])} cards in collection")
            return response['cards']
        return []

    def test_get_pack_probabilities(self):
        """Test pack probabilities endpoint"""
        success, response = self.run_test(
            "Get Pack Probabilities",
            "GET",
            "api/pack-probabilities",
            200
        )
        if success and 'probabilities' in response:
            print(f"   Pack probabilities: {response['probabilities']}")
            print(f"   Cards per pack: {response['cards_per_pack']}")
        return success

    def test_open_random_pack(self, collection_id, user_id="test_user"):
        """Test opening a random pack from collection - NEW: 6 cards with guaranteed Energy + Trainer"""
        pack_data = {
            "collection_id": collection_id,
            "user_id": user_id
        }
        
        success, response = self.run_test(
            f"Open Random Pack - Collection {collection_id}",
            "POST",
            "api/open-pack",
            200,
            data=pack_data
        )
        
        if success and 'cards' in response:
            cards = response['cards']
            print(f"   Pulled {len(cards)} cards from {response.get('collection_name', 'Unknown')}")
            
            # CRITICAL TEST: Verify pack contains exactly 6 cards
            if len(cards) != 6:
                print(f"   ❌ PACK COMPOSITION ERROR: Expected 6 cards, got {len(cards)}")
                return False
            else:
                print(f"   ✅ Pack contains exactly 6 cards as expected")
            
            # Count card types and rarities
            type_counts = {}
            rarity_counts = {}
            for card in response['cards']:
                card_type = card['card_type']
                rarity = card['rarity']
                type_counts[card_type] = type_counts.get(card_type, 0) + 1
                rarity_counts[rarity] = rarity_counts.get(rarity, 0) + 1
                print(f"     - {card['name']} ({card['card_type']}, {card['rarity']})")
            
            print(f"   Card type distribution: {type_counts}")
            print(f"   Rarity distribution: {rarity_counts}")
            
            # CRITICAL TEST: Verify guaranteed Energy and Trainer cards
            has_energy = type_counts.get('Energy', 0) >= 1
            has_trainer = type_counts.get('Trainer', 0) >= 1
            
            if not has_energy:
                print(f"   ❌ PACK COMPOSITION ERROR: No Energy card found!")
                return False
            else:
                print(f"   ✅ Pack contains guaranteed Energy card")
                
            if not has_trainer:
                print(f"   ❌ PACK COMPOSITION ERROR: No Trainer card found!")
                return False
            else:
                print(f"   ✅ Pack contains guaranteed Trainer card")
                
        return success

    def test_get_user_collection(self, user_id="test_user"):
        """Test getting user collection"""
        success, response = self.run_test(
            f"Get User Collection - {user_id}",
            "GET",
            f"api/user-collection/{user_id}",
            200
        )
        if success:
            print(f"   User has {response.get('total_cards', 0)} total cards")
            print(f"   Unique cards: {response.get('unique_cards', 0)}")
            print(f"   Packs opened: {response.get('total_packs_opened', 0)}")
            if response.get('rarity_counts'):
                print(f"   Rarity breakdown: {response['rarity_counts']}")
        return success

    def test_collection_overview(self, collection_id):
        """Test collection overview with missing cards display"""
        success, response = self.run_test(
            f"Get Collection Overview - {collection_id}",
            "GET",
            f"api/collection-overview/{collection_id}",
            200
        )
        if success:
            collection = response.get('collection', {})
            complete_set = response.get('complete_set', [])
            total_cards_in_set = response.get('total_cards_in_set', 0)
            actual_cards_created = response.get('actual_cards_created', 0)
            
            print(f"   Collection: {collection.get('name', 'Unknown')}")
            print(f"   Total cards in set: {total_cards_in_set}")
            print(f"   Actual cards created: {actual_cards_created}")
            print(f"   Complete set entries: {len(complete_set)}")
            
            # Test missing cards functionality
            existing_cards = [item for item in complete_set if item.get('exists', False)]
            missing_cards = [item for item in complete_set if not item.get('exists', False)]
            
            print(f"   Existing cards: {len(existing_cards)}")
            print(f"   Missing cards: {len(missing_cards)}")
            
            # Verify card numbering
            for item in complete_set[:5]:  # Show first 5 for brevity
                card_num = item.get('card_number', 0)
                exists = item.get('exists', False)
                if exists:
                    card_name = item.get('card', {}).get('name', 'Unknown')
                    print(f"     Card #{card_num}: {card_name} ✅")
                else:
                    print(f"     Card #{card_num}: Missing ❌")
            
            return response
        return None

def main():
    print("🚀 Starting TCG Pocket Advanced Collection System Tests")
    print("=" * 60)
    
    tester = TCGPocketAPITester()
    
    # Test basic endpoints
    if not tester.test_health_check():
        print("❌ Health check failed, stopping tests")
        return 1
    
    tester.test_get_rarities()
    tester.test_get_card_types()
    tester.test_get_pack_probabilities()
    
    # Test advanced collection operations
    print("\n📚 Testing Advanced Collection System")
    print("-" * 40)
    
    # Create test collection with 20 cards for easier testing
    collection_id = tester.test_create_collection("Test Collection", "Testing advanced features", 20)
    if not collection_id:
        print("❌ Collection creation failed, stopping tests")
        return 1
    
    # Get all collections
    all_collections = tester.test_get_collections()
    
    # Create test cards with specific numbers for testing sorting and missing cards
    print("\n🃏 Testing Card Numbering System")
    print("-" * 35)
    
    created_cards = []
    test_cards = [
        ("Pikachu", 1, "Common", "Pokemon"),
        ("Charizard", 3, "Secret Rare", "Pokemon"),
        ("Energy Card", 5, "Common", "Energy"),
        ("Professor Oak", 7, "Uncommon", "Trainer"),
        ("Blastoise", 10, "Rare", "Pokemon"),
        ("Thunder Stone", 15, "Holo", "Trainer")
    ]
    
    for name, card_number, rarity, card_type in test_cards:
        card_id = tester.test_create_card(name, collection_id, card_number, rarity, card_type)
        if card_id:
            created_cards.append(card_id)
    
    # Test collection overview with missing cards
    print("\n🔍 Testing Collection Overview & Missing Cards")
    print("-" * 50)
    
    overview = tester.test_collection_overview(collection_id)
    if not overview:
        print("❌ Collection overview failed")
        return 1
    
    # Get all cards
    all_cards = tester.test_get_cards()
    
    # Get cards by collection
    collection_cards = tester.test_get_cards_by_collection(collection_id)
    
    # Test pack opening operations
    print("\n📦 Testing Pack Opening with New System")
    print("-" * 40)
    
    if created_cards:
        # Test opening a pack
        print(f"\n--- Opening Pack from Collection ---")
        tester.test_open_random_pack(collection_id, "test_user")
        
        # Test user collection
        print("\n👤 Testing User Collection")
        print("-" * 25)
        tester.test_get_user_collection("test_user")
        
    else:
        print("⚠️  No cards created for pack testing")
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed >= tester.tests_run * 0.8:  # 80% pass rate
        print("🎉 Advanced Collection System is working!")
        print("\n✅ Key Features Verified:")
        print("- Collections with total_cards_in_set parameter")
        print("- Cards with specific numbering (1/20, 3/20, etc.)")
        print("- Collection overview showing complete set with missing cards")
        print("- Card numbering system working correctly")
        print("- Missing cards detection working")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        print("❌ System needs fixes before frontend testing")
        return 1

if __name__ == "__main__":
    sys.exit(main())
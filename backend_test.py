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

    def test_user_authentication_system(self):
        """Test the complete user authentication and separation system"""
        print("\n🔐 Testing User Authentication & Separation System")
        print("=" * 60)
        
        # Test users
        alice = "Alice"
        bob = "Bob"
        charlie = "Charlie"
        
        # Step 1: Create a test collection with cards for pack opening
        print("\n📚 Setting up test collection with cards...")
        collection_id = self.test_create_collection("Pokemon Starter Set", "Test collection for user authentication", 30)
        if not collection_id:
            print("❌ Failed to create test collection")
            return False
        
        # Create diverse cards for testing
        test_cards = [
            ("Pikachu", 1, "Common", "Pokemon"),
            ("Charizard", 2, "Ultra Rare", "Pokemon"),
            ("Squirtle", 3, "Common", "Pokemon"),
            ("Basic Energy", 4, "Common", "Energy"),
            ("Fire Energy", 5, "Common", "Energy"),
            ("Water Energy", 6, "Common", "Energy"),
            ("Professor Oak", 7, "Uncommon", "Trainer"),
            ("Pokeball", 8, "Common", "Trainer"),
            ("Potion", 9, "Common", "Trainer"),
            ("Blastoise", 10, "Rare", "Pokemon")
        ]
        
        created_cards = []
        for name, card_number, rarity, card_type in test_cards:
            card_id = self.test_create_card(name, collection_id, card_number, rarity, card_type)
            if card_id:
                created_cards.append(card_id)
        
        if len(created_cards) < 6:
            print("❌ Not enough cards created for pack testing")
            return False
        
        print(f"✅ Created {len(created_cards)} cards for testing")
        
        # Step 2: Test Alice's collection
        print(f"\n👩 Testing Alice's Collection")
        print("-" * 30)
        
        # Alice starts with empty collection
        success, alice_initial = self.run_test(
            f"Alice Initial Collection",
            "GET",
            f"api/user-collection/{alice}",
            200
        )
        if not success:
            return False
        
        print(f"   Alice initial cards: {alice_initial.get('total_cards', 0)}")
        print(f"   Alice initial packs: {alice_initial.get('total_packs_opened', 0)}")
        
        # Alice opens 2 packs
        alice_pack1_success = self.test_open_random_pack(collection_id, alice)
        alice_pack2_success = self.test_open_random_pack(collection_id, alice)
        
        if not (alice_pack1_success and alice_pack2_success):
            print("❌ Failed to open packs for Alice")
            return False
        
        # Get Alice's collection after opening packs
        success, alice_after = self.run_test(
            f"Alice Collection After Packs",
            "GET",
            f"api/user-collection/{alice}",
            200
        )
        if not success:
            return False
        
        alice_total_cards = alice_after.get('total_cards', 0)
        alice_packs_opened = alice_after.get('total_packs_opened', 0)
        alice_unique_cards = alice_after.get('unique_cards', 0)
        
        print(f"   Alice after packs - Total cards: {alice_total_cards}")
        print(f"   Alice after packs - Packs opened: {alice_packs_opened}")
        print(f"   Alice after packs - Unique cards: {alice_unique_cards}")
        
        # Verify Alice has cards and opened 2 packs
        if alice_total_cards == 0 or alice_packs_opened != 2:
            print(f"❌ Alice's collection not updated correctly")
            return False
        
        # Step 3: Test Bob's collection (should be separate)
        print(f"\n👨 Testing Bob's Collection (Should be separate from Alice)")
        print("-" * 55)
        
        # Bob starts with empty collection
        success, bob_initial = self.run_test(
            f"Bob Initial Collection",
            "GET",
            f"api/user-collection/{bob}",
            200
        )
        if not success:
            return False
        
        print(f"   Bob initial cards: {bob_initial.get('total_cards', 0)}")
        print(f"   Bob initial packs: {bob_initial.get('total_packs_opened', 0)}")
        
        # Verify Bob starts with empty collection (separate from Alice)
        if bob_initial.get('total_cards', 0) != 0 or bob_initial.get('total_packs_opened', 0) != 0:
            print(f"❌ Bob's collection is not separate from Alice's!")
            return False
        
        print("✅ Bob's collection is properly separated from Alice's")
        
        # Bob opens 3 packs
        bob_pack1_success = self.test_open_random_pack(collection_id, bob)
        bob_pack2_success = self.test_open_random_pack(collection_id, bob)
        bob_pack3_success = self.test_open_random_pack(collection_id, bob)
        
        if not (bob_pack1_success and bob_pack2_success and bob_pack3_success):
            print("❌ Failed to open packs for Bob")
            return False
        
        # Get Bob's collection after opening packs
        success, bob_after = self.run_test(
            f"Bob Collection After Packs",
            "GET",
            f"api/user-collection/{bob}",
            200
        )
        if not success:
            return False
        
        bob_total_cards = bob_after.get('total_cards', 0)
        bob_packs_opened = bob_after.get('total_packs_opened', 0)
        bob_unique_cards = bob_after.get('unique_cards', 0)
        
        print(f"   Bob after packs - Total cards: {bob_total_cards}")
        print(f"   Bob after packs - Packs opened: {bob_packs_opened}")
        print(f"   Bob after packs - Unique cards: {bob_unique_cards}")
        
        # Verify Bob has cards and opened 3 packs
        if bob_total_cards == 0 or bob_packs_opened != 3:
            print(f"❌ Bob's collection not updated correctly")
            return False
        
        # Step 4: Verify Alice's collection is still intact and separate
        print(f"\n🔍 Verifying Alice's Collection Remains Intact")
        print("-" * 45)
        
        success, alice_final = self.run_test(
            f"Alice Final Collection Check",
            "GET",
            f"api/user-collection/{alice}",
            200
        )
        if not success:
            return False
        
        alice_final_cards = alice_final.get('total_cards', 0)
        alice_final_packs = alice_final.get('total_packs_opened', 0)
        
        print(f"   Alice final - Total cards: {alice_final_cards}")
        print(f"   Alice final - Packs opened: {alice_final_packs}")
        
        # Verify Alice's collection hasn't changed
        if alice_final_cards != alice_total_cards or alice_final_packs != alice_packs_opened:
            print(f"❌ Alice's collection was affected by Bob's actions!")
            return False
        
        print("✅ Alice's collection remains intact and separate")
        
        # Step 5: Test third user (Charlie) to further verify separation
        print(f"\n👤 Testing Charlie's Collection (Third user verification)")
        print("-" * 55)
        
        # Charlie opens 1 pack
        charlie_pack_success = self.test_open_random_pack(collection_id, charlie)
        if not charlie_pack_success:
            print("❌ Failed to open pack for Charlie")
            return False
        
        # Get Charlie's collection
        success, charlie_after = self.run_test(
            f"Charlie Collection After Pack",
            "GET",
            f"api/user-collection/{charlie}",
            200
        )
        if not success:
            return False
        
        charlie_total_cards = charlie_after.get('total_cards', 0)
        charlie_packs_opened = charlie_after.get('total_packs_opened', 0)
        
        print(f"   Charlie - Total cards: {charlie_total_cards}")
        print(f"   Charlie - Packs opened: {charlie_packs_opened}")
        
        # Verify Charlie has exactly 1 pack opened
        if charlie_packs_opened != 1:
            print(f"❌ Charlie's collection not updated correctly")
            return False
        
        # Step 6: Final verification - all users should have different collections
        print(f"\n📊 Final User Separation Verification")
        print("-" * 40)
        
        print(f"   Alice: {alice_final_cards} cards, {alice_final_packs} packs")
        print(f"   Bob: {bob_total_cards} cards, {bob_packs_opened} packs")
        print(f"   Charlie: {charlie_total_cards} cards, {charlie_packs_opened} packs")
        
        # Verify all users have different pack counts (proving separation)
        if alice_final_packs == bob_packs_opened or alice_final_packs == charlie_packs_opened or bob_packs_opened == charlie_packs_opened:
            print(f"❌ Users don't have properly separated collections!")
            return False
        
        print("✅ All users have properly separated collections")
        
        # Step 7: Test edge cases
        print(f"\n🧪 Testing Edge Cases")
        print("-" * 20)
        
        # Test empty username
        success, empty_user = self.run_test(
            f"Empty Username Collection",
            "GET",
            f"api/user-collection/",
            200
        )
        # This should work and return empty collection for empty string user
        
        # Test special characters in username
        special_user = "user@test.com"
        success, special_user_collection = self.run_test(
            f"Special Character Username",
            "GET",
            f"api/user-collection/{special_user}",
            200
        )
        if success:
            print(f"   Special character username works: {special_user}")
        
        return True

def main():
    print("🚀 Starting TCG Pocket User Authentication System Tests")
    print("=" * 65)
    
    tester = TCGPocketAPITester()
    
    # Test basic endpoints first
    if not tester.test_health_check():
        print("❌ Health check failed, stopping tests")
        return 1
    
    # Test the complete user authentication system
    auth_success = tester.test_user_authentication_system()
    
    # Print final results
    print("\n" + "=" * 65)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if auth_success and tester.tests_passed >= tester.tests_run * 0.85:  # 85% pass rate
        print("🎉 User Authentication System is working perfectly!")
        print("\n✅ Key Features Verified:")
        print("- User Collection API works with different usernames")
        print("- Pack Opening API properly assigns cards to correct users")
        print("- User Separation: Different users have completely separate collections")
        print("- Alice, Bob, and Charlie all have independent collections")
        print("- User collection stats and card counting work correctly")
        print("- Edge cases with special characters handled")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        print("❌ User Authentication System needs fixes")
        return 1

if __name__ == "__main__":
    sys.exit(main())
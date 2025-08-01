import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Switch } from './components/ui/switch';
import { PlusCircle, Package, Sparkles, Star, Zap, Crown, Diamond, Settings, Trophy, Home, Gift, Archive, Dice6, Trash2, X, SortAsc, Eye, EyeOff, User, LogOut } from 'lucide-react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Rarity configurations with icons and colors
const RARITY_CONFIG = {
  'Common': { icon: <div className="w-4 h-4 rounded-full bg-gray-400"></div>, color: 'bg-gray-100 text-gray-800', glow: 'shadow-gray-200', sortOrder: 1 },
  'Uncommon': { icon: <Star className="w-4 h-4 text-green-500" />, color: 'bg-green-100 text-green-800', glow: 'shadow-green-200', sortOrder: 2 },
  'Rare': { icon: <Sparkles className="w-4 h-4 text-blue-500" />, color: 'bg-blue-100 text-blue-800', glow: 'shadow-blue-200', sortOrder: 3 },
  'Holo': { icon: <Zap className="w-4 h-4 text-purple-500" />, color: 'bg-purple-100 text-purple-800', glow: 'shadow-purple-200', sortOrder: 4 },
  'Ultra Rare': { icon: <Crown className="w-4 h-4 text-yellow-500" />, color: 'bg-yellow-100 text-yellow-800', glow: 'shadow-yellow-200', sortOrder: 5 },
  'Secret Rare': { icon: <Diamond className="w-4 h-4 text-pink-500" />, color: 'bg-pink-100 text-pink-800', glow: 'shadow-pink-200', sortOrder: 6 }
};

// Welcome Modal Component (defined outside main component to prevent re-renders)
const WelcomeModal = ({ tempUsername, onTempUsernameChange, handleWelcomeSubmit }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl max-w-md w-full p-6">
      <div className="text-center mb-6">
        <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Gift className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Welcome to TCG Pocket!
        </h2>
        <p className="text-gray-600">
          Enter your name to start collecting cards and opening packs!
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="username">Your Name</Label>
          <Input
            id="username"
            placeholder="Enter your name..."
            value={tempUsername}
            onChange={(e) => onTempUsernameChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleWelcomeSubmit()}
            className="mt-1"
            autoFocus
          />
        </div>
        
        <Button 
          onClick={handleWelcomeSubmit}
          disabled={!tempUsername.trim()}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
        >
          Start Collecting!
        </Button>
      </div>
      
      <div className="mt-4 text-xs text-gray-500 text-center">
        Your collection will be saved and you can return anytime with the same name.
      </div>
    </div>
  </div>
);

function App() {
  // User authentication state
  const [currentUser, setCurrentUser] = useState('');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [cards, setCards] = useState([]);
  const [collections, setCollections] = useState([]);
  const [userCollection, setUserCollection] = useState({});
  const [pulledCards, setPulledCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('welcome');
  const [showPackAnimation, setShowPackAnimation] = useState(false);
  const [animatingCards, setAnimatingCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  
  // Collection sorting and filtering states
  const [sortBy, setSortBy] = useState('number'); // 'number', 'name', 'rarity'
  const [showMissingCards, setShowMissingCards] = useState(true);
  const [collectionOverview, setCollectionOverview] = useState(null);

  // Collection creation form state
  const [collectionForm, setCollectionForm] = useState({
    name: '',
    description: '',
    total_cards_in_set: 50,
    release_date: ''
  });

  // Card creation form state
  const [cardForm, setCardForm] = useState({
    name: '',
    rarity: 'Common',
    card_type: 'Pokemon',
    collection_id: '',
    card_number: 1,
    hp: '',
    attack_1: '',
    attack_2: '',
    weakness: '',
    resistance: '',
    description: '',
    set_name: '',
    image: null,
    imageUrl: ''
  });

  useEffect(() => {
    // Check for existing user on app load
    const savedUsername = localStorage.getItem('tcg-username');
    if (savedUsername) {
      setCurrentUser(savedUsername);
    } else {
      setShowWelcomeModal(true);
    }
  }, []);

  useEffect(() => {
    // Only fetch data if user is logged in
    if (currentUser) {
      fetchCards();
      fetchCollections();
      if (!isAdminMode) {
        fetchUserCollection();
      }
    }
  }, [isAdminMode, currentUser]);

  useEffect(() => {
    // Reset to appropriate tab when switching modes
    if (isAdminMode) {
      setActiveTab('create-collection');
    } else {
      setActiveTab('welcome');
    }
  }, [isAdminMode]);

  useEffect(() => {
    // Fetch collection overview when user has cards
    if (userCollection.collected_cards && userCollection.collected_cards.length > 0) {
      fetchCollectionOverview();
    }
  }, [userCollection]);

  const fetchCards = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/cards`);
      const data = await response.json();
      setCards(data.cards || []);
    } catch (error) {
      console.error('Error fetching cards:', error);
    }
  };

  const fetchCollections = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/collections`);
      const data = await response.json();
      setCollections(data.collections || []);
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  };

  const handleWelcomeSubmit = () => {
    if (tempUsername.trim()) {
      const username = tempUsername.trim();
      setCurrentUser(username);
      localStorage.setItem('tcg-username', username);
      setShowWelcomeModal(false);
      setTempUsername('');
    }
  };

  const handleLogout = () => {
    setCurrentUser('');
    localStorage.removeItem('tcg-username');
    setUserCollection({});
    setPulledCards([]);
    setShowWelcomeModal(true);
    setActiveTab('welcome');
  };

  // Optimized form handlers to prevent input focus loss
  const handleCollectionFormChange = useCallback((field, value) => {
    setCollectionForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCardFormChange = useCallback((field, value) => {
    setCardForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleTempUsernameChange = useCallback((value) => {
    setTempUsername(value);
  }, []);

  const fetchUserCollection = async () => {
    if (!currentUser) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/user-collection/${currentUser}`);
      const data = await response.json();
      setUserCollection(data);
    } catch (error) {
      console.error('Error fetching user collection:', error);
    }
  };

  const fetchCollectionOverview = async () => {
    try {
      // Get the first collection ID from user's cards (for demo purposes)
      if (userCollection.collected_cards && userCollection.collected_cards.length > 0) {
        const firstCard = userCollection.collected_cards[0];
        const collectionId = firstCard.collection_id;
        
        const response = await fetch(`${BACKEND_URL}/api/collection-overview/${collectionId}`);
        const data = await response.json();
        setCollectionOverview(data);
      }
    } catch (error) {
      console.error('Error fetching collection overview:', error);
    }
  };

  const handleCollectionSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const collectionData = {
        id: Date.now().toString(),
        name: collectionForm.name,
        description: collectionForm.description,
        total_cards_in_set: parseInt(collectionForm.total_cards_in_set),
        release_date: collectionForm.release_date
      };

      const response = await fetch(`${BACKEND_URL}/api/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(collectionData)
      });

      if (response.ok) {
        setCollectionForm({
          name: '',
          description: '',
          total_cards_in_set: 50,
          release_date: ''
        });
        fetchCollections();
        alert('Collection created successfully!');
      } else {
        alert('Error creating collection');
      }
    } catch (error) {
      console.error('Error creating collection:', error);
      alert('Error creating collection');
    } finally {
      setLoading(false);
    }
  };

  const handleCardSubmit = async (e) => {
    e.preventDefault();
    if (!cardForm.image && !cardForm.imageUrl) {
      alert('Please select an image file or provide an image URL');
      return;
    }
    if (!cardForm.collection_id) {
      alert('Please select a collection for the card');
      return;
    }

    setLoading(true);
    try {
      if (cardForm.imageUrl) {
        // Handle URL-based image submission
        const cardData = {
          name: cardForm.name,
          rarity: cardForm.rarity,
          card_type: cardForm.card_type,
          collection_id: cardForm.collection_id,
          card_number: cardForm.card_number,
          hp: cardForm.hp || null,
          attack_1: cardForm.attack_1 || null,
          attack_2: cardForm.attack_2 || null,
          weakness: cardForm.weakness || null,
          resistance: cardForm.resistance || null,
          description: cardForm.description || null,
          set_name: cardForm.set_name || null,
          image_url: cardForm.imageUrl
        };

        const response = await fetch(`${BACKEND_URL}/api/cards-from-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(cardData)
        });

        if (response.ok) {
          resetCardForm();
          fetchCards();
          fetchCollections();
          alert('Card created successfully using image URL!');
        } else {
          const errorData = await response.json();
          alert('Error creating card: ' + (errorData.detail || 'Unknown error'));
        }
      } else {
        // Handle file upload submission
        const formData = new FormData();
        Object.keys(cardForm).forEach(key => {
          if (cardForm[key] !== null && cardForm[key] !== '' && key !== 'imageUrl') {
            formData.append(key, cardForm[key]);
          }
        });

        const response = await fetch(`${BACKEND_URL}/api/cards`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          resetCardForm();
          fetchCards();
          fetchCollections();
          alert('Card created successfully!');
        } else {
          const errorData = await response.json();
          alert('Error creating card: ' + (errorData.detail || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error('Error creating card:', error);
      alert('Error creating card');
    } finally {
      setLoading(false);
    }
  };

  const resetCardForm = () => {
    setCardForm({
      name: '',
      rarity: 'Common',
      card_type: 'Pokemon',
      collection_id: '',
      card_number: 1,
      hp: '',
      attack_1: '',
      attack_2: '',
      weakness: '',
      resistance: '',
      description: '',
      set_name: '',
      image: null,
      imageUrl: ''
    });
  };

  const handleDeleteCollection = async (collectionId, collectionName) => {
    if (!confirm(`Are you sure you want to delete the collection "${collectionName}"? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/collections/${collectionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchCollections();
        alert('Collection deleted successfully!');
      } else {
        const errorData = await response.json();
        alert('Error deleting collection: ' + (errorData.detail || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting collection:', error);
      alert('Error deleting collection');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCard = async (cardId, cardName) => {
    if (!confirm(`Are you sure you want to delete the card "${cardName}"? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/cards/${cardId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchCards();
        fetchCollections(); // Refresh to update card counts
        alert('Card deleted successfully!');
      } else {
        const errorData = await response.json();
        alert('Error deleting card: ' + (errorData.detail || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting card:', error);
      alert('Error deleting card');
    } finally {
      setLoading(false);
    }
  };

  const openRandomPack = async (collectionId) => {
    if (!currentUser) return;
    
    console.log('Opening random pack from collection:', collectionId);
    setLoading(true);
    setShowPackAnimation(true);
    setPulledCards([]);
    
    try {
      console.log('Making API request to:', `${BACKEND_URL}/api/open-pack`);
      const response = await fetch(`${BACKEND_URL}/api/open-pack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ collection_id: collectionId, user_id: currentUser })
      });

      console.log('API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Pack opened successfully, received cards:', data.cards);
        
        // Simulate pack opening animation
        setTimeout(() => {
          setAnimatingCards(data.cards);
          setTimeout(() => {
            setPulledCards(data.cards);
            setShowPackAnimation(false);
            setAnimatingCards([]);
            // Refresh user collection
            fetchUserCollection();
          }, 1500);
        }, 1000);
      } else {
        const errorData = await response.json();
        console.error('Pack opening failed:', errorData);
        alert('Error opening pack: ' + (errorData.detail || 'Unknown error'));
        setShowPackAnimation(false);
      }
    } catch (error) {
      console.error('Error opening pack:', error);
      alert('Error opening pack: ' + error.message);
      setShowPackAnimation(false);
    } finally {
      setLoading(false);
    }
  };

  const sortCards = (cards) => {
    const sortedCards = [...cards];
    
    switch (sortBy) {
      case 'name':
        return sortedCards.sort((a, b) => {
          const nameA = a.card?.name || `Missing Card ${a.card_number}`;
          const nameB = b.card?.name || `Missing Card ${b.card_number}`;
          return nameA.localeCompare(nameB);
        });
      case 'rarity':
        return sortedCards.sort((a, b) => {
          const rarityA = RARITY_CONFIG[a.card?.rarity]?.sortOrder || 0;
          const rarityB = RARITY_CONFIG[b.card?.rarity]?.sortOrder || 0;
          return rarityB - rarityA; // Higher rarity first
        });
      case 'number':
      default:
        return sortedCards.sort((a, b) => a.card_number - b.card_number);
    }
  };

  const getDisplayCards = () => {
    if (!userCollection.collected_cards || userCollection.collected_cards.length === 0) {
      return [];
    }

    // If we don't have collection overview yet, show basic grouped cards
    if (!collectionOverview || !collectionOverview.complete_set) {
      const cardGroups = {};
      userCollection.collected_cards.forEach(card => {
        if (card && card.id) {
          if (!cardGroups[card.id]) {
            cardGroups[card.id] = {
              card_number: card.card_number || 0,
              exists: true,
              card: card,
              quantity: 0,
              owned: true
            };
          }
          cardGroups[card.id].quantity++;
        }
      });
      return sortCards(Object.values(cardGroups));
    }

    // Advanced display with collection overview
    let displayCards = [];
    
    if (showMissingCards) {
      // Show complete set with missing cards
      displayCards = collectionOverview.complete_set.map(item => {
        if (item.exists) {
          // Group owned cards by ID and count quantities
          const ownedCards = userCollection.collected_cards?.filter(card => card && card.id === item.card?.id) || [];
          return {
            card_number: item.card_number,
            exists: true,
            card: item.card,
            quantity: ownedCards.length,
            owned: ownedCards.length > 0
          };
        } else {
          return {
            card_number: item.card_number,
            exists: false,
            card: null,
            quantity: 0,
            owned: false
          };
        }
      });
    } else {
      // Show only owned cards
      const cardGroups = {};
      userCollection.collected_cards?.forEach(card => {
        if (card && card.id) {
          if (!cardGroups[card.id]) {
            cardGroups[card.id] = {
              card_number: card.card_number || 0,
              exists: true,
              card: card,
              quantity: 0,
              owned: true
            };
          }
          cardGroups[card.id].quantity++;
        }
      });
      displayCards = Object.values(cardGroups);
    }
    
    return sortCards(displayCards);
  };

  const CardDisplay = ({ card, className = "", onClick }) => {
    const [imageError, setImageError] = useState(false);
    
    // Generate a color based on card rarity
    const getRarityColor = (rarity) => {
      const colors = {
        'Common': '#94a3b8',
        'Uncommon': '#22c55e', 
        'Rare': '#3b82f6',
        'Holo': '#8b5cf6',
        'Ultra Rare': '#eab308',
        'Secret Rare': '#ec4899'
      };
      return colors[rarity] || '#94a3b8';
    };

    // Create a simple card design when image fails to load
    const PlaceholderCard = () => (
      <div 
        className="w-full h-64 flex flex-col items-center justify-center text-white font-bold rounded-lg"
        style={{ backgroundColor: getRarityColor(card.rarity) }}
      >
        <div className="text-center p-4">
          <div className="text-lg mb-2">{card.name}</div>
          <div className="text-sm opacity-80">{card.rarity}</div>
          <div className="text-xs opacity-60 mt-1">{card.card_type}</div>
          {card.card_number && (
            <div className="text-xs opacity-80 mt-2">
              #{card.card_number}
            </div>
          )}
        </div>
      </div>
    );

    return (
      <div 
        className={`relative group cursor-pointer transform transition-all duration-300 hover:scale-105 ${className}`}
        onClick={onClick}
      >
        <div className={`rounded-xl overflow-hidden border-2 ${RARITY_CONFIG[card.rarity]?.glow || 'shadow-gray-200'} shadow-lg hover:shadow-xl transition-all duration-300`}>
          <div className="relative bg-gray-100">
            {imageError || !card.image_url ? (
              <PlaceholderCard />
            ) : (
              <img 
                src={card.image_url} 
                alt={card.name}
                className="w-full h-64 object-contain bg-white"
                onError={() => setImageError(true)}
                onLoad={() => setImageError(false)}
              />
            )}
            <div className="absolute top-2 right-2">
              <Badge className={`${RARITY_CONFIG[card.rarity]?.color || 'bg-gray-100'} flex items-center gap-1`}>
                {RARITY_CONFIG[card.rarity]?.icon}
                {card.rarity}
              </Badge>
            </div>
            {card.card_number && (
              <div className="absolute bottom-2 left-2">
                <Badge className="bg-black bg-opacity-75 text-white text-xs">
                  {card.card_number}/{collectionOverview?.total_cards_in_set || 50}
                </Badge>
              </div>
            )}
          </div>
          <div className="p-3">
            <h3 className="font-bold text-lg mb-1">{card.name}</h3>
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>{card.card_type}</span>
              {card.hp && <span>HP: {card.hp}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Missing Card Display
  const MissingCardDisplay = ({ cardNumber, totalCards, className = "" }) => (
    <div className={`relative group cursor-not-allowed ${className}`}>
      <div className="rounded-xl overflow-hidden border-2 border-dashed border-gray-300 shadow-lg bg-gray-100">
        <div className="relative h-48 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
          <div className="text-center">
            <Package className="w-12 h-12 mx-auto text-gray-400 mb-2" />
            <Badge className="bg-gray-500 text-white">
              {cardNumber}/{totalCards}
            </Badge>
          </div>
        </div>
        <div className="p-3">
          <h3 className="font-bold text-lg mb-1 text-gray-500">Missing Card</h3>
          <div className="text-sm text-gray-400">
            Card #{cardNumber}
          </div>
        </div>
      </div>
    </div>
  );

  // Card Modal for enlarged view
  const CardModal = ({ card, onClose }) => {
    const [imageError, setImageError] = useState(false);
    
    // Generate a color based on card rarity
    const getRarityColor = (rarity) => {
      const colors = {
        'Common': '#94a3b8',
        'Uncommon': '#22c55e', 
        'Rare': '#3b82f6',
        'Holo': '#8b5cf6',
        'Ultra Rare': '#eab308',
        'Secret Rare': '#ec4899'
      };
      return colors[rarity] || '#94a3b8';
    };

    // Create a large placeholder card design when image fails to load
    const LargePlaceholderCard = () => (
      <div 
        className="w-full h-[500px] flex flex-col items-center justify-center text-white font-bold rounded-lg"
        style={{ backgroundColor: getRarityColor(card.rarity) }}
      >
        <div className="text-center p-8">
          <div className="text-4xl mb-4">{card.name}</div>
          <div className="text-xl opacity-80 mb-2">{card.rarity}</div>
          <div className="text-lg opacity-60 mb-4">{card.card_type}</div>
          {card.hp && <div className="text-lg opacity-80 mb-2">HP: {card.hp}</div>}
          {card.card_number && (
            <div className="text-lg opacity-80 mt-4">
              #{card.card_number}/{collectionOverview?.total_cards_in_set || 50}
            </div>
          )}
        </div>
      </div>
    );

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div className="relative max-w-md w-full">
          <button
            onClick={onClose}
            className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow z-10"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
          <div className={`rounded-xl overflow-hidden border-4 ${RARITY_CONFIG[card.rarity]?.glow || 'shadow-gray-200'} shadow-2xl transform transition-all duration-300`}>
            <div className="relative bg-gray-100">
              {imageError || !card.image_url ? (
                <LargePlaceholderCard />
              ) : (
                <img 
                  src={card.image_url} 
                  alt={card.name}
                  className="w-full h-[500px] object-contain bg-white"
                  onError={() => setImageError(true)}
                  onLoad={() => setImageError(false)}
                />
              )}
              <div className="absolute top-4 right-4">
                <Badge className={`${RARITY_CONFIG[card.rarity]?.color || 'bg-gray-100'} flex items-center gap-1 text-lg px-3 py-1`}>
                  {RARITY_CONFIG[card.rarity]?.icon}
                  {card.rarity}
                </Badge>
              </div>
              {card.card_number && (
                <div className="absolute bottom-4 left-4">
                  <Badge className="bg-black bg-opacity-75 text-white text-lg px-3 py-1">
                    {card.card_number}/{collectionOverview?.total_cards_in_set || 50}
                  </Badge>
                </div>
              )}
            </div>
            <div className="p-6 bg-white">
              <h2 className="text-2xl font-bold mb-4">{card.name}</h2>
              
              {/* Card Number - Make it prominent */}
              {card.card_number && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="text-center">
                    <span className="text-sm text-blue-600 font-medium">Card Number</span>
                    <div className="text-2xl font-bold text-blue-700">
                      {card.card_number}/{collectionOverview?.total_cards_in_set || 50}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Type:</span>
                  <span>{card.card_type}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Rarity:</span>
                  <span className="flex items-center gap-1">
                    {RARITY_CONFIG[card.rarity]?.icon}
                    {card.rarity}
                  </span>
                </div>
                {card.hp && (
                  <div className="flex justify-between items-center">
                    <span className="font-medium">HP:</span>
                    <span>{card.hp}</span>
                  </div>
                )}
                {card.attack_1 && (
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Attack 1:</span>
                    <span>{card.attack_1}</span>
                  </div>
                )}
                {card.attack_2 && (
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Attack 2:</span>
                    <span>{card.attack_2}</span>
                  </div>
                )}
                {card.weakness && (
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Weakness:</span>
                    <span>{card.weakness}</span>
                  </div>
                )}
                {card.resistance && (
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Resistance:</span>
                    <span>{card.resistance}</span>
                  </div>
                )}
                {card.description && (
                  <div className="mt-4">
                    <span className="font-medium">Description:</span>
                    <p className="text-gray-600 mt-1">{card.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Admin Interface Tabs
  const AdminTabs = () => (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-3 bg-white rounded-xl p-1 shadow-sm">
        <TabsTrigger value="create-collection" className="rounded-lg">Create Collection</TabsTrigger>
        <TabsTrigger value="create-card" className="rounded-lg">Create Card</TabsTrigger>
        <TabsTrigger value="manage" className="rounded-lg">Manage Content</TabsTrigger>
      </TabsList>

      {/* Create Collection Tab */}
      <TabsContent value="create-collection">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Create New Collection
            </CardTitle>
            <p className="text-sm text-gray-600">
              Collections are like card sets (e.g., "Rubies", "Base Set"). Each collection has a set number of cards (e.g., 50 cards).
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCollectionSubmit} className="space-y-4">
              <div>
                <Label htmlFor="collection-name">Collection Name</Label>
                <Input
                  id="collection-name"
                  placeholder="e.g., Rubies, Crystal Collection, Base Set"
                  value={collectionForm.name}
                  onChange={(e) => handleCollectionFormChange('name', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="collection-description">Description</Label>
                <Input
                  id="collection-description"
                  placeholder="Describe this collection..."
                  value={collectionForm.description}
                  onChange={(e) => handleCollectionFormChange('description', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="total-cards">Total Cards in Set</Label>
                <Input
                  id="total-cards"
                  type="number"
                  min="1"
                  max="500"
                  placeholder="50"
                  value={collectionForm.total_cards_in_set}
                  onChange={(e) => handleCollectionFormChange('total_cards_in_set', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="release-date">Release Date (Optional)</Label>
                <Input
                  id="release-date"
                  type="date"
                  value={collectionForm.release_date}
                  onChange={(e) => handleCollectionFormChange('release_date', e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Creating...' : 'Create Collection'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Create Card Tab */}
      <TabsContent value="create-card">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5" />
              Create New Card
            </CardTitle>
            <p className="text-sm text-gray-600">
              Add cards to your collections. Each card gets a unique number (e.g., 1/50, 2/50, etc.).
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCardSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Card Name</Label>
                  <Input
                    id="name"
                    value={cardForm.name}
                    onChange={(e) => handleCardFormChange('name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="collection">Collection</Label>
                  <Select value={cardForm.collection_id} onValueChange={(value) => handleCardFormChange('collection_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select collection" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map(collection => (
                        <SelectItem key={collection.id} value={collection.id}>
                          {collection.name} ({collection.actual_cards || 0}/{collection.total_cards_in_set})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="card-number">Card Number</Label>
                  <Input
                    id="card-number"
                    type="number"
                    min="1"
                    value={cardForm.card_number}
                    onChange={(e) => handleCardFormChange('card_number', parseInt(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="rarity">Rarity</Label>
                  <Select value={cardForm.rarity} onValueChange={(value) => handleCardFormChange('rarity', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(RARITY_CONFIG).map(rarity => (
                        <SelectItem key={rarity} value={rarity}>
                          <div className="flex items-center gap-2">
                            {RARITY_CONFIG[rarity].icon}
                            {rarity}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="card_type">Card Type</Label>
                  <Select value={cardForm.card_type} onValueChange={(value) => handleCardFormChange('card_type', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pokemon">Pokemon</SelectItem>
                      <SelectItem value="Trainer">Trainer</SelectItem>
                      <SelectItem value="Energy">Energy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hp">HP (Optional)</Label>
                  <Input
                    id="hp"
                    type="number"
                    value={cardForm.hp}
                    onChange={(e) => handleCardFormChange('hp', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="image">Card Image</Label>
                <Tabs defaultValue="file" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="file">Upload File</TabsTrigger>
                    <TabsTrigger value="url">Use Image URL</TabsTrigger>
                  </TabsList>
                  <TabsContent value="file" className="space-y-2">
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        console.log('File selected:', e.target.files[0]);
                        setCardForm({...cardForm, image: e.target.files[0], imageUrl: ''});
                      }}
                    />
                    {cardForm.image && (
                      <div className="text-sm text-green-600">
                        ✅ File selected: {cardForm.image.name} ({Math.round(cardForm.image.size / 1024)} KB)
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      Note: File uploads may not work in preview environments
                    </div>
                  </TabsContent>
                  <TabsContent value="url" className="space-y-2">
                    <Input
                      placeholder="https://example.com/image.jpg"
                      value={cardForm.imageUrl || ''}
                      onChange={(e) => setCardForm({...cardForm, imageUrl: e.target.value, image: null})}
                    />
                    <div className="text-xs text-gray-500">
                      Use any image URL from the web (works in preview environments)
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              <Button type="submit" disabled={loading || !cardForm.collection_id} className="w-full">
                {loading ? 'Creating...' : 'Create Card'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Manage Content Tab */}
      <TabsContent value="manage" className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Collections ({collections.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {collections.map((collection) => (
                  <div key={collection.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Archive className="w-5 h-5 text-blue-500" />
                          <h4 className="font-bold">{collection.name}</h4>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{collection.description}</p>
                        <Badge variant="secondary">
                          {collection.actual_cards || 0}/{collection.total_cards_in_set} cards
                        </Badge>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteCollection(collection.id, collection.name)}
                        disabled={loading}
                        className="ml-4"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {collections.length === 0 && (
                  <p className="text-gray-500 text-center">No collections created yet</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>All Cards ({cards.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {cards.map((card) => {
                  // Generate a color based on card rarity for admin thumbnails
                  const getRarityColor = (rarity) => {
                    const colors = {
                      'Common': '#94a3b8',
                      'Uncommon': '#22c55e', 
                      'Rare': '#3b82f6',
                      'Holo': '#8b5cf6',
                      'Ultra Rare': '#eab308',
                      'Secret Rare': '#ec4899'
                    };
                    return colors[rarity] || '#94a3b8';
                  };

                  return (
                    <div key={card.id} className="flex items-center gap-4 border rounded-lg p-3">
                      <div 
                        className="w-16 h-20 rounded flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: getRarityColor(card.rarity) }}
                      >
                        <div className="text-center">
                          <div className="text-xs">{card.name.substring(0, 8)}</div>
                          <div className="text-xs opacity-75">#{card.card_number}</div>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold">{card.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${RARITY_CONFIG[card.rarity]?.color || 'bg-gray-100'} flex items-center gap-1 text-xs`}>
                            {RARITY_CONFIG[card.rarity]?.icon}
                            {card.rarity}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{card.card_type}</Badge>
                          <Badge variant="outline" className="text-xs">#{card.card_number}</Badge>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteCard(card.id, card.name)}
                        disabled={loading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
                {cards.length === 0 && (
                  <p className="text-gray-500 text-center">No cards created yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );

  // User Interface Tabs
  const UserTabs = () => (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-3 bg-white rounded-xl p-1 shadow-sm">
        <TabsTrigger value="welcome" className="rounded-lg">Welcome</TabsTrigger>
        <TabsTrigger value="open-packs" className="rounded-lg">Open Packs</TabsTrigger>
        <TabsTrigger value="collection" className="rounded-lg">My Collection</TabsTrigger>
      </TabsList>

      {/* Welcome Tab */}
      <TabsContent value="welcome">
        <div className="text-center py-12">
          <div className="max-w-2xl mx-auto">
            <Gift className="w-24 h-24 mx-auto text-blue-500 mb-6" />
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Welcome to TCG Pocket, {currentUser}!
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Choose a collection and open random booster packs. Each pack contains 6 cards: 1 Energy, 1 Trainer, and 4 random cards with varying rarities!
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="p-6 text-center">
                  <Dice6 className="w-12 h-12 mx-auto text-blue-500 mb-4" />
                  <h3 className="font-bold mb-2">6-Card Packs</h3>
                  <p className="text-sm text-gray-600">Each pack guarantees 1 Energy + 1 Trainer + 4 random cards!</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <Trophy className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
                  <h3 className="font-bold mb-2">Collect & Sort</h3>
                  <p className="text-sm text-gray-600">Build your collection and sort by number, name, or rarity</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <Archive className="w-12 h-12 mx-auto text-purple-500 mb-4" />
                  <h3 className="font-bold mb-2">Complete Sets</h3>
                  <p className="text-sm text-gray-600">Track missing cards and complete entire collections</p>
                </CardContent>
              </Card>
            </div>

            {userCollection.total_packs_opened > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
                <h3 className="text-2xl font-bold mb-4">Your Collection Stats</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{userCollection.total_packs_opened}</div>
                    <div className="text-sm text-gray-600">Packs Opened</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">{userCollection.total_cards || 0}</div>
                    <div className="text-sm text-gray-600">Total Cards</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{userCollection.unique_cards || 0}</div>
                    <div className="text-sm text-gray-600">Unique Cards</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">
                      {userCollection.rarity_counts && Object.keys(userCollection.rarity_counts).length}
                    </div>
                    <div className="text-sm text-gray-600">Rarities</div>
                  </div>
                </div>
              </div>
            )}

            <Button 
              onClick={() => setActiveTab('open-packs')} 
              size="lg" 
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              Start Opening Packs!
            </Button>
          </div>
        </div>
      </TabsContent>

      {/* Open Packs Tab */}
      <TabsContent value="open-packs" className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Choose a Collection</h2>
          <p className="text-gray-600">Each pack contains 6 cards: 1 Energy + 1 Trainer + 4 random cards</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((collection) => (
            <Card key={collection.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Archive className="w-5 h-5" />
                      {collection.name}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{collection.description}</p>
                  </div>
                  <Badge>{collection.actual_cards || 0}/{collection.total_cards_in_set} cards</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Pack Contents:</p>
                    <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                      <Badge variant="outline" className="text-green-600">1x Energy ⚡</Badge>
                      <Badge variant="outline" className="text-blue-600">1x Trainer 👤</Badge>
                    </div>
                    <p className="text-sm font-medium mb-2">Random Card Chances:</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <Badge variant="outline">65% Common</Badge>
                      <Badge variant="outline">20% Uncommon</Badge>
                      <Badge variant="outline">10% Rare</Badge>
                      <Badge variant="outline">3% Holo</Badge>
                      <Badge variant="outline">1.5% Ultra Rare</Badge>
                      <Badge variant="outline">0.5% Secret Rare</Badge>
                    </div>
                  </div>
                  <Button 
                    onClick={() => openRandomPack(collection.id)} 
                    disabled={loading || collection.actual_cards === 0}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    {loading ? 'Opening...' : (
                      <span className="flex items-center gap-2">
                        <Dice6 className="w-4 h-4" />
                        Open Random Pack (6 cards)
                      </span>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recently Pulled Cards */}
        {pulledCards.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              Cards You Got! (Lucky Pull!)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {pulledCards.map((card, index) => (
                <CardDisplay key={index} card={card} className="card-pulled" />
              ))}
            </div>
          </div>
        )}

        {collections.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No collections available yet. Check back soon!</p>
          </div>
        )}
      </TabsContent>

      {/* My Collection Tab */}
      <TabsContent value="collection" className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">My Collection</h2>
          <div className="flex gap-4">
            <Badge variant="secondary" className="px-3 py-1">
              {userCollection.total_cards || 0} total cards
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              {userCollection.unique_cards || 0} unique
            </Badge>
          </div>
        </div>

        {/* Collection Controls */}
        <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <SortAsc className="w-4 h-4" />
              <Label htmlFor="sort-select">Sort by:</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="rarity">Rarity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="missing-toggle">Show missing cards:</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMissingCards(!showMissingCards)}
              className="flex items-center gap-2"
            >
              {showMissingCards ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {showMissingCards ? 'Hide' : 'Show'}
            </Button>
          </div>
        </div>

        {userCollection.rarity_counts && Object.keys(userCollection.rarity_counts).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Collection Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {Object.entries(userCollection.rarity_counts).map(([rarity, count]) => (
                  <div key={rarity} className="text-center p-4 border rounded-lg">
                    <div className="flex justify-center mb-2">
                      {RARITY_CONFIG[rarity]?.icon}
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-gray-600">{rarity}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cards displayed with sorting and missing card support */}
        <div className="grid grid-cols-3 gap-6">
          {getDisplayCards().map((item) => (
            <div key={item.card_number} className="relative">
              {item.exists && item.owned ? (
                <>
                  <CardDisplay 
                    card={item.card} 
                    onClick={() => setSelectedCard(item.card)}
                  />
                  {/* Quantity indicator */}
                  {item.quantity > 1 && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <Badge className="bg-yellow-500 text-white font-bold px-2 py-1 text-sm shadow-lg">
                        x{item.quantity}
                      </Badge>
                    </div>
                  )}
                </>
              ) : (
                <MissingCardDisplay 
                  cardNumber={item.card_number}
                  totalCards={collectionOverview?.total_cards_in_set || 50}
                />
              )}
            </div>
          ))}
        </div>

        {(!userCollection.collected_cards || userCollection.collected_cards.length === 0) && (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No cards in your collection yet. Start opening packs!</p>
            <Button 
              onClick={() => setActiveTab('open-packs')} 
              className="mt-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              Open Your First Pack
            </Button>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                <Package className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  TCG Pocket
                </h1>
                <p className="text-gray-600">
                  {isAdminMode ? 'Admin Panel - Create collections and cards' : 'Open random packs and collect amazing cards!'}
                </p>
              </div>
            </div>
            
            {/* Mode Toggle and User Info */}
            <div className="flex items-center space-x-4">
              {/* Current User Display */}
              {currentUser && (
                <div className="flex items-center space-x-2 text-sm">
                  <User className="w-4 h-4 text-blue-500" />
                  <span className="text-gray-700">Welcome, <strong>{currentUser}</strong></span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-gray-500 hover:text-red-500"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              {/* Admin Mode Toggle */}
              <div className="flex items-center space-x-3">
                <Settings className={`w-5 h-5 ${isAdminMode ? 'text-orange-500' : 'text-gray-400'}`} />
                <Switch 
                  checked={isAdminMode} 
                  onCheckedChange={setIsAdminMode}
                  className="data-[state=checked]:bg-orange-500"
                />
                <span className={`text-sm ${isAdminMode ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                  {isAdminMode ? 'Admin Mode' : 'User Mode'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Pack Opening Animation Overlay */}
      {showPackAnimation && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="pack-opening-animation mb-8">
              <div className="pack-shake">
                <img 
                  src="https://images.unsplash.com/photo-1647893977168-6316f6c9ae44?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHwzfHxwb2tlbW9uJTIwY2FyZHN8ZW58MHx8fHwxNzUzOTYxMTIzfDA&ixlib=rb-4.1.0&q=85"
                  alt="Booster Pack"
                  className="w-48 h-64 object-cover rounded-xl shadow-2xl"
                />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Opening Random Pack...</h2>
            <p className="text-white mb-4">🎲 Rolling for your luck! 🎲</p>
            <div className="flex justify-center space-x-4">
              {animatingCards.map((card, index) => (
                <div 
                  key={index}
                  className="card-reveal-animation"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  <CardDisplay card={card} className="w-32" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Card Modal */}
      {selectedCard && (
        <CardModal 
          card={selectedCard} 
          onClose={() => setSelectedCard(null)} 
        />
      )}

      {/* Welcome Modal */}
      {showWelcomeModal && (
        <WelcomeModal 
          tempUsername={tempUsername}
          onTempUsernameChange={handleTempUsernameChange}
          handleWelcomeSubmit={handleWelcomeSubmit}
        />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentUser ? (
          isAdminMode ? <AdminTabs /> : <UserTabs />
        ) : (
          <div className="text-center py-12">
            <Gift className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Please enter your name to get started!</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
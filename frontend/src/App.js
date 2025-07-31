import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { PlusCircle, Package, Sparkles, Star, Zap, Crown, Diamond } from 'lucide-react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Rarity configurations with icons and colors
const RARITY_CONFIG = {
  'Common': { icon: <div className="w-4 h-4 rounded-full bg-gray-400"></div>, color: 'bg-gray-100 text-gray-800', glow: 'shadow-gray-200' },
  'Uncommon': { icon: <Star className="w-4 h-4 text-green-500" />, color: 'bg-green-100 text-green-800', glow: 'shadow-green-200' },
  'Rare': { icon: <Sparkles className="w-4 h-4 text-blue-500" />, color: 'bg-blue-100 text-blue-800', glow: 'shadow-blue-200' },
  'Holo': { icon: <Zap className="w-4 h-4 text-purple-500" />, color: 'bg-purple-100 text-purple-800', glow: 'shadow-purple-200' },
  'Ultra Rare': { icon: <Crown className="w-4 h-4 text-yellow-500" />, color: 'bg-yellow-100 text-yellow-800', glow: 'shadow-yellow-200' },
  'Secret Rare': { icon: <Diamond className="w-4 h-4 text-pink-500" />, color: 'bg-pink-100 text-pink-800', glow: 'shadow-pink-200' }
};

function App() {
  const [cards, setCards] = useState([]);
  const [boosterPacks, setBoosterPacks] = useState([]);
  const [pulledCards, setPulledCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('cards');
  const [showPackAnimation, setShowPackAnimation] = useState(false);
  const [animatingCards, setAnimatingCards] = useState([]);

  // Card creation form state
  const [cardForm, setCardForm] = useState({
    name: '',
    rarity: 'Common',
    card_type: 'Pokemon',
    hp: '',
    attack_1: '',
    attack_2: '',
    weakness: '',
    resistance: '',
    description: '',
    set_name: '',
    image: null
  });

  // Pack creation form state
  const [packForm, setPackForm] = useState({
    name: '',
    description: '',
    card_count: 11,
    rarity_distribution: [
      { rarity: 'Common', count: 6, guaranteed: false },
      { rarity: 'Uncommon', count: 3, guaranteed: false },
      { rarity: 'Rare', count: 1, guaranteed: true },
      { rarity: 'Holo', count: 1, guaranteed: false }
    ],
    available_cards: []
  });

  useEffect(() => {
    fetchCards();
    fetchBoosterPacks();
  }, []);

  const fetchCards = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/cards`);
      const data = await response.json();
      setCards(data.cards || []);
    } catch (error) {
      console.error('Error fetching cards:', error);
    }
  };

  const fetchBoosterPacks = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/booster-packs`);
      const data = await response.json();
      setBoosterPacks(data.packs || []);
    } catch (error) {
      console.error('Error fetching booster packs:', error);
    }
  };

  const handleCardSubmit = async (e) => {
    e.preventDefault();
    if (!cardForm.image) {
      alert('Please select an image for the card');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      Object.keys(cardForm).forEach(key => {
        if (cardForm[key] !== null && cardForm[key] !== '') {
          formData.append(key, cardForm[key]);
        }
      });

      const response = await fetch(`${BACKEND_URL}/api/cards`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setCardForm({
          name: '',
          rarity: 'Common',
          card_type: 'Pokemon',
          hp: '',
          attack_1: '',
          attack_2: '',
          weakness: '',
          resistance: '',
          description: '',
          set_name: '',
          image: null
        });
        fetchCards();
        alert('Card created successfully!');
      } else {
        alert('Error creating card');
      }
    } catch (error) {
      console.error('Error creating card:', error);
      alert('Error creating card');
    } finally {
      setLoading(false);
    }
  };

  const handlePackSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const packData = {
        id: Date.now().toString(),
        name: packForm.name,
        description: packForm.description,
        card_count: parseInt(packForm.card_count),
        rarity_distribution: packForm.rarity_distribution,
        available_cards: packForm.available_cards
      };

      const response = await fetch(`${BACKEND_URL}/api/booster-packs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(packData)
      });

      if (response.ok) {
        setPackForm({
          name: '',
          description: '',
          card_count: 11,
          rarity_distribution: [
            { rarity: 'Common', count: 6, guaranteed: false },
            { rarity: 'Uncommon', count: 3, guaranteed: false },
            { rarity: 'Rare', count: 1, guaranteed: true },
            { rarity: 'Holo', count: 1, guaranteed: false }
          ],
          available_cards: []
        });
        fetchBoosterPacks();
        alert('Booster pack created successfully!');
      } else {
        alert('Error creating booster pack');
      }
    } catch (error) {
      console.error('Error creating booster pack:', error);
      alert('Error creating booster pack');
    } finally {
      setLoading(false);
    }
  };

  const openPack = async (packId) => {
    setLoading(true);
    setShowPackAnimation(true);
    setPulledCards([]);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/open-pack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pack_id: packId })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Simulate pack opening animation
        setTimeout(() => {
          setAnimatingCards(data.cards);
          setTimeout(() => {
            setPulledCards(data.cards);
            setShowPackAnimation(false);
            setAnimatingCards([]);
          }, 1500);
        }, 1000);
      } else {
        alert('Error opening pack');
        setShowPackAnimation(false);
      }
    } catch (error) {
      console.error('Error opening pack:', error);
      alert('Error opening pack');
      setShowPackAnimation(false);
    } finally {
      setLoading(false);
    }
  };

  const CardDisplay = ({ card, className = "" }) => (
    <div className={`relative group cursor-pointer transform transition-all duration-300 hover:scale-105 ${className}`}>
      <div className={`rounded-xl overflow-hidden border-2 ${RARITY_CONFIG[card.rarity]?.glow || 'shadow-gray-200'} shadow-lg hover:shadow-xl transition-all duration-300`}>
        <div className="relative">
          <img 
            src={`${BACKEND_URL}${card.image_url}`} 
            alt={card.name}
            className="w-full h-48 object-cover"
          />
          <div className="absolute top-2 right-2">
            <Badge className={`${RARITY_CONFIG[card.rarity]?.color || 'bg-gray-100'} flex items-center gap-1`}>
              {RARITY_CONFIG[card.rarity]?.icon}
              {card.rarity}
            </Badge>
          </div>
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
                <p className="text-gray-600">Create and open custom booster packs</p>
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
            <h2 className="text-3xl font-bold text-white mb-4">Opening Pack...</h2>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white rounded-xl p-1 shadow-sm">
            <TabsTrigger value="cards" className="rounded-lg">My Cards</TabsTrigger>
            <TabsTrigger value="create-card" className="rounded-lg">Create Card</TabsTrigger>
            <TabsTrigger value="create-pack" className="rounded-lg">Create Pack</TabsTrigger>
            <TabsTrigger value="open-packs" className="rounded-lg">Open Packs</TabsTrigger>
          </TabsList>

          {/* My Cards Tab */}
          <TabsContent value="cards" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">My Card Collection</h2>
              <Badge variant="secondary" className="px-3 py-1">
                {cards.length} cards
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {cards.map((card) => (
                <CardDisplay key={card.id} card={card} />
              ))}
            </div>
            {cards.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No cards yet. Create your first card!</p>
              </div>
            )}
          </TabsContent>

          {/* Create Card Tab */}
          <TabsContent value="create-card">
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5" />
                  Create New Card
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCardSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Card Name</Label>
                      <Input
                        id="name"
                        value={cardForm.name}
                        onChange={(e) => setCardForm({...cardForm, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="rarity">Rarity</Label>
                      <Select value={cardForm.rarity} onValueChange={(value) => setCardForm({...cardForm, rarity: value})}>
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
                      <Select value={cardForm.card_type} onValueChange={(value) => setCardForm({...cardForm, card_type: value})}>
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
                        onChange={(e) => setCardForm({...cardForm, hp: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="image">Card Image</Label>
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setCardForm({...cardForm, image: e.target.files[0]})}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? 'Creating...' : 'Create Card'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Create Pack Tab */}
          <TabsContent value="create-pack">
            <Card className="max-w-4xl mx-auto">
              <CardHeader>
                <CardTitle>Create Booster Pack</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePackSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="pack-name">Pack Name</Label>
                      <Input
                        id="pack-name"
                        value={packForm.name}
                        onChange={(e) => setPackForm({...packForm, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="card-count">Cards per Pack</Label>
                      <Input
                        id="card-count"
                        type="number"
                        min="1"
                        max="20"
                        value={packForm.card_count}
                        onChange={(e) => setPackForm({...packForm, card_count: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={packForm.description}
                      onChange={(e) => setPackForm({...packForm, description: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>Available Cards</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                      {cards.map((card) => (
                        <div key={card.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`card-${card.id}`}
                            checked={packForm.available_cards.includes(card.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPackForm({
                                  ...packForm,
                                  available_cards: [...packForm.available_cards, card.id]
                                });
                              } else {
                                setPackForm({
                                  ...packForm,
                                  available_cards: packForm.available_cards.filter(id => id !== card.id)
                                });
                              }
                            }}
                          />
                          <label htmlFor={`card-${card.id}`} className="text-sm">
                            {card.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" disabled={loading || packForm.available_cards.length === 0} className="w-full">
                    {loading ? 'Creating...' : 'Create Booster Pack'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Open Packs Tab */}
          <TabsContent value="open-packs" className="space-y-6">
            <h2 className="text-2xl font-bold">Available Booster Packs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {boosterPacks.map((pack) => (
                <Card key={pack.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{pack.name}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{pack.description}</p>
                      </div>
                      <Badge>{pack.card_count} cards</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-2">Rarity Distribution:</p>
                        <div className="flex flex-wrap gap-1">
                          {pack.rarity_distribution.map((dist, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {dist.count}x {dist.rarity}
                              {dist.guaranteed && <span className="text-yellow-500 ml-1">★</span>}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button 
                        onClick={() => openPack(pack.id)} 
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                      >
                        {loading ? 'Opening...' : 'Open Pack'}
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
                  Cards Pulled!
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {pulledCards.map((card, index) => (
                    <CardDisplay key={index} card={card} className="card-pulled" />
                  ))}
                </div>
              </div>
            )}

            {boosterPacks.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No booster packs available. Create your first pack!</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;
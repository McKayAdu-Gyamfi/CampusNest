export const getImage = (filename: string): string => {
  const name = filename.replace(/\.(png|jpg|jpeg|svg|webp)$/i, '');
  if (name === 'New_Hosanna_2') return '/images/New_Hosanna_2png.webp';
  return `/images/${name}.webp`;
};

export const dufieAnnex = { 
  id: '1', 
  name: 'Dufie Annex', 
  location: 'Dufie Annex, Berekuso', 
  distance: '1.2 km', 
  price: 7000, 
  startingPrice: 6500,
  priceFreq: 'per semester',
  rating: 4.8,
  availability: 'AVAILABLE',
  amenities: ["WiFi", "Laundry", "Kitchen Shared"],
  image: getImage('Dufie_Annex_1.png'), 
  gallery: [
    getImage('Dufie_Annex_1.png'),
    getImage('Dufie_Annex_2.png')
  ],
  desc: "Experience the layout and natural lighting of your future home. This premium hostel offers a combination of aesthetics and state-of-the-art facilities including max security, 24/7 water supply, and unlimited WiFi." 
};

const newHosanna = { 
  id: '4', 
  name: 'New Hosanna', 
  location: 'New Hosanna, Berekuso', 
  distance: '0.5 km', 
  price: 8000, 
  startingPrice: 6000,
  priceFreq: 'per semester',
  rating: 4.2,
  availability: 'FULL',
  amenities: ["WiFi", "Kitchen Personal"],
  image: getImage('New Hosanna_1.png'), 
  gallery: [
    getImage('New_Hosanna_2.png'),
    getImage('New_Hosanna_3.png')
  ],
  desc: "Experience the layout and natural lighting of your future home. This premium hostel offers a combination of aesthetics and state-of-the-art facilities including max security, 24/7 water supply, and unlimited WiFi." 
};

export const MOST_POPULAR = [
  dufieAnnex,
  { 
    id: '2', 
    name: 'Dufie Platinum', 
    location: 'Dufie Platinum, Berekuso', 
    distance: '0.5 km', 
    price: 6500, 
    startingPrice: 6000,
    priceFreq: 'per semester',
    rating: 4.9,
    availability: 'FEW ROOMS LEFT',
    amenities: ["WiFi", "Kitchen Shared"],
    image: getImage('Dufie_Platinum_1.png'), 
    gallery: [
      getImage('Dufie_Platinum_1.png'),
      getImage('Dufie_Platinum_2.png'),
      getImage('Dufie_Platinum_3.png')
    ],
    desc: "Classic on-campus experience with modern facilities. Live right on campus where everything is close by." 
  },
  { 
    id: '3', 
    name: 'Tanko', 
    location: 'Tanko Apartment, Berekuso', 
    distance: '0.5 km', 
    price: 8000, 
    startingPrice: 7500,
    priceFreq: 'per semester',
    rating: 4.7,
    availability: 'AVAILABLE',
    amenities: ["WiFi", "Gym", "Laundry", "Kitchen Personal", "AC"],
    image: getImage('Tanko_1.png'), 
    gallery: [
      getImage('Tanko_2.png'),
      getImage('Tanko_3.png'),
      getImage('Tanko_4.png'),
      getImage('Tanko_5.png')
    ],
    desc: "Experience the layout and natural lighting of your future home. This premium hostel offers a combination of aesthetics and state-of-the-art facilities including max security, 24/7 water supply, and unlimited WiFi." 
  },
  newHosanna,
  { 
    id: '5', 
    name: 'Old Hosanna', 
    location: 'Old Hosanna, Berekuso', 
    distance: '0.5 km', 
    price: 8000, 
    startingPrice: 5000,
    priceFreq: 'per semester',
    rating: 4.0,
    availability: 'AVAILABLE',
    amenities: ["Kitchen Personal", "Laundry"],
    image: getImage('Old_Hosanna_1.png'), 
    gallery: [
      getImage('Old_Hosanna_1.png')
    ],
    desc: "Experience the layout and natural lighting of your future home. This premium hostel offers a combination of aesthetics and state-of-the-art facilities including max security, 24/7 water supply, and unlimited WiFi." 
  },
];

export const NEARBY_PLACES = [
  dufieAnnex,
  newHosanna
];

export const ALL_HOSTELS = Array.from(new Map([...MOST_POPULAR, ...NEARBY_PLACES].map(item => [item.id, item])).values());

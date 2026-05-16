/**
 * Pure data file — no browser APIs, no Leaflet imports.
 * Safe to import from both server and client components.
 */

export interface Store {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  color: string;
  emoji: string;
  address: string;
}

export const PUNE_STORES: Store[] = [
  {
    id: 'zara',
    name: 'Zara',
    description: 'International fast-fashion. Trendy collections updated weekly.',
    lat: 18.5362,
    lng: 73.8742,
    color: '#8b5cf6',
    emoji: '🛍️',
    address: 'Phoenix Marketcity, Viman Nagar, Pune',
  },
  {
    id: 'hm',
    name: 'H&M',
    description: "Affordable Scandinavian fashion for every style & season.",
    lat: 18.5089,
    lng: 73.8259,
    color: '#ec4899',
    emoji: '👗',
    address: 'Westend Mall, Aundh, Pune',
  },
  {
    id: 'westside',
    name: 'Westside',
    description: 'Tata-owned Indian fashion brand. Ethnic & western wear.',
    lat: 18.5204,
    lng: 73.8567,
    color: '#f59e0b',
    emoji: '✨',
    address: 'Central Mall, Shivajinagar, Pune',
  },
  {
    id: 'trends',
    name: 'Trends',
    description: "Reliance Retail's fashion destination. Value meets style.",
    lat: 18.4942,
    lng: 73.8568,
    color: '#10b981',
    emoji: '🌟',
    address: 'Reliance Smart, Katraj, Pune',
  },
];

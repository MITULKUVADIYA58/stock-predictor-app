import axios from 'axios';

// In production, set VITE_API_URL to your deployed backend (e.g. https://your-backend.onrender.com/api)
// In dev, Vite proxies /api to localhost:5000
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/* ═══ Auth APIs ═══ */

export const authAPI = {
  register: (name: string, email: string, password: string) =>
    api.post('/auth/register', { name, email, password }),

  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
};

/* ═══ Stock APIs ═══ */

export interface StockQuote {
  symbol: string;
  name: string;
  open: number;
  high: number;
  low: number;
  price: number;
  volume: number;
  latestTradingDay: string;
  previousClose: number;
  change: number;
  changePercent: string;
  currency: string;
  exchange: string;
}

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Prediction {
  day: number;
  price: number;
}

export interface StockSearchResponse {
  quote: StockQuote;
  historicalData: HistoricalDataPoint[];
}

export interface LiveQuote {
  symbol: string;
  name: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  previousClose: number;
  change: number;
  changePercent: string;
  currency: string;
  exchange: string;
  timestamp: number;
}

export interface PredictionResponse {
  symbol: string;
  currentPrice: number;
  predictions: Prediction[];
  confidence: number;
  method?: string;
  historicalPrices: { date: string; close: number }[];
}

export interface Favorite {
  id: string;
  user_id: string;
  symbol: string;
  created_at: string;
}

export interface SearchHistoryItem {
  id: string;
  user_id: string;
  symbol: string;
  searched_at: string;
}

export const stockAPI = {
  search: (symbol: string) =>
    api.get<StockSearchResponse>('/stocks/search', { params: { symbol } }),

  liveQuote: (symbol: string) =>
    api.get<LiveQuote>('/stocks/live-quote', { params: { symbol } }),

  predict: (symbol: string) =>
    api.get<PredictionResponse>('/stocks/predict', { params: { symbol } }),

  getFavorites: () =>
    api.get<Favorite[]>('/stocks/favorites'),

  addFavorite: (symbol: string) =>
    api.post<Favorite>('/stocks/favorites', { symbol }),

  removeFavorite: (symbol: string) =>
    api.delete(`/stocks/favorites/${symbol}`),

  getHistory: () =>
    api.get<SearchHistoryItem[]>('/stocks/history'),
};

export default api;

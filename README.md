# StockVision — AI-Powered Stock Market Prediction

A full-stack web application for stock market analysis and price prediction using machine learning.

## 🏗️ Architecture

| Component | Technology | Port |
|-----------|-----------|------|
| Frontend | React + TypeScript + Vite | 5173 |
| Backend | Node.js + Express | 5000 |
| ML API | Python + Flask | 5001 |
| Database | Supabase (PostgreSQL) | — |
| Stock Data | Alpha Vantage API | — |

## 📁 Folder Structure

```
stock-predictor/
├── frontend/           # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/ # Navbar, StockChart, ProtectedRoute
│   │   ├── context/    # AuthContext
│   │   ├── pages/      # Login, Register, Dashboard
│   │   ├── services/   # API service layer
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   └── package.json
├── backend/            # Node.js + Express
│   ├── routes/         # auth.js, stocks.js
│   ├── middleware/     # JWT auth middleware
│   ├── config/         # Supabase client
│   ├── server.js
│   └── package.json
├── ml-api/             # Python Flask ML API
│   ├── app.py
│   ├── model.py
│   ├── requirements.txt
│   └── data/           # Sample dataset
└── README.md
```

## 🚀 Local Setup

### Prerequisites
- Node.js 18+
- Python 3.9+
- Supabase account (free tier)
- Alpha Vantage API key (free at https://www.alphavantage.co/support/#api-key)

### 1. Supabase Setup

Create these tables in your Supabase SQL editor:

```sql
-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Favorites table
CREATE TABLE favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- Search history table
CREATE TABLE search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  searched_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your Supabase URL, key, and Alpha Vantage API key
npm install
npm run dev
```

### 3. ML API Setup

```bash
cd ml-api
pip install -r requirements.txt
python app.py
```

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Visit **http://localhost:5173** to use the application.

## 🌐 Deployment

### Frontend → Vercel
```bash
cd frontend
npx vercel --prod
```
Set environment variable: `VITE_API_URL=https://your-backend.onrender.com/api`

### Backend → Render
1. Create a new Web Service on Render
2. Connect your repo, set root directory to `backend`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add environment variables from `.env.example`

### ML API → Render / Railway
1. Create a new Web Service
2. Root directory: `ml-api`
3. Build command: `pip install -r requirements.txt`
4. Start command: `python app.py`

## 🔑 Environment Variables

### Backend (.env)
| Variable | Description |
|----------|-------------|
| SUPABASE_URL | Your Supabase project URL |
| SUPABASE_ANON_KEY | Supabase anonymous/public key |
| JWT_SECRET | Secret key for JWT signing |
| ALPHA_VANTAGE_API_KEY | Free API key from Alpha Vantage |
| ML_API_URL | URL of Flask ML API |
| PORT | Server port (default: 5000) |

### Frontend (.env)
| Variable | Description |
|----------|-------------|
| VITE_API_URL | Backend API URL (only needed in production) |

## ✨ Features

- 🔐 JWT Authentication with bcrypt password hashing
- 📊 Real-time stock data from Alpha Vantage
- 🧠 ML-powered price predictions (Polynomial Regression)
- 📈 Interactive charts with Chart.js
- ⭐ Favorite stocks management
- 🕐 Search history tracking
- 🎨 Premium dark theme UI
- 📱 Fully responsive design

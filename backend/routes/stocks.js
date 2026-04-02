const express = require('express');
const axios = require('axios');
const supabase = require('../config/supabase');
const authenticateToken = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// Yahoo Finance 2 v3 — no API key needed, supports Indian stocks (.NS / .BO)
let yahooFinance;
(async () => {
  const YahooFinance = (await import('yahoo-finance2')).default;
  yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
})();

// Map common Indian stock shorthand to Yahoo Finance symbols
function resolveSymbol(input) {
  const sym = input.toUpperCase().trim();

  // Indian stock mappings: .BSE -> .BO (Yahoo uses .BO for BSE)
  if (sym.endsWith('.BSE')) {
    return sym.replace('.BSE', '.BO');
  }
  // .NSE -> .NS
  if (sym.endsWith('.NSE')) {
    return sym.replace('.NSE', '.NS');
  }
  // If no suffix and it looks like a common Indian stock, default to .NS
  const indianStocks = [
    'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'HINDUNILVR',
    'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK', 'LT', 'HCLTECH',
    'AXISBANK', 'ASIANPAINT', 'MARUTI', 'SUNPHARMA', 'TITAN',
    'ULTRACEMCO', 'NESTLEIND', 'WIPRO', 'BAJFINANCE', 'BAJAJFINSV',
    'POWERGRID', 'NTPC', 'ONGC', 'JSWSTEEL', 'TATAMOTORS',
    'ADANIENT', 'ADANIPORTS', 'TATASTEEL', 'TECHM', 'INDUSINDBK',
    'COALINDIA', 'HINDALCO', 'DRREDDY', 'CIPLA', 'EICHERMOT',
    'DIVISLAB', 'BPCL', 'GRASIM', 'APOLLOHOSP', 'HEROMOTOCO',
    'TATACONSUM', 'BRITANNIA', 'BAJAJ-AUTO', 'M&M', 'UPL',
  ];
  if (indianStocks.includes(sym)) {
    return sym + '.NS';
  }

  return sym; // Return as-is for international stocks (AAPL, GOOGL, etc.)
}

// GET /api/stocks/search?symbol=RELIANCE.BSE
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required.' });
    }

    const yahooSymbol = resolveSymbol(symbol);

    // Fetch quote from Yahoo Finance
    const quoteData = await yahooFinance.quote(yahooSymbol);

    if (!quoteData || !quoteData.regularMarketPrice) {
      return res.status(404).json({ error: 'Stock not found. Please check the symbol and try again.' });
    }

    // Save to search history
    await supabase.from('search_history').insert([
      {
        user_id: req.user.id,
        symbol: symbol.toUpperCase(),
      },
    ]);

    // Fetch historical data for chart (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);

    const historicalResult = await yahooFinance.chart(yahooSymbol, {
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0],
      interval: '1d',
    });

    const historicalData = (historicalResult.quotes || [])
      .filter((q) => q.close !== null)
      .slice(-30)
      .map((q) => ({
        date: new Date(q.date).toISOString().split('T')[0],
        open: parseFloat(q.open?.toFixed(2) || 0),
        high: parseFloat(q.high?.toFixed(2) || 0),
        low: parseFloat(q.low?.toFixed(2) || 0),
        close: parseFloat(q.close?.toFixed(2) || 0),
        volume: q.volume || 0,
      }));

    const change = quoteData.regularMarketChange || 0;
    const changePercent = quoteData.regularMarketChangePercent
      ? quoteData.regularMarketChangePercent.toFixed(2) + '%'
      : '0.00%';

    res.json({
      quote: {
        symbol: quoteData.symbol,
        name: quoteData.shortName || quoteData.longName || quoteData.symbol,
        open: quoteData.regularMarketOpen || 0,
        high: quoteData.regularMarketDayHigh || 0,
        low: quoteData.regularMarketDayLow || 0,
        price: quoteData.regularMarketPrice || 0,
        volume: quoteData.regularMarketVolume || 0,
        latestTradingDay: quoteData.regularMarketTime
          ? new Date(quoteData.regularMarketTime * 1000).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        previousClose: quoteData.regularMarketPreviousClose || 0,
        change: parseFloat(change.toFixed(2)),
        changePercent,
        currency: quoteData.currency || 'INR',
        exchange: quoteData.exchange || '',
      },
      historicalData,
    });
  } catch (err) {
    console.error('Stock search error:', err.message);
    if (err.message?.includes('Not Found') || err.message?.includes('no results')) {
      return res.status(404).json({ error: 'Stock not found. Please check the symbol and try again.' });
    }
    res.status(500).json({ error: 'Failed to fetch stock data. Please try again.' });
  }
});

// GET /api/stocks/live-quote?symbol=RELIANCE — lightweight endpoint for real-time polling
router.get('/live-quote', authenticateToken, async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required.' });
    }

    const yahooSymbol = resolveSymbol(symbol);
    const quoteData = await yahooFinance.quote(yahooSymbol);

    if (!quoteData || !quoteData.regularMarketPrice) {
      return res.status(404).json({ error: 'Stock not found.' });
    }

    const change = quoteData.regularMarketChange || 0;
    const changePercent = quoteData.regularMarketChangePercent
      ? quoteData.regularMarketChangePercent.toFixed(2) + '%'
      : '0.00%';

    res.json({
      symbol: quoteData.symbol,
      name: quoteData.shortName || quoteData.longName || quoteData.symbol,
      price: quoteData.regularMarketPrice || 0,
      open: quoteData.regularMarketOpen || 0,
      high: quoteData.regularMarketDayHigh || 0,
      low: quoteData.regularMarketDayLow || 0,
      volume: quoteData.regularMarketVolume || 0,
      previousClose: quoteData.regularMarketPreviousClose || 0,
      change: parseFloat(change.toFixed(2)),
      changePercent,
      currency: quoteData.currency || 'INR',
      exchange: quoteData.exchange || '',
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error('Live quote error:', err.message);
    res.status(500).json({ error: 'Failed to fetch live quote.' });
  }
});

// GET /api/stocks/predict?symbol=RELIANCE.BSE
router.get('/predict', authenticateToken, async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required.' });
    }

    const yahooSymbol = resolveSymbol(symbol);

    // Fetch historical data for prediction (60 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 120);

    const historicalResult = await yahooFinance.chart(yahooSymbol, {
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0],
      interval: '1d',
    });

    const historicalPrices = (historicalResult.quotes || [])
      .filter((q) => q.close !== null)
      .slice(-60)
      .map((q) => ({
        date: new Date(q.date).toISOString().split('T')[0],
        close: parseFloat(q.close?.toFixed(2) || 0),
      }));

    if (historicalPrices.length < 10) {
      return res.status(400).json({ error: 'Not enough historical data for prediction.' });
    }

    // Call ML API for prediction
    try {
      const mlResponse = await axios.post(`${process.env.ML_API_URL}/predict`, {
        symbol: symbol.toUpperCase(),
        prices: historicalPrices.map((p) => p.close),
        dates: historicalPrices.map((p) => p.date),
      });

      res.json({
        symbol: symbol.toUpperCase(),
        currentPrice: historicalPrices[historicalPrices.length - 1].close,
        predictions: mlResponse.data.predictions,
        confidence: mlResponse.data.confidence,
        historicalPrices,
      });
    } catch (mlError) {
      // Fallback: simple moving average prediction if ML API is down
      console.warn('ML API unavailable, using fallback prediction');
      const prices = historicalPrices.map((p) => p.close);
      const last5 = prices.slice(-5);
      const avg = last5.reduce((a, b) => a + b, 0) / last5.length;
      const trend = (prices[prices.length - 1] - prices[prices.length - 6]) / 5;

      const predictions = [];
      for (let i = 1; i <= 7; i++) {
        predictions.push({
          day: i,
          price: parseFloat((avg + trend * i).toFixed(2)),
        });
      }

      res.json({
        symbol: symbol.toUpperCase(),
        currentPrice: prices[prices.length - 1],
        predictions,
        confidence: 0.65,
        method: 'fallback_moving_average',
        historicalPrices,
      });
    }
  } catch (err) {
    console.error('Prediction error:', err.message);
    res.status(500).json({ error: 'Failed to generate prediction.' });
  }
});

// GET /api/stocks/favorites
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Favorites fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch favorites.' });
  }
});

// POST /api/stocks/favorites
router.post('/favorites', authenticateToken, async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required.' });
    }

    // Check if already favorited
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Stock already in favorites.' });
    }

    const { data, error } = await supabase
      .from('favorites')
      .insert([{ user_id: req.user.id, symbol: symbol.toUpperCase() }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Add favorite error:', err);
    res.status(500).json({ error: 'Failed to add favorite.' });
  }
});

// DELETE /api/stocks/favorites/:symbol
router.delete('/favorites/:symbol', authenticateToken, async (req, res) => {
  try {
    const { symbol } = req.params;

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', req.user.id)
      .eq('symbol', symbol.toUpperCase());

    if (error) throw error;
    res.json({ message: 'Removed from favorites.' });
  } catch (err) {
    console.error('Remove favorite error:', err);
    res.status(500).json({ error: 'Failed to remove favorite.' });
  }
});

// GET /api/stocks/history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', req.user.id)
      .order('searched_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('History fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch search history.' });
  }
});

module.exports = router;

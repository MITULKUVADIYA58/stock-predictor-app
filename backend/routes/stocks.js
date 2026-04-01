const express = require('express');
const axios = require('axios');
const supabase = require('../config/supabase');
const authenticateToken = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';

// GET /api/stocks/search?symbol=AAPL
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required.' });
    }

    // Fetch quote from Alpha Vantage
    const quoteResponse = await axios.get(ALPHA_VANTAGE_BASE, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: symbol.toUpperCase(),
        apikey: API_KEY,
      },
    });

    const quoteData = quoteResponse.data['Global Quote'];
    if (!quoteData || Object.keys(quoteData).length === 0) {
      return res.status(404).json({ error: 'Stock not found or API limit reached. Try again later.' });
    }

    // Save to search history
    await supabase.from('search_history').insert([
      {
        user_id: req.user.id,
        symbol: symbol.toUpperCase(),
      },
    ]);

    // Fetch daily time series for chart data
    const timeSeriesResponse = await axios.get(ALPHA_VANTAGE_BASE, {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: symbol.toUpperCase(),
        outputsize: 'compact',
        apikey: API_KEY,
      },
    });

    const timeSeries = timeSeriesResponse.data['Time Series (Daily)'] || {};
    const historicalData = Object.entries(timeSeries)
      .slice(0, 30)
      .reverse()
      .map(([date, values]) => ({
        date,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseInt(values['5. volume']),
      }));

    res.json({
      quote: {
        symbol: quoteData['01. symbol'],
        open: parseFloat(quoteData['02. open']),
        high: parseFloat(quoteData['03. high']),
        low: parseFloat(quoteData['04. low']),
        price: parseFloat(quoteData['05. price']),
        volume: parseInt(quoteData['06. volume']),
        latestTradingDay: quoteData['07. latest trading day'],
        previousClose: parseFloat(quoteData['08. previous close']),
        change: parseFloat(quoteData['09. change']),
        changePercent: quoteData['10. change percent'],
      },
      historicalData,
    });
  } catch (err) {
    console.error('Stock search error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stock data.' });
  }
});

// GET /api/stocks/predict?symbol=AAPL
router.get('/predict', authenticateToken, async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required.' });
    }

    // Fetch historical data for prediction
    const timeSeriesResponse = await axios.get(ALPHA_VANTAGE_BASE, {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: symbol.toUpperCase(),
        outputsize: 'compact',
        apikey: API_KEY,
      },
    });

    const timeSeries = timeSeriesResponse.data['Time Series (Daily)'] || {};
    const historicalPrices = Object.entries(timeSeries)
      .slice(0, 60)
      .reverse()
      .map(([date, values]) => ({
        date,
        close: parseFloat(values['4. close']),
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

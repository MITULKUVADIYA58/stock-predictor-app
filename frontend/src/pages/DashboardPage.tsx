import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import StockChart from '../components/StockChart';
import {
  stockAPI,
  StockQuote,
  HistoricalDataPoint,
  Prediction,
  Favorite,
  SearchHistoryItem,
} from '../services/api';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [searchSymbol, setSearchSymbol] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);

  // Stock data state
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [confidence, setConfidence] = useState<number>(0);

  // Favorites & history
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  // Errors & toasts
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadFavoritesAndHistory = useCallback(async () => {
    try {
      const [favRes, histRes] = await Promise.all([
        stockAPI.getFavorites(),
        stockAPI.getHistory(),
      ]);
      setFavorites(favRes.data);
      setHistory(histRes.data);
    } catch {
      // silent fail for sidebar data
    }
  }, []);

  useEffect(() => {
    loadFavoritesAndHistory();
  }, [loadFavoritesAndHistory]);

  const handleSearch = async (symbol?: string) => {
    const query = (symbol || searchSymbol).trim().toUpperCase();
    if (!query) {
      setError('Please enter a stock symbol.');
      return;
    }

    setError('');
    setIsSearching(true);
    setPredictions([]);
    setConfidence(0);

    try {
      const response = await stockAPI.search(query);
      setQuote(response.data.quote);
      setHistoricalData(response.data.historicalData);
      setSearchSymbol(query);
      loadFavoritesAndHistory();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to fetch stock data. Check the symbol and try again.');
      setQuote(null);
      setHistoricalData([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePredict = async () => {
    if (!quote) return;

    setIsPredicting(true);
    try {
      const response = await stockAPI.predict(quote.symbol);
      setPredictions(response.data.predictions);
      setConfidence(response.data.confidence);
      showToast(`Prediction generated for ${quote.symbol}`, 'success');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showToast(axiosErr.response?.data?.error || 'Prediction failed.', 'error');
    } finally {
      setIsPredicting(false);
    }
  };

  const handleAddFavorite = async () => {
    if (!quote) return;
    try {
      await stockAPI.addFavorite(quote.symbol);
      showToast(`${quote.symbol} added to favorites!`, 'success');
      loadFavoritesAndHistory();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showToast(axiosErr.response?.data?.error || 'Failed to add favorite.', 'error');
    }
  };

  const handleRemoveFavorite = async (symbol: string) => {
    try {
      await stockAPI.removeFavorite(symbol);
      showToast(`${symbol} removed from favorites.`, 'success');
      loadFavoritesAndHistory();
    } catch {
      showToast('Failed to remove favorite.', 'error');
    }
  };

  const isFavorited = quote ? favorites.some((f) => f.symbol === quote.symbol) : false;

  const formatNumber = (num: number) =>
    new Intl.NumberFormat('en-US').format(num);

  const formatCurrency = (num: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

  return (
    <div className="dashboard-layout">
      <Navbar />

      <main className="dashboard-main">
        {/* Welcome Banner */}
        <div className="welcome-banner animate-fade-in-up">
          <div>
            <h2>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0] || 'Trader'} 👋</h2>
            <p>Search any stock symbol to view real-time data and AI predictions.</p>
          </div>
          <div className="welcome-icon">🚀</div>
        </div>

        {/* Search Section */}
        <section className="search-section animate-fade-in-up" id="search-section">
          <div className="search-bar">
            <input
              type="text"
              className="form-input"
              placeholder="Search stock symbol (e.g. AAPL, TSLA, TCS.BSE)"
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              id="stock-search-input"
            />
            <button
              className="btn btn-primary"
              onClick={() => handleSearch()}
              disabled={isSearching}
              id="stock-search-btn"
            >
              {isSearching ? <div className="spinner"></div> : '🔍 Search'}
            </button>
          </div>
          {error && <div className="alert alert-error" style={{ marginTop: 12, maxWidth: 600 }}>{error}</div>}
        </section>

        {/* Stock Stats Grid */}
        {quote && (
          <>
            <div className="stats-grid stagger" id="stock-stats">
              <div className="stat-card">
                <div className="stat-label">Current Price</div>
                <div className="stat-value">{formatCurrency(quote.price)}</div>
                <div className={`stat-change ${quote.change >= 0 ? 'positive' : 'negative'}`}>
                  {quote.change >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(quote.change))} ({quote.changePercent})
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Open</div>
                <div className="stat-value">{formatCurrency(quote.open)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">High</div>
                <div className="stat-value">{formatCurrency(quote.high)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Low</div>
                <div className="stat-value">{formatCurrency(quote.low)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Volume</div>
                <div className="stat-value">{formatNumber(quote.volume)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Prev Close</div>
                <div className="stat-value">{formatCurrency(quote.previousClose)}</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }} className="animate-fade-in">
              <button
                className="btn btn-primary"
                onClick={handlePredict}
                disabled={isPredicting}
                id="predict-btn"
              >
                {isPredicting ? (
                  <><div className="spinner"></div> Predicting...</>
                ) : (
                  '🧠 Predict Next 7 Days'
                )}
              </button>
              <button
                className={`btn ${isFavorited ? 'btn-outline' : 'btn-outline'}`}
                onClick={isFavorited ? () => handleRemoveFavorite(quote.symbol) : handleAddFavorite}
                id="favorite-btn"
              >
                {isFavorited ? '💛 Favorited' : '🤍 Add to Favorites'}
              </button>
            </div>

            {/* Chart Section */}
            <div className="chart-section animate-fade-in-up">
              <div className="chart-card">
                <h3>
                  📊 {quote.symbol} Price Chart
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span className="pulse-dot"></span> Live
                  </span>
                </h3>
                <div className="chart-wrapper">
                  <StockChart
                    historicalData={historicalData.map((d) => ({ date: d.date, close: d.close }))}
                    predictions={predictions.length > 0 ? predictions : undefined}
                    symbol={quote.symbol}
                  />
                </div>
              </div>

              {/* Prediction Panel */}
              <div className="prediction-panel">
                <h3>🧠 AI Predictions</h3>
                {predictions.length > 0 ? (
                  <>
                    {predictions.map((p) => {
                      const diff = p.price - quote.price;
                      const pct = ((diff / quote.price) * 100).toFixed(2);
                      return (
                        <div className="prediction-item" key={p.day}>
                          <span className="prediction-day">Day +{p.day}</span>
                          <span
                            className="prediction-price"
                            style={{ color: diff >= 0 ? 'var(--success)' : 'var(--danger)' }}
                          >
                            {formatCurrency(p.price)}{' '}
                            <small style={{ fontSize: '0.7rem' }}>
                              ({diff >= 0 ? '+' : ''}{pct}%)
                            </small>
                          </span>
                        </div>
                      );
                    })}
                    <div className="confidence-meter">
                      <div className="label">Model Confidence</div>
                      <div className="confidence-bar">
                        <div
                          className="confidence-fill"
                          style={{ width: `${(confidence * 100).toFixed(0)}%` }}
                        ></div>
                      </div>
                      <div className="confidence-value">{(confidence * 100).toFixed(1)}%</div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <div className="icon">🔮</div>
                    <p>Click "Predict Next 7 Days" to generate AI forecasts</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Empty state when no stock searched */}
        {!quote && !isSearching && (
          <div className="empty-state animate-fade-in" style={{ marginTop: 60 }}>
            <div className="icon">📈</div>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
              Search for a stock symbol above to get started
            </p>
            <p style={{ fontSize: '0.85rem', marginTop: 8 }}>
              Try AAPL, GOOGL, MSFT, TSLA, AMZN, or NVDA
            </p>
          </div>
        )}

        {/* Bottom Panels — Favorites & History */}
        <div className="bottom-panels" style={{ marginTop: 32 }}>
          <div className="panel animate-fade-in-up">
            <h3>
              ⭐ Favorite Stocks
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                {favorites.length} saved
              </span>
            </h3>
            {favorites.length > 0 ? (
              favorites.map((fav) => (
                <div
                  className="favorite-item"
                  key={fav.id}
                  onClick={() => handleSearch(fav.symbol)}
                >
                  <span className="favorite-symbol">📌 {fav.symbol}</span>
                  <div className="favorite-actions">
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFavorite(fav.symbol);
                      }}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="icon">⭐</div>
                <p>No favorites yet. Search a stock and add it!</p>
              </div>
            )}
          </div>

          <div className="panel animate-fade-in-up">
            <h3>
              🕐 Search History
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                Recent
              </span>
            </h3>
            {history.length > 0 ? (
              history.slice(0, 10).map((item) => (
                <div
                  className="history-item"
                  key={item.id}
                  onClick={() => handleSearch(item.symbol)}
                >
                  <span className="history-symbol">🔍 {item.symbol}</span>
                  <span className="history-time">
                    {new Date(item.searched_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="icon">🕐</div>
                <p>Your search history will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.message}</div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import StockChart from '../components/StockChart';
import LivePrice from '../components/LivePrice';
import {
  stockAPI,
  StockQuote,
  HistoricalDataPoint,
  Prediction,
  Favorite,
  SearchHistoryItem,
  PopularStock,
  StockSuggestion,
} from '../services/api';
import { isMarketOpen } from '../utils/market';

const POLL_INTERVAL = 1000; // Poll every 1 second for real-time updates

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [searchSymbol, setSearchSymbol] = useState('');
   const [isSearching, setIsSearching] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Stock data state
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [confidence, setConfidence] = useState<number>(0);

  // Live update state
  const [isLive, setIsLive] = useState(false);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [liveError, setLiveError] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Volume tracking for animation
  const [prevVolume, setPrevVolume] = useState<number | null>(null);
  const [volumeDirection, setVolumeDirection] = useState<'up' | 'down' | null>(null);

  // Favorites & history
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  // Popular stocks
  const [popularStocks, setPopularStocks] = useState<PopularStock[]>([]);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);

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

  // Load popular stocks on mount
  const loadPopularStocks = useCallback(async () => {
    setIsLoadingPopular(true);
    try {
      const res = await stockAPI.popular();
      setPopularStocks(res.data);
    } catch {
      // silent fail
    } finally {
      setIsLoadingPopular(false);
    }
  }, []);

  useEffect(() => {
    loadFavoritesAndHistory();
    loadPopularStocks();
  }, [loadFavoritesAndHistory, loadPopularStocks]);

  // Live price polling
  const fetchLiveQuote = useCallback(async (symbol: string) => {
    // Stop fetching if market is closed
    if (!isMarketOpen()) {
      setIsLive(false);
      return;
    }

    try {
      const response = await stockAPI.liveQuote(symbol);
      const liveData = response.data;

      setQuote((prev) => {
        if (prev) {
          const oldPrice = prev.price;
          const newPrice = liveData.price;
          const oldVolume = prev.volume;
          const newVolume = liveData.volume;

          if (newPrice !== oldPrice) {
            setPrevPrice(oldPrice);
            setPriceDirection(newPrice > oldPrice ? 'up' : 'down');
            setTimeout(() => setPriceDirection(null), 800);
          }

          if (newVolume !== oldVolume) {
            setPrevVolume(oldVolume);
            setVolumeDirection(newVolume > oldVolume ? 'up' : 'down');
            setTimeout(() => setVolumeDirection(null), 800);
          }
        }

        return {
          ...prev!,
          price: liveData.price,
          open: liveData.open,
          high: liveData.high,
          low: liveData.low,
          volume: liveData.volume,
          previousClose: liveData.previousClose,
          change: liveData.change,
          changePercent: liveData.changePercent,
          symbol: liveData.symbol,
          name: liveData.name,
          currency: liveData.currency,
          exchange: liveData.exchange,
          fiftyTwoWeekHigh: liveData.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: liveData.fiftyTwoWeekLow,
        };
      });

      setLastUpdated(new Date());
      setSecondsSinceUpdate(0);
      setLiveError(false);
    } catch {
      setLiveError(true);
    }
  }, []);

  // Start/stop live polling
  const startLivePolling = useCallback((symbol: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickerRef.current) clearInterval(tickerRef.current);

    setIsLive(true);
    setLiveError(false);

    pollRef.current = setInterval(() => {
      fetchLiveQuote(symbol);
    }, POLL_INTERVAL);

    tickerRef.current = setInterval(() => {
      setSecondsSinceUpdate((prev) => prev + 1);
    }, 1000);
  }, [fetchLiveQuote]);

  const stopLivePolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    setIsLive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopLivePolling();
    };
  }, [stopLivePolling]);

  // Fetch suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
      // Suggest if symbol has 2+ characters
      if (searchSymbol.length >= 2) {
        try {
          const response = await stockAPI.suggest(searchSymbol);
          setSuggestions(response.data.suggestions);
          setShowSuggestions(response.data.suggestions.length > 0);
        } catch (err) {
          console.error('Failed to fetch suggestions:', err);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 250); // Debounce delay

    return () => clearTimeout(timer);
  }, [searchSymbol]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSuggestions && !document.getElementById('stock-search-input')?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSuggestions]);

  const handleSearch = async (symbol?: string) => {
    const query = (symbol || searchSymbol).trim().toUpperCase();
    if (!query) {
      setError('Please enter a stock symbol.');
      return;
    }

    setError('');
    setIsSearching(true);
    setShowSuggestions(false);
    setPredictions([]);
    setConfidence(0);
    stopLivePolling();
    setPrevPrice(null);
    setPriceDirection(null);
    setPrevVolume(null);
    setVolumeDirection(null);

    try {
      const response = await stockAPI.search(query);
      setQuote(response.data.quote);
      setHistoricalData(response.data.historicalData);
      setSearchSymbol(query);
      setLastUpdated(new Date());
      setSecondsSinceUpdate(0);
      loadFavoritesAndHistory();

      startLivePolling(query);
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
    new Intl.NumberFormat('en-IN').format(num);

  const formatCurrency = (num: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num);

  const formatVolume = (vol: number) => {
    if (vol >= 10000000) return (vol / 10000000).toFixed(2) + ' Cr';
    if (vol >= 100000) return (vol / 100000).toFixed(2) + ' L';
    if (vol >= 1000) return (vol / 1000).toFixed(2) + ' K';
    return vol.toString();
  };

  const get52WeekPosition = (price: number, low: number, high: number) => {
    if (high === low) return 50;
    return ((price - low) / (high - low)) * 100;
  };

  const marketOpen = isMarketOpen();

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
            <div className="search-input-wrapper" style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search stock symbol (e.g. RELIANCE, TCS, INFY, AAPL)"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                id="stock-search-input"
                autoComplete="off"
              />
              
              {showSuggestions && (
                <div className="search-suggestions">
                  {suggestions.map((s) => (
                    <div
                      key={s.symbol}
                      className="suggestion-item"
                      onClick={() => handleSearch(s.symbol)}
                    >
                      <div className="suggestion-symbol">{s.symbol}</div>
                      <div className="suggestion-info">
                        <span className="suggestion-name">{s.name}</span>
                        <span className="suggestion-exch">{s.exchange}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

        {/* Live Ticker Bar */}
        {quote && isLive && (
          <div className="live-ticker-bar animate-fade-in">
            <div className="live-ticker-left">
              <span className={`live-badge ${liveError ? 'live-badge-error' : ''}`}>
                <span className="pulse-dot-sm"></span>
                {liveError ? 'RECONNECTING' : 'LIVE'}
              </span>
              <span className="live-ticker-symbol">{quote.symbol}</span>
              <LivePrice price={quote.price} previousPrice={prevPrice} size="md" />
              <span className={`live-ticker-change ${quote.change >= 0 ? 'positive' : 'negative'}`}>
                {quote.change >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(quote.change))} ({quote.changePercent})
              </span>
            </div>
            <div className="live-ticker-right">
              <span className="live-ticker-volume">
                Vol: <span className={`volume-value ${volumeDirection ? `volume-flash-${volumeDirection}` : ''}`}>
                  {formatVolume(quote.volume)}
                </span>
              </span>
              <span className="live-ticker-time">
                Updated {secondsSinceUpdate}s ago
              </span>
              <button
                className="btn-icon btn-sm live-toggle"
                onClick={() => { stopLivePolling(); setIsLive(false); }}
                title="Stop live updates"
              >
                ⏸
              </button>
            </div>
          </div>
        )}

        {/* Resume live button when paused */}
        {quote && !isLive && !isSearching && (
          <div className="live-resume-bar animate-fade-in">
            <span>Live updates paused</span>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => startLivePolling(searchSymbol)}
            >
              ▶ Resume Live
            </button>
          </div>
        )}

        {/* Stock Stats Grid */}
        {quote && (
          <>
            <div className="stats-grid stagger" id="stock-stats">
              <div className="stat-card stat-card-main">
                <div className="stat-label">{quote.name || quote.symbol}</div>
                <div className="stat-value stat-value-live">
                  <LivePrice price={quote.price} previousPrice={prevPrice} size="lg" showCurrency />
                </div>
                <div className={`stat-change ${quote.change >= 0 ? 'positive' : 'negative'}`}>
                  {quote.change >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(quote.change))} ({quote.changePercent})
                </div>
                <div className={`market-status ${!marketOpen ? 'market-closed' : ''}`}>
                  <span className="market-status-dot"></span>
                  {marketOpen ? 'Market Open' : 'Market Closed'}
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
                <div className={`stat-value ${volumeDirection ? `volume-flash-${volumeDirection}` : ''}`}>
                  {formatVolume(quote.volume)}
                </div>
                <div className="volume-detail">{formatNumber(quote.volume)} shares</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Prev Close</div>
                <div className="stat-value">{formatCurrency(quote.previousClose)}</div>
              </div>
            </div>

            {/* 52-Week High/Low Card */}
            {(quote.fiftyTwoWeekHigh > 0 || quote.fiftyTwoWeekLow > 0) && (
              <div className="week52-card animate-fade-in-up" id="52-week-range">
                <h3>📊 52-Week Range</h3>
                <div className="week52-content">
                  <div className="week52-values">
                    <div className="week52-low">
                      <span className="week52-label">52W Low</span>
                      <span className="week52-price low">{formatCurrency(quote.fiftyTwoWeekLow)}</span>
                    </div>
                    <div className="week52-bar-container">
                      <div className="week52-bar">
                        <div
                          className="week52-marker"
                          style={{ left: `${get52WeekPosition(quote.price, quote.fiftyTwoWeekLow, quote.fiftyTwoWeekHigh)}%` }}
                        >
                          <div className="week52-marker-tooltip">
                            {formatCurrency(quote.price)}
                          </div>
                          <div className="week52-marker-dot"></div>
                        </div>
                      </div>
                    </div>
                    <div className="week52-high">
                      <span className="week52-label">52W High</span>
                      <span className="week52-price high">{formatCurrency(quote.fiftyTwoWeekHigh)}</span>
                    </div>
                  </div>
                  <div className="week52-stats">
                    <div className="week52-stat">
                      <span className="week52-stat-label">Distance from Low</span>
                      <span className="week52-stat-value positive">
                        +{((quote.price - quote.fiftyTwoWeekLow) / quote.fiftyTwoWeekLow * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="week52-stat">
                      <span className="week52-stat-label">Distance from High</span>
                      <span className="week52-stat-value negative">
                        {((quote.price - quote.fiftyTwoWeekHigh) / quote.fiftyTwoWeekHigh * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                    {lastUpdated && (
                      <span style={{ marginLeft: 8, fontSize: '0.7rem', opacity: 0.6 }}>
                        {lastUpdated.toLocaleTimeString('en-IN')}
                      </span>
                    )}
                  </span>
                </h3>
                <div className="chart-wrapper">
                  <StockChart
                    historicalData={historicalData}
                    symbol={quote.symbol}
                    livePrice={quote.price}
                    liveVolume={quote.volume}
                    predictions={predictions.length > 0 ? predictions : undefined}
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

        {/* Popular Stocks Section — shows when no stock is searched */}
        {!quote && !isSearching && (
          <div className="popular-stocks-section animate-fade-in-up" id="popular-stocks">
            <h3 className="section-title">
              🔥 Trending Stocks
              <span className="section-subtitle">Real-time prices from NSE</span>
            </h3>
            {isLoadingPopular ? (
              <div className="popular-loading">
                <div className="spinner"></div>
                <p>Loading market data...</p>
              </div>
            ) : popularStocks.length > 0 ? (
              <div className="popular-grid">
                {popularStocks.map((stock) => (
                  <div
                    className="popular-card"
                    key={stock.symbol}
                    onClick={() => handleSearch(stock.symbol)}
                    id={`popular-${stock.symbol}`}
                  >
                    <div className="popular-header">
                      <div className="popular-symbol">{stock.symbol}</div>
                      <div className={`popular-change-badge ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                        {stock.change >= 0 ? '▲' : '▼'} {stock.changePercent}
                      </div>
                    </div>
                    <div className="popular-name">{stock.name}</div>
                    <div className="popular-price">{formatCurrency(stock.price)}</div>
                    <div className="popular-details">
                      <div className="popular-detail">
                        <span className="popular-detail-label">Vol</span>
                        <span className="popular-detail-value">{formatVolume(stock.volume)}</span>
                      </div>
                      <div className="popular-detail">
                        <span className="popular-detail-label">H</span>
                        <span className="popular-detail-value">{formatCurrency(stock.high)}</span>
                      </div>
                      <div className="popular-detail">
                        <span className="popular-detail-label">L</span>
                        <span className="popular-detail-value">{formatCurrency(stock.low)}</span>
                      </div>
                    </div>
                    <div className="popular-52w">
                      <span className="popular-52w-label">52W:</span>
                      <span className="popular-52w-low">{formatCurrency(stock.fiftyTwoWeekLow)}</span>
                      <span className="popular-52w-sep">—</span>
                      <span className="popular-52w-high">{formatCurrency(stock.fiftyTwoWeekHigh)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state animate-fade-in" style={{ marginTop: 40 }}>
                <div className="icon">📈</div>
                <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                  Search for a stock symbol above to get started
                </p>
                <p style={{ fontSize: '0.85rem', marginTop: 8 }}>
                  Try RELIANCE, TCS, INFY, HDFCBANK, WIPRO, or ITC
                </p>
              </div>
            )}
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
                    {new Date(item.searched_at).toLocaleDateString('en-IN', {
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

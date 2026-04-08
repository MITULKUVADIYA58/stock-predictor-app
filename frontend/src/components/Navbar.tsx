import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Check if market is open (9:15 AM - 3:30 PM IST, Mon-Fri)
  const isMarketOpen = () => {
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    if (day === 0 || day === 6) return false; // Weekend
    if (totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 30) return true;
    return false;
  };

  const marketOpen = isMarketOpen();

  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-brand">
        <div className="logo-icon">📈</div>
        <h1>StockVision</h1>
      </div>

      <div className="navbar-clock" id="live-clock">
        <div className="clock-time">{formatTime(currentTime)}</div>
        <div className="clock-date">{formatDate(currentTime)}</div>
        <div className={`market-indicator ${marketOpen ? 'market-open' : 'market-closed'}`}>
          <span className="market-dot"></span>
          {marketOpen ? 'Market Open' : 'Market Closed'}
        </div>
      </div>

      <div className="navbar-user">
        <span className="user-name">
          Welcome, <strong>{user?.name || 'User'}</strong>
        </span>
        <div className="user-avatar">{initials}</div>
        <button
          className="btn btn-outline btn-sm"
          onClick={handleLogout}
          id="logout-btn"
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

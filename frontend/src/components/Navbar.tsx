import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-brand">
        <div className="logo-icon">📈</div>
        <h1>StockVision</h1>
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

import React from 'react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="Toggle Theme"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div className="theme-toggle-content">
        {theme === 'light' ? (
          <span className="icon">🌙</span>
        ) : (
          <span className="icon">☀️</span>
        )}
      </div>
    </button>
  );
};

export default ThemeToggle;

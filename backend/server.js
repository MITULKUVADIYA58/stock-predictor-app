const express = require('express');
const cors = require('cors');
require('dotenv').config();
// Trigger redeploy for search suggestions feature

const authRoutes = require('./routes/auth');
const stockRoutes = require('./routes/stocks');
const salesforceRoutes = require('./routes/salesforce');

const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => res.json({ message: 'StockVision API is running' }));

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://frontend-seven-theta-34.vercel.app',
    /\.vercel\.app$/,
    /\.force\.com$/,
    /\.salesforce\.com$/,
    /\.visualforce\.com$/
  ],
  credentials: true,
}));

// Allow iframing by Salesforce
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.force.com https://*.salesforce.com https://*.visualforce.com;");
  next();
});
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/salesforce', salesforceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});

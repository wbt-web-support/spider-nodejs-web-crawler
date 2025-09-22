#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '100mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 requests per minute per IP
  message: {
    error: 'Rate limit exceeded',
    retryAfter: '1 minute'
  }
});

app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test scraping endpoint (without native module)
app.post('/scrap', async (req, res) => {
  try {
    const { url, options = {} } = req.body;
    
    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        timestamp: new Date().toISOString()
      });
    }

    // Simple mock response for testing
    res.json({
      success: true,
      url: url,
      timestamp: new Date().toISOString(),
      data: {
        title: 'Test Page',
        content: 'This is a test response from the API',
        images: [],
        links: [],
        metadata: {
          scrapedAt: new Date().toISOString(),
          userAgent: 'Spider-NodeJS-Test/1.0.0'
        }
      },
      message: 'Test API is working - native module not loaded'
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Spider NodeJS API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      scrap: 'POST /scrap'
    },
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test Spider API`);
  console.log(`🔥 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🕷️  Scrape endpoint: POST http://localhost:${PORT}/scrap`);
  console.log(`⚡ Ready for testing!`);
});

module.exports = app;

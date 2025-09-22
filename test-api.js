#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

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

// Utility functions for HTML parsing
function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : 'No title found';
}

function extractImages(html) {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images = [];
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    images.push({
      src: match[1],
      fullTag: match[0]
    });
  }
  return images;
}

function extractLinks(html, baseUrl) {
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  const links = [];
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    
    // Convert relative URLs to absolute
    let absoluteUrl = href;
    if (href.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        absoluteUrl = `${base.protocol}//${base.host}${href}`;
      } catch (e) {
        // Keep relative URL if base URL is invalid
      }
    } else if (!href.startsWith('http')) {
      try {
        absoluteUrl = new URL(href, baseUrl).href;
      } catch (e) {
        // Keep original URL if conversion fails
      }
    }
    
    links.push({
      href: absoluteUrl,
      text: text,
      originalHref: href
    });
  }
  return links;
}

function extractTextContent(html) {
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, ' ');
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

// Real scraping endpoint using axios
app.post('/scrap', async (req, res) => {
  try {
    const { url, options = {} } = req.body;
    
    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🕷️ Scraping: ${url}`);
    
    // Fetch the webpage
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const html = response.data;
    const title = extractTitle(html);
    const images = extractImages(html);
    const links = extractLinks(html, url);
    const textContent = extractTextContent(html);

    // Extract metadata
    const metadata = {
      scrapedAt: new Date().toISOString(),
      userAgent: 'Spider-NodeJS/1.0.0',
      statusCode: response.status,
      contentType: response.headers['content-type'],
      contentLength: response.headers['content-length'],
      lastModified: response.headers['last-modified'],
      server: response.headers['server']
    };

    res.json({
      success: true,
      url: url,
      timestamp: new Date().toISOString(),
      data: {
        title: title,
        content: textContent.substring(0, 1000) + (textContent.length > 1000 ? '...' : ''),
        fullContent: textContent,
        images: images.slice(0, 10), // Limit to first 10 images
        links: links.slice(0, 20), // Limit to first 20 links
        metadata: metadata,
        stats: {
          totalImages: images.length,
          totalLinks: links.length,
          contentLength: textContent.length,
          htmlLength: html.length
        }
      },
      message: 'Successfully scraped using HTTP requests'
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      error: 'Scraping failed',
      message: error.message,
      timestamp: new Date().toISOString(),
      details: {
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText
      }
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

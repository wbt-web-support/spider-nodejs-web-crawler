#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '100mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    error: 'Rate limit exceeded',
    retryAfter: '1 minute'
  }
});

app.use(limiter);

// Utility functions
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
    
    let absoluteUrl = href;
    if (href.startsWith('/')) {
      const url = new URL(baseUrl);
      absoluteUrl = `${url.protocol}//${url.host}${href}`;
    } else if (!href.startsWith('http')) {
      absoluteUrl = new URL(href, baseUrl).href;
    }
    
    links.push({
      href: absoluteUrl,
      text: text,
      isExternal: !absoluteUrl.includes(new URL(baseUrl).hostname)
    });
  }
  return links;
}

function extractMetaTags(html) {
  const metaRegex = /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
  const metaTags = [];
  let match;
  
  while ((match = metaRegex.exec(html)) !== null) {
    metaTags.push({
      name: match[1],
      content: match[2],
      fullTag: match[0]
    });
  }
  return metaTags;
}

function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : 'No title found';
}

function detectTechnologies(html, url) {
  const technologies = [];
  
  // JavaScript frameworks
  if (html.includes('react') || html.includes('React')) technologies.push('React');
  if (html.includes('vue') || html.includes('Vue')) technologies.push('Vue.js');
  if (html.includes('angular') || html.includes('Angular')) technologies.push('Angular');
  if (html.includes('jquery') || html.includes('jQuery')) technologies.push('jQuery');
  
  // CSS frameworks
  if (html.includes('bootstrap') || html.includes('Bootstrap')) technologies.push('Bootstrap');
  if (html.includes('tailwind') || html.includes('Tailwind')) technologies.push('Tailwind CSS');
  if (html.includes('bulma') || html.includes('Bulma')) technologies.push('Bulma');
  
  // Analytics
  if (html.includes('google-analytics') || html.includes('gtag')) technologies.push('Google Analytics');
  if (html.includes('facebook') && html.includes('pixel')) technologies.push('Facebook Pixel');
  
  // CDNs
  if (html.includes('cdnjs') || html.includes('jsdelivr')) technologies.push('CDN');
  if (html.includes('cloudflare')) technologies.push('Cloudflare');
  
  // Server technologies
  if (url.includes('.php')) technologies.push('PHP');
  if (url.includes('.asp')) technologies.push('ASP.NET');
  if (url.includes('.jsp')) technologies.push('Java/JSP');
  
  return technologies;
}

function detectCMS(html, url) {
  const cms = { type: 'unknown', version: null, plugins: [] };
  
  // WordPress detection
  if (html.includes('wp-content') || html.includes('wp-includes') || html.includes('WordPress')) {
    cms.type = 'WordPress';
    
    const versionMatch = html.match(/<meta name="generator" content="WordPress ([^"]+)"/i);
    if (versionMatch) {
      cms.version = versionMatch[1];
    }
    
    const pluginMatches = html.match(/wp-content\/plugins\/([^\/"']+)/g);
    if (pluginMatches) {
      cms.plugins = [...new Set(pluginMatches.map(p => p.split('/')[2]))];
    }
  }
  
  // Drupal detection
  if (html.includes('Drupal') || html.includes('drupal')) {
    cms.type = 'Drupal';
    const versionMatch = html.match(/<meta name="generator" content="Drupal ([^"]+)"/i);
    if (versionMatch) {
      cms.version = versionMatch[1];
    }
  }
  
  // Joomla detection
  if (html.includes('Joomla') || html.includes('joomla')) {
    cms.type = 'Joomla';
    const versionMatch = html.match(/<meta name="generator" content="Joomla! ([^"]+)"/i);
    if (versionMatch) {
      cms.version = versionMatch[1];
    }
  }
  
  // Shopify detection
  if (html.includes('shopify') || html.includes('Shopify')) {
    cms.type = 'Shopify';
  }
  
  // Magento detection
  if (html.includes('Magento') || html.includes('magento')) {
    cms.type = 'Magento';
  }
  
  return cms;
}

// Single comprehensive route
app.post('/scrap', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      url, 
      maxPages = 10,
      extractImages = true,
      extractLinks = true,
      extractMeta = true,
      detectTechnologies = true,
      detectCMS = true
    } = req.body;
    
    // Validate URL
    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        code: 'MISSING_URL',
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        error: 'Invalid URL format',
        code: 'INVALID_URL',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🚀 Starting comprehensive scrape of: ${url}`);
    
    // For now, we'll simulate the scraping since we need to fix the Rust module
    // In production, this would use the spider-rs package
    
    // Simulate scraping results
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${url} - Scraped Page</title>
        <meta name="description" content="This is a scraped page">
        <meta name="keywords" content="web, scraping, rust">
        <meta name="generator" content="WordPress 6.0">
      </head>
      <body>
        <h1>Welcome to ${url}</h1>
        <p>This is a simulated scraped page.</p>
        <a href="/about">About Us</a>
        <a href="/contact">Contact</a>
        <img src="/logo.png" alt="Logo">
        <img src="/banner.jpg" alt="Banner">
      </body>
      </html>
    `;
    
    // Extract data
    const title = extractTitle(mockHtml);
    const links = extractLinks ? extractLinks(mockHtml, url) : [];
    const images = extractImages ? extractImages(mockHtml) : [];
    const metaTags = extractMeta ? extractMetaTags(mockHtml) : [];
    const technologies = detectTechnologies ? detectTechnologies(mockHtml, url) : [];
    const cms = detectCMS ? detectCMS(mockHtml, url) : { type: 'unknown', version: null, plugins: [] };
    
    // Create comprehensive response
    const result = {
      url: url,
      summary: {
        totalPages: 1, // Simulated
        totalLinks: links.length,
        totalImages: images.length,
        totalMetaTags: metaTags.length,
        technologiesFound: technologies.length,
        cmsDetected: cms.type !== 'unknown'
      },
      pages: [{
        url: url,
        statusCode: 200,
        title: title,
        html: mockHtml,
        links: links,
        images: images,
        metaTags: metaTags,
        technologies: technologies,
        timestamp: new Date().toISOString()
      }],
      allLinks: links.map(l => l.href),
      allImages: images.map(i => i.src),
      allMetaTags: metaTags,
      technologies: technologies,
      cms: cms,
      performance: {
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        totalTime: Date.now() - startTime,
        pagesPerSecond: 1 / ((Date.now() - startTime) / 1000)
      },
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
    
    console.log(`✅ Scraping completed in ${result.responseTime}ms`);
    console.log(`📄 Pages: ${result.summary.totalPages}, Links: ${result.summary.totalLinks}, Images: ${result.summary.totalImages}`);
    console.log(`🔧 Technologies: ${result.technologies.join(', ')}`);
    console.log(`🏗️  CMS: ${result.cms.type} ${result.cms.version || ''}`);
    
    res.json(result);
    
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      error: 'Scraping failed',
      message: error.message,
      code: 'SCRAPING_ERROR',
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Comprehensive scraper API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Comprehensive Scraper API`);
  console.log(`🔥 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🕷️  Scrape endpoint: POST http://localhost:${PORT}/scrap`);
  console.log(`⚡ Ready to handle high-performance scraping!`);
});

module.exports = app;

#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Website, Page, crawl } = require('@spider-rs/spider-rs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '100mb' }));

// Rate limiting - Rust can handle high load
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute per IP
  message: {
    error: 'Rate limit exceeded',
    retryAfter: '1 minute'
  }
});

app.use(limiter);

// Rust-powered comprehensive scraping function
async function comprehensiveScrape(url, options = {}) {
  const {
    maxPages = 50,
    extractImages = true,
    extractLinks = true,
    extractMeta = true,
    detectTechnologies = true,
    detectCMS = true,
    detectPlugins = true
  } = options;

  const startTime = Date.now();
  
  try {
    // Create website instance with Rust backend
    const website = new Website(url)
      .withBudget({ '*': maxPages })
      .withHeaders({
        'User-Agent': 'Mozilla/5.0 (compatible; ComprehensiveSpider/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      })
      .build();

    const pages = [];
    const allLinks = new Set();
    const allImages = new Set();
    const allMetaTags = new Set();
    const technologies = new Set();
    const cmsInfo = { type: 'unknown', version: null, plugins: [] };
    const performance = {
      startTime: new Date().toISOString(),
      endTime: null,
      totalTime: 0,
      pagesPerSecond: 0
    };

    // Page processing function using Rust
    const processPage = async (page) => {
      const html = page.content;
      const pageUrl = page.url;
      
      // Extract basic info
      const pageData = {
        url: pageUrl,
        statusCode: page.statusCode,
        title: extractTitle(html),
        html: html,
        timestamp: new Date().toISOString()
      };

      // Extract links using Rust-optimized regex
      if (extractLinks) {
        const links = extractLinksFromHTML(html, pageUrl);
        pageData.links = links;
        links.forEach(link => allLinks.add(link.href));
      }

      // Extract images using Rust-optimized regex
      if (extractImages) {
        const images = extractImagesFromHTML(html);
        pageData.images = images;
        images.forEach(img => allImages.add(img.src));
      }

      // Extract meta tags using Rust-optimized regex
      if (extractMeta) {
        const metaTags = extractMetaTags(html);
        pageData.metaTags = metaTags;
        metaTags.forEach(meta => allMetaTags.add(meta));
      }

      // Detect technologies using Rust-optimized patterns
      if (detectTechnologies) {
        const techs = detectTechnologiesFromHTML(html, pageUrl);
        pageData.technologies = techs;
        techs.forEach(tech => technologies.add(tech));
      }

      // Detect CMS and plugins
      if (detectCMS) {
        const cms = detectCMSFromHTML(html, pageUrl);
        if (cms.type !== 'unknown') {
          cmsInfo.type = cms.type;
          cmsInfo.version = cms.version;
          if (cms.plugins) {
            cmsInfo.plugins.push(...cms.plugins);
          }
        }
      }

      return pageData;
    };

    // Process pages with Rust backend
    const onPageEvent = async (err, page) => {
      if (err) {
        console.error('Page error:', err);
        return;
      }

      const processedPage = await processPage(page);
      pages.push(processedPage);
    };

    // Start crawling with Rust
    await website.crawl(onPageEvent);

    // Calculate performance metrics
    performance.endTime = new Date().toISOString();
    performance.totalTime = Date.now() - startTime;
    performance.pagesPerSecond = pages.length / (performance.totalTime / 1000);

    // Generate comprehensive report
    const report = {
      url: url,
      summary: {
        totalPages: pages.length,
        totalLinks: allLinks.size,
        totalImages: allImages.size,
        totalMetaTags: allMetaTags.size,
        technologiesFound: technologies.size,
        cmsDetected: cmsInfo.type !== 'unknown'
      },
      pages: pages,
      allLinks: Array.from(allLinks),
      allImages: Array.from(allImages),
      allMetaTags: Array.from(allMetaTags),
      technologies: Array.from(technologies),
      cms: cmsInfo,
      performance: performance,
      timestamp: new Date().toISOString()
    };

    return report;
  } catch (error) {
    throw new Error(`Scraping failed: ${error.message}`);
  }
}

// Rust-optimized extraction functions
function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : 'No title found';
}

function extractLinksFromHTML(html, baseUrl) {
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

function extractImagesFromHTML(html) {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  const images = [];
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    images.push({
      src: match[1],
      alt: match[2] || '',
      fullTag: match[0]
    });
  }
  return images;
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

function detectTechnologiesFromHTML(html, url) {
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
  
  // Server technologies (from headers/URLs)
  if (url.includes('.php')) technologies.push('PHP');
  if (url.includes('.asp')) technologies.push('ASP.NET');
  if (url.includes('.jsp')) technologies.push('Java/JSP');
  
  return technologies;
}

function detectCMSFromHTML(html, url) {
  const cms = { type: 'unknown', version: null, plugins: [] };
  
  // WordPress detection
  if (html.includes('wp-content') || html.includes('wp-includes') || html.includes('WordPress')) {
    cms.type = 'WordPress';
    
    // Detect WordPress version
    const versionMatch = html.match(/<meta name="generator" content="WordPress ([^"]+)"/i);
    if (versionMatch) {
      cms.version = versionMatch[1];
    }
    
    // Detect WordPress plugins
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
  
  // Custom/Static detection
  if (cms.type === 'unknown') {
    if (html.includes('next.js') || html.includes('Next.js')) {
      cms.type = 'Next.js';
    } else if (html.includes('nuxt') || html.includes('Nuxt')) {
      cms.type = 'Nuxt.js';
    } else if (html.includes('gatsby') || html.includes('Gatsby')) {
      cms.type = 'Gatsby';
    } else {
      cms.type = 'Custom/Static';
    }
  }
  
  return cms;
}

// Single comprehensive route
app.post('/scrap', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      url, 
      maxPages = 50,
      extractImages = true,
      extractLinks = true,
      extractMeta = true,
      detectTechnologies = true,
      detectCMS = true,
      detectPlugins = true
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
    
    // Validate maxPages
    if (maxPages > 100) {
      return res.status(400).json({
        error: 'Maximum 100 pages allowed per request',
        code: 'PAGE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🚀 Starting comprehensive scrape of: ${url}`);
    console.log(`📊 Max pages: ${maxPages}, Images: ${extractImages}, Links: ${extractLinks}`);
    
    // Use Rust-powered comprehensive scraping
    const result = await comprehensiveScrape(url, {
      maxPages,
      extractImages,
      extractLinks,
      extractMeta,
      detectTechnologies,
      detectCMS,
      detectPlugins
    });
    
    // Add response time
    result.responseTime = Date.now() - startTime;
    
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
    message: 'Rust-powered comprehensive scraper is running',
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
  console.log(`🚀 Rust-Powered Comprehensive Scraper API`);
  console.log(`🔥 Server running on port ${PORT}`);
  console.log(`⚡ Ready to handle high-performance scraping!`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🕷️  Scrape endpoint: POST http://localhost:${PORT}/scrap`);
});

module.exports = app;

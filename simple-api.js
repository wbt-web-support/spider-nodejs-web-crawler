#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Website } = require('./index.js');

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
      mode = 'single', // 'single' or 'multipage'
      maxPages = 10,
      extractImagesFlag = true,
      extractLinksFlag = true,
      extractMeta = true,
      detectTechnologiesFlag = true,
      detectCMSFlag = true
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
    
    // Validate mode
    if (!['single', 'multipage'].includes(mode)) {
      return res.status(400).json({
        error: 'Mode must be either "single" or "multipage"',
        code: 'INVALID_MODE',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🚀 Starting ${mode} mode scrape of: ${url}`);
    
    // Use real Rust-based spider-rs crawler
    let pages = [];
    let allLinks = [];
    let allImages = [];
    let allMetaTags = [];
    let allTechnologies = [];
    let cms = { type: 'unknown', version: null, plugins: [] };
    
    try {
      // Create website instance with budget configuration
      const website = new Website(url).withBudget({ '*': maxPages, licenses: 0 }).build();
      
      // Collect pages during crawling
      const crawledPages = [];
      
      const onPageEvent = (err, page) => {
        if (err) {
          console.error('Page crawl error:', err);
          return;
        }
        
        console.log(`📄 Found page: ${page.url}`);
        crawledPages.push(page);
      };
      
      // Perform the actual crawling
      await website.crawl(onPageEvent);
      
      // Get all links found by the spider (like in basic.mjs)
      const spiderLinks = website.getLinks();
      console.log(`🔗 Spider found ${spiderLinks.length} total links`);
      
      // Process crawled pages
      for (const page of crawledPages) {
        const html = page.content || '';
        const pageUrl = page.url;
        const statusCode = page.status_code || 200;
        
        // Extract data for each page
        const title = extractTitle(html);
        const links = extractLinksFlag ? extractLinks(html, pageUrl) : [];
        const images = extractImagesFlag ? extractImages(html) : [];
        const metaTags = extractMeta ? extractMetaTags(html) : [];
        const technologies = detectTechnologiesFlag ? detectTechnologies(html, pageUrl) : [];
        
        // Update global collections
        allLinks.push(...links.map(l => l.href));
        allImages.push(...images.map(i => i.src));
        allMetaTags.push(...metaTags);
        allTechnologies.push(...technologies);
        
        // Detect CMS from first page
        if (pages.length === 0) {
          cms = detectCMSFlag ? detectCMS(html, pageUrl) : { type: 'unknown', version: null, plugins: [] };
        }
        
        pages.push({
          url: pageUrl,
          statusCode: statusCode,
          title: title,
          html: html,
          links: links,
          images: images,
          metaTags: metaTags,
          technologies: technologies,
          timestamp: new Date().toISOString()
        });
        
        // For single page mode, break after first page
        if (mode === 'single') {
          break;
        }
      }
      
      // Combine spider links with extracted links and remove duplicates
      allLinks = [...new Set([...allLinks, ...spiderLinks])];
      allImages = [...new Set(allImages)];
      allTechnologies = [...new Set(allTechnologies)];
      
      console.log(`✅ Crawled ${pages.length} pages successfully`);
      
      // If no pages were crawled, return empty data instead of error
      if (pages.length === 0) {
        console.log('⚠️ No pages were successfully crawled');
      }
      
    } catch (crawlError) {
      console.error('Crawling error:', crawlError);
      // Return empty data instead of throwing error
      console.log('⚠️ Crawling failed, returning empty data');
      pages = [];
      allLinks = [];
      allImages = [];
      allMetaTags = [];
      allTechnologies = [];
      cms = { type: 'unknown', version: null, plugins: [] };
    }
    
    // Create comprehensive response
    const result = {
      url: url,
      mode: mode,
      summary: {
        totalPages: pages.length,
        totalLinks: allLinks.length,
        totalImages: allImages.length,
        totalMetaTags: allMetaTags.length,
        technologiesFound: allTechnologies.length,
        cmsDetected: cms.type !== 'unknown'
      },
      pages: pages,
      extractedData: {
        links: allLinks,
        images: allImages,
        metaTags: allMetaTags,
        technologies: allTechnologies,
        cms: cms
      },
      performance: {
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        totalTime: Date.now() - startTime,
        pagesPerSecond: pages.length / ((Date.now() - startTime) / 1000)
      },
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
    
    console.log(`✅ Scraping completed in ${result.responseTime}ms`);
    console.log(`📄 Pages: ${result.summary.totalPages}, Links: ${result.summary.totalLinks}, Images: ${result.summary.totalImages}`);
    
    if (result.extractedData.technologies.length > 0) {
      console.log(`🔧 Technologies: ${result.extractedData.technologies.join(', ')}`);
    } else {
      console.log(`🔧 Technologies: None detected`);
    }
    
    if (result.extractedData.cms.type !== 'unknown') {
      console.log(`🏗️  CMS: ${result.extractedData.cms.type} ${result.extractedData.cms.version || ''}`);
    } else {
      console.log(`🏗️  CMS: None detected`);
    }
    
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

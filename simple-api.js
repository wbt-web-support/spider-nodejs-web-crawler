#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

// Try to load native module, fallback to HTTP if it fails
let Website = null;
let useNativeModule = false;

try {
  const spiderModule = require('./index.js');
  Website = spiderModule.Website;
  useNativeModule = true;
  console.log('✅ Native spider-rs module loaded successfully');
} catch (error) {
  console.log('⚠️ Native spider-rs module not available, using HTTP fallback');
  console.log('Error:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Concurrent request limiting
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 50; // Limit concurrent scraping requests
const requestQueue = [];

// Middleware to handle concurrent request limiting
function handleConcurrentRequests(req, res, next) {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    // Queue the request instead of rejecting it
    return new Promise((resolve) => {
      requestQueue.push({ req, res, next, resolve });
    });
  }
  
  activeRequests++;
  next();
  
  // Decrease counter when response is sent
  res.on('finish', () => {
    activeRequests--;
    processQueue();
  });
}

// Process queued requests
function processQueue() {
  if (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
    const { req, res, next, resolve } = requestQueue.shift();
    activeRequests++;
    resolve();
    next();
  }
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '100mb' }));

// Rate limiting - Updated for high concurrency
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute per IP (increased for concurrent users)
  message: {
    error: 'Rate limit exceeded',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
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

function extractFavicon(html, baseUrl) {
  const favicons = [];
  
  // Look for various favicon link patterns 
  const faviconRegex = /<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*>/gi;
  let match;
  
  while ((match = faviconRegex.exec(html)) !== null) {
    const linkTag = match[0];
    
    // Extract href attribute
    const hrefMatch = linkTag.match(/href=["']([^"']+)["']/i);
    if (hrefMatch) {
      let href = hrefMatch[1];
      
      // Convert relative URLs to absolute
      if (href.startsWith('/')) {
        const url = new URL(baseUrl);
        href = `${url.protocol}//${url.host}${href}`;
      } else if (!href.startsWith('http')) {
        href = new URL(href, baseUrl).href;
      }
      
      // Extract additional attributes
      const sizesMatch = linkTag.match(/sizes=["']([^"']+)["']/i);
      const typeMatch = linkTag.match(/type=["']([^"']+)["']/i);
      const relMatch = linkTag.match(/rel=["']([^"']+)["']/i);
      
      favicons.push({
        href: href,
        sizes: sizesMatch ? sizesMatch[1] : null,
        type: typeMatch ? typeMatch[1] : null,
        rel: relMatch ? relMatch[1] : 'icon',
        fullTag: linkTag
      });
    }
  }
  
  // Also check for default favicon.ico at root
  const defaultFavicon = `${new URL(baseUrl).origin}/favicon.ico`;
  
  // Check if default favicon is already in our list
  const hasDefaultFavicon = favicons.some(fav => fav.href === defaultFavicon);
  
  if (!hasDefaultFavicon) {
    favicons.push({
      href: defaultFavicon,
      sizes: null,
      type: 'image/x-icon',
      rel: 'icon',
      fullTag: null,
      isDefault: true
    });
  }
  
  return favicons;
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

// HTTP fallback functions
async function fetchPageWithAxios(url) {
  // Optimized timeouts for concurrent handling
  const timeout = process.env.NODE_ENV === 'production' ? 10000 : 15000; // Reduced timeouts
  
  const response = await axios.get(url, {
    timeout: timeout,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  });
  
  return {
    url: url,
    content: response.data,
    status_code: response.status,
    headers: response.headers
  };
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

// Single comprehensive route
app.post('/scrap', handleConcurrentRequests, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      url, 
      mode = 'single', // 'single' or 'multipage'
      maxPages = 500,
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
    
    // Determine which method to use for this specific request
    let shouldUseNativeModule = useNativeModule; // Start with global setting
    
    // For single page mode, always use HTTP fallback for better reliability
    if (mode === 'single') {
      shouldUseNativeModule = false;
    }
    
    console.log(`🔧 Using ${shouldUseNativeModule ? 'native spider-rs' : 'HTTP fallback'} method`);
    
    let pages = [];
    let allLinks = [];
    let allImages = [];
    let allMetaTags = [];
    let allTechnologies = [];
    let allFavicons = [];
    let cms = { type: 'unknown', version: null, plugins: [] };
    
    if (shouldUseNativeModule) {
      // Use real Rust-based spider-rs crawler for multipage mode
    try {
      // For multipage mode, use full budget
      const budget = { '*': maxPages, licenses: 1 };
      
      // For multipage mode, use full configuration
      let website = new Website(url).withBudget(budget);
      
      const websiteInstance = website.build();
      
      // Collect pages during crawling
      const crawledPages = [];
      
      const onPageEvent = (err, page) => {
        if (err) {
          console.error('Page crawl error:', err);
          return;
        }
        
        console.log(`📄 Found page: ${page.url}`);
        crawledPages.push(page);
        
        // For single page mode, the budget limiting will handle stopping after first page
        // We don't need to manually stop here as it prevents proper page processing
      };
      
      // Perform the actual crawling
      await websiteInstance.crawl(onPageEvent);
      
      // Get all links found by the spider (like in basic.mjs)
      const spiderLinks = websiteInstance.getLinks();
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
        const favicons = extractFavicon(html, pageUrl);
        
        // Update global collections
        allLinks.push(...links.map(l => l.href));
        allImages.push(...images.map(i => i.src));
        allMetaTags.push(...metaTags);
        allTechnologies.push(...technologies);
        allFavicons.push(...favicons);
        
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
          favicons: favicons,
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
      allFavicons = [...new Set(allFavicons.map(f => JSON.stringify(f)))].map(f => JSON.parse(f));
      
      console.log(`✅ Crawled ${pages.length} pages successfully`);
      
      // If no pages were crawled, return empty data instead of error
      if (pages.length === 0) {
        console.log('⚠️ No pages were successfully crawled');
      }
      
    } catch (crawlError) {
        console.error('Native crawling error:', crawlError);
        console.log('⚠️ Falling back to HTTP method');
        shouldUseNativeModule = false;
      }
    }
    
    if (!shouldUseNativeModule) {
      // HTTP fallback method
      try {
        console.log('🌐 Using HTTP fallback method');
        
        // Fetch the main page
        const mainPage = await fetchPageWithAxios(url);
        const html = mainPage.content;
        const pageUrl = mainPage.url;
        const statusCode = mainPage.status_code;
        
        // Extract data for the main page
        const title = extractTitle(html);
        const links = extractLinksFlag ? extractLinks(html, pageUrl) : [];
        const images = extractImagesFlag ? extractImages(html) : [];
        const metaTags = extractMeta ? extractMetaTags(html) : [];
        const technologies = detectTechnologiesFlag ? detectTechnologies(html, pageUrl) : [];
        const favicons = extractFavicon(html, pageUrl);
        const textContent = extractTextContent(html);
        
        // Update global collections
        allLinks.push(...links.map(l => l.href));
        allImages.push(...images.map(i => i.src));
        allMetaTags.push(...metaTags);
        allTechnologies.push(...technologies);
        allFavicons.push(...favicons);
        
        // Detect CMS
        cms = detectCMSFlag ? detectCMS(html, pageUrl) : { type: 'unknown', version: null, plugins: [] };
        
        pages.push({
          url: pageUrl,
          statusCode: statusCode,
          title: title,
          html: html,
          content: textContent,
          links: links,
          images: images,
          metaTags: metaTags,
          technologies: technologies,
          favicons: favicons,
          timestamp: new Date().toISOString()
        });
        
          // For multipage mode, try to crawl additional pages
        if (mode === 'multipage' && pages.length < maxPages) {
          // Function to collect all internal links from pages
          function collectInternalLinks(pages) {
            let allLinks = [];
            for (const page of pages) {
              if (page.links && page.links.length > 0) {
                allLinks.push(...page.links);
              }
            }
            return allLinks
              .filter(link => !link.isExternal && link.href && link.href.startsWith('http'))
              .map(link => link.href)
              .filter((href, index, self) => self.indexOf(href) === index); // Remove duplicates
          }
          
          // Initial collection of links
          let internalLinks = collectInternalLinks(pages);
          console.log(`🔗 Found ${internalLinks.length} internal links to crawl (from ${pages.length} pages)`);
          
          // Check if this is GitHub (more aggressive rate limiting)
          const isGitHub = url.includes('github.com');
          if (isGitHub) {
            console.log('🐙 GitHub detected - using conservative crawling strategy');
          }
          
          let successCount = 0;
          let errorCount = 0;
          const maxErrors = Math.min(maxPages * 0.3, 100); // 30% of maxPages or 100, whichever is smaller
          const retryAttempts = isGitHub ? 3 : 2; // More retries for GitHub
          const startTime = Date.now();
          const maxCrawlTime = process.env.NODE_ENV === 'production' ? 300000 : 600000; // 5 min in prod, 10 min locally (reduced for concurrency)
          
          // Track visited pages to avoid duplicates
          const visitedPages = new Set();
          
          // Function to normalize URLs for comparison
          function normalizeUrl(url) {
            try {
              const urlObj = new URL(url);
              // Remove trailing slash, normalize path, remove common query params that don't affect content
              let normalized = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
              if (normalized.endsWith('/') && normalized !== `${urlObj.protocol}//${urlObj.hostname}/`) {
                normalized = normalized.slice(0, -1);
              }
              return normalized.toLowerCase();
            } catch (e) {
              return url.toLowerCase();
            }
          }
          
          visitedPages.add(normalizeUrl(url)); // Add the main page
          
          for (const linkUrl of internalLinks) {
            if (pages.length >= maxPages) {
              console.log(`✅ Reached max pages limit: ${maxPages}`);
              break;
            }
            
            if (errorCount >= maxErrors) {
              console.log(`⚠️ Too many errors (${errorCount}), stopping crawl`);
              break;
            }
            
            // Check if we've exceeded the maximum crawl time
            if (Date.now() - startTime > maxCrawlTime) {
              console.log(`⏰ Maximum crawl time exceeded (${Math.round(maxCrawlTime / 1000)}s), stopping crawl`);
              break;
            }
            
            // Normalize the URL for comparison
            const normalizedUrl = normalizeUrl(linkUrl);
            
            // Skip if we've already visited this page
            if (visitedPages.has(normalizedUrl)) {
              console.log(`⏭️ Skipping already visited page: ${linkUrl} (normalized: ${normalizedUrl})`);
              continue;
            }
            
            // Mark this page as visited
            visitedPages.add(normalizedUrl);
            
            let pageCrawled = false;
            let lastError = null;
            
            // Retry mechanism for failed pages
            for (let attempt = 1; attempt <= retryAttempts && !pageCrawled; attempt++) {
              try {
                if (attempt > 1) {
                  console.log(`🔄 Retry attempt ${attempt}/${retryAttempts} for: ${linkUrl}`);
                  // Removed retry delay for faster processing
                } else {
                  console.log(`📄 Crawling page ${pages.length + 1}/${maxPages}: ${linkUrl}`);
                  console.log(`📊 Progress: ${successCount} success, ${errorCount} errors, ${Math.round((Date.now() - startTime) / 1000)}s elapsed`);
                }
                
                // Removed delay between requests for faster scraping
                
                  const additionalPage = await fetchPageWithAxios(linkUrl);
                const addHtml = additionalPage.content;
                const addPageUrl = additionalPage.url;
                const addStatusCode = additionalPage.status_code;
                
                // Skip if page is too large (memory protection) - Reduced for concurrency
                if (addHtml.length > 2 * 1024 * 1024) { // 2MB limit (reduced from 5MB for better concurrency)
                  console.log(`⚠️ Skipping large page: ${addPageUrl} (${Math.round(addHtml.length / 1024 / 1024)}MB)`);
                  pageCrawled = true; // Mark as processed to skip retries
                  continue;
                }
                
                const addTitle = extractTitle(addHtml);
                const addLinks = extractLinksFlag ? extractLinks(addHtml, addPageUrl) : [];
                const addImages = extractImagesFlag ? extractImages(addHtml) : [];
                const addMetaTags = extractMeta ? extractMetaTags(addHtml) : [];
                const addTechnologies = detectTechnologiesFlag ? detectTechnologies(addHtml, addPageUrl) : [];
                const addFavicons = extractFavicon(addHtml, addPageUrl);
                const addTextContent = extractTextContent(addHtml);
                
                // Update global collections
                allLinks.push(...addLinks.map(l => l.href));
                allImages.push(...addImages.map(i => i.src));
                allMetaTags.push(...addMetaTags);
                allTechnologies.push(...addTechnologies);
                allFavicons.push(...addFavicons);
                
                pages.push({
                  url: addPageUrl,
                  statusCode: addStatusCode,
                  title: addTitle,
                  html: addHtml,
                  content: addTextContent,
                  links: addLinks,
                  images: addImages,
                  metaTags: addMetaTags,
                  technologies: addTechnologies,
                  favicons: addFavicons,
                  timestamp: new Date().toISOString()
                });
                
                successCount++;
                pageCrawled = true;
                console.log(`✅ Successfully crawled: ${addPageUrl}`);
                
                // Dynamically collect more links from newly crawled pages
                if (addLinks && addLinks.length > 0) {
                  const newLinks = addLinks
                    .filter(link => !link.isExternal && link.href && link.href.startsWith('http'))
                    .map(link => link.href)
                    .filter(href => !visitedPages.has(normalizeUrl(href)));
                  
                  if (newLinks.length > 0) {
                    internalLinks.push(...newLinks);
                    console.log(`🔗 Added ${newLinks.length} new links from ${addPageUrl}`);
                  }
                }
                
              } catch (error) {
                lastError = error;
                console.error(`❌ Error crawling ${linkUrl} (attempt ${attempt}):`, error.message);
                
                // Log specific error types
                if (error.code === 'ECONNABORTED') {
                  console.log('⏰ Request timeout - likely rate limited');
                } else if (error.response?.status === 429) {
                  console.log('🚫 Rate limited by server - will retry with longer delay');
                  // For rate limiting, wait longer before retry
                  if (attempt < retryAttempts) {
                    // Removed rate limit delay for faster processing
                  }
                } else if (error.response?.status >= 400) {
                  console.log(`🚫 HTTP error: ${error.response.status}`);
                }
                
                // If this was the last attempt, count it as an error
                if (attempt === retryAttempts) {
                  errorCount++;
                  console.log(`💥 Final attempt failed for: ${linkUrl}`);
                }
              }
            }
          }
          
          console.log(`📊 Crawl summary: ${successCount} successful, ${errorCount} errors, ${pages.length} total pages`);
          console.log(`⏱️ Total crawl time: ${Math.round((Date.now() - startTime) / 1000)}s`);
          console.log(`🔗 Links processed: ${internalLinks.length} available, ${pages.length - 1} crawled, ${visitedPages.size - 1} unique pages visited`);
          console.log(`🔄 Duplicate pages skipped: ${internalLinks.length - (pages.length - 1)}`);
          
          // Log why crawling stopped
          if (pages.length >= maxPages) {
            console.log(`🛑 Stopped: Reached max pages limit (${maxPages})`);
          } else if (errorCount >= maxErrors) {
            console.log(`🛑 Stopped: Too many errors (${errorCount}/${maxErrors})`);
          } else if (Date.now() - startTime > maxCrawlTime) {
            console.log(`🛑 Stopped: Timeout exceeded (${Math.round(maxCrawlTime / 1000)}s)`);
          } else if (pages.length < internalLinks.length) {
            console.log(`🛑 Stopped: No more valid links to crawl`);
          }
        }
        
        // Remove duplicates
        allLinks = [...new Set(allLinks)];
        allImages = [...new Set(allImages)];
        allTechnologies = [...new Set(allTechnologies)];
        allFavicons = [...new Set(allFavicons.map(f => JSON.stringify(f)))].map(f => JSON.parse(f));
        
        console.log(`✅ HTTP fallback crawled ${pages.length} pages successfully`);
        
      } catch (httpError) {
        console.error('HTTP fallback error:', httpError);
        console.log('⚠️ Both native and HTTP methods failed');
      pages = [];
      allLinks = [];
      allImages = [];
      allMetaTags = [];
      allTechnologies = [];
      allFavicons = [];
      cms = { type: 'unknown', version: null, plugins: [] };
      }
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
        totalFavicons: allFavicons.length,
        technologiesFound: allTechnologies.length,
        technologies: allTechnologies,
        favicons: allFavicons,
        cmsDetected: cms.type !== 'unknown'
      },
      pages: pages,
      extractedData: {
        links: allLinks,
        images: allImages,
        metaTags: allMetaTags,
        technologies: allTechnologies,
        favicons: allFavicons,
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
    console.log(`📄 Pages: ${result.summary.totalPages}, Links: ${result.summary.totalLinks}, Images: ${result.summary.totalImages}, Favicons: ${result.summary.totalFavicons}`);
    
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
// get filtered images only


// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Comprehensive scraper API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Status endpoint to monitor concurrent requests
app.get('/status', (req, res) => {
  res.json({
    status: 'OK',
    activeRequests: activeRequests,
    maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
    queuedRequests: requestQueue.length,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
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

#!/usr/bin/env node

const { Website, Page, crawl } = require('@spider-rs/spider-rs');
const fs = require('fs');
const path = require('path');

console.log('🕷️  Scraping NJ Design Park Website\n');

// Create output directory
const outputDir = './scraped-data';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Function to extract images from HTML
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

// Function to extract links from HTML
function extractLinks(html, baseUrl) {
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  const links = [];
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim(); // Remove HTML tags from link text
    
    // Convert relative URLs to absolute
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
      fullTag: match[0]
    });
  }
  
  return links;
}

// Function to clean and format HTML
function cleanHtml(html) {
  return html
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/>\s+</g, '><') // Remove spaces between tags
    .trim();
}

// Main scraping function
async function scrapeNJDesignPark() {
  try {
    console.log('🚀 Starting comprehensive scrape of https://njdesignpark.com\n');
    
    // Create website instance with budget
    const website = new Website('https://njdesignpark.com')
      .withBudget({
        '*': 20, // Limit to 20 pages total
        '/': 5   // Limit to 5 pages from root
      })
      .withHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      })
      .build();
    
    const scrapedData = {
      pages: [],
      allLinks: new Set(),
      allImages: new Set(),
      summary: {
        totalPages: 0,
        totalLinks: 0,
        totalImages: 0,
        startTime: new Date().toISOString(),
        endTime: null
      }
    };
    
    // Page event handler
    const onPageEvent = async (err, page) => {
      if (err) {
        console.log(`❌ Error on page: ${err.message}`);
        return;
      }
      
      console.log(`📄 Processing: ${page.url} (Status: ${page.statusCode})`);
      
      const html = page.content;
      const links = extractLinks(html, page.url);
      const images = extractImages(html);
      
      // Add to scraped data
      const pageData = {
        url: page.url,
        statusCode: page.statusCode,
        title: extractTitle(html),
        html: cleanHtml(html),
        links: links,
        images: images,
        timestamp: new Date().toISOString()
      };
      
      scrapedData.pages.push(pageData);
      
      // Add to global collections
      links.forEach(link => scrapedData.allLinks.add(link.href));
      images.forEach(img => scrapedData.allImages.add(img.src));
      
      console.log(`   ✅ Found ${links.length} links and ${images.length} images`);
    };
    
    // Start crawling
    console.log('🕷️  Starting crawl...\n');
    await website.crawl(onPageEvent);
    
    // Update summary
    scrapedData.summary.totalPages = scrapedData.pages.length;
    scrapedData.summary.totalLinks = scrapedData.allLinks.size;
    scrapedData.summary.totalImages = scrapedData.allImages.size;
    scrapedData.summary.endTime = new Date().toISOString();
    
    // Save results
    console.log('\n💾 Saving results...');
    
    // Save complete data as JSON
    fs.writeFileSync(
      path.join(outputDir, 'complete-data.json'),
      JSON.stringify(scrapedData, null, 2)
    );
    
    // Save HTML files for each page
    scrapedData.pages.forEach((page, index) => {
      const filename = `page-${index + 1}-${page.url.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
      fs.writeFileSync(
        path.join(outputDir, filename),
        page.html
      );
    });
    
    // Save links as text file
    const linksText = Array.from(scrapedData.allLinks).join('\n');
    fs.writeFileSync(
      path.join(outputDir, 'all-links.txt'),
      linksText
    );
    
    // Save images as text file
    const imagesText = Array.from(scrapedData.allImages).join('\n');
    fs.writeFileSync(
      path.join(outputDir, 'all-images.txt'),
      imagesText
    );
    
    // Save summary
    fs.writeFileSync(
      path.join(outputDir, 'summary.json'),
      JSON.stringify(scrapedData.summary, null, 2)
    );
    
    // Print summary
    console.log('\n📊 SCRAPING SUMMARY');
    console.log('==================');
    console.log(`📄 Total Pages Scraped: ${scrapedData.summary.totalPages}`);
    console.log(`🔗 Total Unique Links: ${scrapedData.summary.totalLinks}`);
    console.log(`🖼️  Total Unique Images: ${scrapedData.summary.totalImages}`);
    console.log(`⏱️  Start Time: ${scrapedData.summary.startTime}`);
    console.log(`⏱️  End Time: ${scrapedData.summary.endTime}`);
    
    console.log('\n📁 Files saved to ./scraped-data/');
    console.log('   - complete-data.json (all data)');
    console.log('   - page-*.html (individual HTML files)');
    console.log('   - all-links.txt (all links)');
    console.log('   - all-images.txt (all images)');
    console.log('   - summary.json (summary statistics)');
    
    // Show sample links and images
    console.log('\n🔗 Sample Links:');
    Array.from(scrapedData.allLinks).slice(0, 10).forEach(link => {
      console.log(`   - ${link}`);
    });
    
    console.log('\n🖼️  Sample Images:');
    Array.from(scrapedData.allImages).slice(0, 10).forEach(img => {
      console.log(`   - ${img}`);
    });
    
  } catch (error) {
    console.error('❌ Scraping failed:', error.message);
  }
}

// Function to extract title from HTML
function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : 'No title found';
}

// Run the scraper
scrapeNJDesignPark();

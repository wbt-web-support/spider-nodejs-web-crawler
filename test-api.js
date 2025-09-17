#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testComprehensiveScraper() {
  console.log('🧪 Testing Comprehensive Scraper API\n');
  
  try {
    // Test health check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);
    
    // Test comprehensive scraping
    console.log('\n2. Testing comprehensive scraping...');
    const scrapeResponse = await axios.post(`${API_BASE}/scrap`, {
      url: 'https://njdesignpark.com',
      maxPages: 5,
      extractImages: true,
      extractLinks: true,
      extractMeta: true,
      detectTechnologies: true,
      detectCMS: true,
      detectPlugins: true
    });
    
    const data = scrapeResponse.data;
    
    console.log('✅ Scraping completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Pages scraped: ${data.summary.totalPages}`);
    console.log(`   - Total links: ${data.summary.totalLinks}`);
    console.log(`   - Total images: ${data.summary.totalImages}`);
    console.log(`   - Meta tags: ${data.summary.totalMetaTags}`);
    console.log(`   - Technologies found: ${data.summary.technologiesFound}`);
    console.log(`   - CMS detected: ${data.summary.cmsDetected}`);
    console.log(`   - Response time: ${data.responseTime}ms`);
    
    console.log(`\n🔧 Technologies detected:`);
    data.technologies.forEach(tech => console.log(`   - ${tech}`));
    
    console.log(`\n🏗️  CMS Information:`);
    console.log(`   - Type: ${data.cms.type}`);
    if (data.cms.version) console.log(`   - Version: ${data.cms.version}`);
    if (data.cms.plugins.length > 0) {
      console.log(`   - Plugins: ${data.cms.plugins.join(', ')}`);
    }
    
    console.log(`\n🔗 Sample links:`);
    data.allLinks.slice(0, 5).forEach(link => console.log(`   - ${link}`));
    
    console.log(`\n🖼️  Sample images:`);
    data.allImages.slice(0, 5).forEach(img => console.log(`   - ${img}`));
    
    console.log(`\n📄 Sample pages:`);
    data.pages.slice(0, 3).forEach((page, index) => {
      console.log(`   ${index + 1}. ${page.url} (${page.statusCode})`);
      console.log(`      Title: ${page.title}`);
      console.log(`      Links: ${page.links ? page.links.length : 0}`);
      console.log(`      Images: ${page.images ? page.images.length : 0}`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testComprehensiveScraper();

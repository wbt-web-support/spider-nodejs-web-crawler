#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📊 Analyzing Scraped Data from NJ Design Park\n');

// Load the complete data
const data = JSON.parse(fs.readFileSync('./scraped-data/complete-data.json', 'utf8'));

console.log('🎯 WEBSITE ANALYSIS SUMMARY');
console.log('==========================');
console.log(`📄 Total Pages: ${data.summary.totalPages}`);
console.log(`🔗 Total Unique Links: ${data.summary.totalLinks}`);
console.log(`🖼️  Total Unique Images: ${data.summary.totalImages}`);
console.log(`⏱️  Scraping Duration: ${new Date(data.summary.endTime) - new Date(data.summary.startTime)}ms`);

console.log('\n📄 PAGE BREAKDOWN');
console.log('=================');
data.pages.forEach((page, index) => {
  console.log(`${index + 1}. ${page.url}`);
  console.log(`   Status: ${page.statusCode} | Links: ${page.links.length} | Images: ${page.images.length}`);
  console.log(`   Title: ${page.title}`);
  console.log('');
});

console.log('🔗 ALL UNIQUE LINKS');
console.log('===================');
Array.from(data.allLinks).forEach((link, index) => {
  console.log(`${index + 1}. ${link}`);
});

console.log('\n🖼️  ALL UNIQUE IMAGES');
console.log('====================');
Array.from(data.allImages).forEach((img, index) => {
  console.log(`${index + 1}. ${img}`);
});

// Analyze link types
console.log('\n📈 LINK ANALYSIS');
console.log('================');
const internalLinks = Array.from(data.allLinks).filter(link => 
  link.includes('njdesignpark.com') || link.startsWith('/')
);
const externalLinks = Array.from(data.allLinks).filter(link => 
  !link.includes('njdesignpark.com') && !link.startsWith('/')
);

console.log(`Internal Links: ${internalLinks.length}`);
console.log(`External Links: ${externalLinks.length}`);

// Analyze image types
console.log('\n🖼️  IMAGE ANALYSIS');
console.log('==================');
const imageExtensions = {};
Array.from(data.allImages).forEach(img => {
  const ext = path.extname(img).toLowerCase();
  imageExtensions[ext] = (imageExtensions[ext] || 0) + 1;
});

Object.entries(imageExtensions).forEach(([ext, count]) => {
  console.log(`${ext || 'no extension'}: ${count} images`);
});

// Show sample HTML content
console.log('\n📄 SAMPLE HTML CONTENT (First 500 chars)');
console.log('=========================================');
if (data.pages.length > 0) {
  console.log(data.pages[0].html.substring(0, 500) + '...');
}

console.log('\n✅ Analysis complete! Check the scraped-data folder for all files.');

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get page number from command line argument
const pageNumber = process.argv[2] || '1';

console.log(`📄 Viewing HTML for Page ${pageNumber}\n`);

try {
  // Find the HTML file for the specified page
  const files = fs.readdirSync('./scraped-data/')
    .filter(file => file.startsWith(`page-${pageNumber}-`))
    .filter(file => file.endsWith('.html'));
  
  if (files.length === 0) {
    console.log(`❌ No HTML file found for page ${pageNumber}`);
    console.log('Available pages:');
    const allFiles = fs.readdirSync('./scraped-data/')
      .filter(file => file.startsWith('page-') && file.endsWith('.html'))
      .sort();
    
    allFiles.forEach((file, index) => {
      const pageNum = file.match(/page-(\d+)-/)[1];
      console.log(`  ${pageNum}. ${file}`);
    });
    process.exit(1);
  }
  
  const htmlFile = files[0];
  const htmlContent = fs.readFileSync(path.join('./scraped-data', htmlFile), 'utf8');
  
  console.log(`📁 File: ${htmlFile}`);
  console.log(`📏 Size: ${htmlContent.length} characters\n`);
  console.log('📄 HTML Content:');
  console.log('================');
  console.log(htmlContent);
  
} catch (error) {
  console.error('❌ Error:', error.message);
}

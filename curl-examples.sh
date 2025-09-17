#!/bin/bash

echo "🧪 Comprehensive Scraper API - cURL Examples"
echo "============================================="

# Health check
echo -e "\n1. Health Check:"
echo "curl -X GET http://localhost:3000/health"
curl -X GET http://localhost:3000/health

echo -e "\n\n2. Basic Scraping (NJ Design Park):"
echo "curl -X POST http://localhost:3000/scrap \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"url\": \"https://njdesignpark.com\", \"maxPages\": 5}'"

curl -X POST http://localhost:3000/scrap \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://njdesignpark.com",
    "maxPages": 5,
    "extractImages": true,
    "extractLinks": true,
    "extractMeta": true,
    "detectTechnologies": true,
    "detectCMS": true,
    "detectPlugins": true
  }'

echo -e "\n\n3. High-Performance Scraping (More Pages):"
echo "curl -X POST http://localhost:3000/scrap \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"url\": \"https://example.com\", \"maxPages\": 20}'"

curl -X POST http://localhost:3000/scrap \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "maxPages": 20,
    "extractImages": true,
    "extractLinks": true,
    "extractMeta": true,
    "detectTechnologies": true,
    "detectCMS": true,
    "detectPlugins": true
  }'

echo -e "\n\n4. WordPress Site Detection:"
echo "curl -X POST http://localhost:3000/scrap \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"url\": \"https://wordpress.org\", \"maxPages\": 10}'"

curl -X POST http://localhost:3000/scrap \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://wordpress.org",
    "maxPages": 10,
    "extractImages": true,
    "extractLinks": true,
    "extractMeta": true,
    "detectTechnologies": true,
    "detectCMS": true,
    "detectPlugins": true
  }'

echo -e "\n\n✅ All examples completed!"

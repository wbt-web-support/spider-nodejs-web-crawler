# /scrapImagesOnly API - Curl Examples

## Basic Single Page Image Scraping

```bash
curl -X POST http://localhost:3000/scrapImagesOnly \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "mode": "single"
  }'
```

## Multipage Image Scraping

```bash
curl -X POST http://localhost:3000/scrapImagesOnly \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "mode": "multipage",
    "maxPages": 10
  }'
```

## Advanced Configuration

```bash
curl -X POST http://localhost:3000/scrapImagesOnly \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "mode": "multipage",
    "maxPages": 50,
    "extractImagesFlag": true
  }'
```

## GitHub Repository Image Scraping

```bash
curl -X POST http://localhost:3000/scrapImagesOnly \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com/microsoft/vscode",
    "mode": "multipage",
    "maxPages": 20
  }'
```

## E-commerce Site Image Scraping

```bash
curl -X POST http://localhost:3000/scrapImagesOnly \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://shop.example.com",
    "mode": "multipage",
    "maxPages": 100
  }'
```

## News Website Image Scraping

```bash
curl -X POST http://localhost:3000/scrapImagesOnly \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://news.example.com",
    "mode": "multipage",
    "maxPages": 30
  }'
```

## Portfolio Website Image Scraping

```bash
curl -X POST http://localhost:3000/scrapImagesOnly \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://portfolio.example.com",
    "mode": "single"
  }'
```

## Response Format

The API returns a JSON response with the following structure:

```json
{
  "url": "https://example.com",
  "mode": "single",
  "summary": {
    "totalPages": 1,
    "totalImages": 15
  },
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.png",
    "https://example.com/image3.gif"
  ],
  "pages": [
    {
      "url": "https://example.com",
      "statusCode": 200,
      "title": "Page Title",
      "images": [
        {
          "src": "https://example.com/image1.jpg",
          "alt": "Image description",
          "width": "800",
          "height": "600"
        }
      ],
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ],
  "performance": {
    "startTime": "2024-01-01T00:00:00.000Z",
    "endTime": "2024-01-01T00:00:00.000Z",
    "totalTime": 1500,
    "pagesPerSecond": 0.67
  },
  "responseTime": 1500,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | The URL to scrape images from |
| `mode` | string | "single" | "single" or "multipage" |
| `maxPages` | number | 500 | Maximum number of pages to crawl (multipage mode) |
| `extractImagesFlag` | boolean | true | Whether to extract images |

## Error Responses

### Missing URL
```json
{
  "error": "URL is required",
  "code": "MISSING_URL",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Invalid URL
```json
{
  "error": "Invalid URL format",
  "code": "INVALID_URL",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Invalid Mode
```json
{
  "error": "Mode must be either \"single\" or \"multipage\"",
  "code": "INVALID_MODE",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Scraping Error
```json
{
  "error": "Scraping failed",
  "message": "Error details",
  "code": "SCRAPING_ERROR",
  "responseTime": 1500,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Testing with Different Ports

If your server runs on a different port, replace `3000` with your actual port:

```bash
# For port 8080
curl -X POST http://localhost:8080/scrapImagesOnly \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "mode": "single"}'

# For port 5000
curl -X POST http://localhost:5000/scrapImagesOnly \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "mode": "single"}'
```

## Pretty Print Response

To format the JSON response nicely, pipe to `jq`:

```bash
curl -X POST http://localhost:3000/scrapImagesOnly \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "mode": "single"}' | jq '.'
```

## Save Response to File

```bash
curl -X POST http://localhost:3000/scrapImagesOnly \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "mode": "multipage", "maxPages": 10}' \
  -o images_response.json
```

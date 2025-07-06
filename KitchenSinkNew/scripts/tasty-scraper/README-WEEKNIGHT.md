# Weeknight Recipe Scraper

This enhanced version of the Tasty scraper is specifically designed to scrape the 3000+ recipes from the [Tasty Weeknight tag](https://tasty.co/tag/weeknight) while maintaining respectful batch processing to avoid getting blocked.

## Features

- **Large-scale scraping**: Configured to handle 3000+ recipes
- **Targeted scraping**: Specifically targets the weeknight tag
- **Pagination support**: Automatically handles infinite scroll and pagination
- **Batch processing**: Maintains 5 recipes per batch with delays
- **Respectful scraping**: Built-in delays to avoid overwhelming the server
- **Resume capability**: Can resume from where it left off if interrupted

## Quick Start

### 1. Run the Weeknight Scraper

```bash
# Full scrape of weeknight recipes (up to 3000)
npm run scrape:weeknight

# Dry run to test without saving (recommended first)
npm run scrape:weeknight:dry-run

# Fast mode (skip image uploads for faster processing)
npm run scrape:weeknight:fast
```

### 2. Manual Configuration

You can also run the scraper directly with custom options:

```bash
cd scripts/tasty-scraper

# Basic weeknight scrape
node run-weeknight-scraper.js

# Test with smaller limit
node run-weeknight-scraper.js --limit 100 --dry-run

# Skip images for faster processing
node run-weeknight-scraper.js --skip-images

# Debug mode for troubleshooting
node run-weeknight-scraper.js --debug
```

## Configuration

The scraper uses the following default configuration for weeknight scraping:

```javascript
MAX_RECIPES: 3000          // Target up to 3000 recipes
TARGET_TAG: 'weeknight'    // Focus on weeknight tag
BATCH_SIZE: 5              // 5 recipes per batch
DELAY_BETWEEN_BATCHES: 5s  // 5 second delay between batches
DELAY_BETWEEN_RECIPES: 2s  // 2 second delay between recipes
```

## How It Works

1. **URL Collection**: The scraper visits `https://tasty.co/tag/weeknight` and uses infinite scroll to collect recipe URLs
2. **Pagination**: Automatically scrolls and loads more content until it reaches the limit or no new URLs are found
3. **Batch Processing**: Processes recipes in batches of 5 with delays between batches
4. **Data Extraction**: Extracts recipe data using both JSON-LD structured data and CSS selectors
5. **Storage**: Saves recipes to Firestore with automatic duplicate detection

## Performance Expectations

- **Time**: Approximately 2-4 hours for 3000 recipes (depending on network and server response)
- **Batch Rate**: ~1 batch per 30 seconds (including processing time)
- **Success Rate**: Typically 95%+ success rate with automatic retry logic

## Monitoring Progress

The scraper provides detailed progress information:

```
🌙 Starting Weeknight Recipe Scraper
📝 Step 1: Fetching recipe URLs...
Strategy 1: Targeting specific tag: weeknight
Loading page 1 of weeknight tag (current URLs: 0)
Found 20 new URLs on page 1
Loading page 2 of weeknight tag (current URLs: 20)
...
✅ Found 3000 recipe URLs
🎯 Target: weeknight tag

🍳 Step 2: Processing recipes...
📦 Processing batch 1/600
✅ Recipe saved successfully: Easy Weeknight Pasta
...
```

## Troubleshooting

### Common Issues

1. **Rate Limited**: If you get rate limited, the scraper will automatically retry with exponential backoff
2. **Network Issues**: The scraper has built-in timeout and retry logic
3. **Duplicates**: Automatic duplicate detection prevents re-scraping existing recipes

### Debug Mode

Enable debug mode for detailed troubleshooting:

```bash
node run-weeknight-scraper.js --debug
```

This will:
- Save failed page content for analysis
- Provide detailed extraction logs
- Show network request details

## Environment Variables

You can customize the scraper by setting environment variables:

```bash
export MAX_RECIPES=1000
export BATCH_SIZE=3
export DELAY_BETWEEN_BATCHES=10000
export TARGET_TAG=weeknight
export SKIP_IMAGE_UPLOAD=true
export DRY_RUN=true

npm run scrape:tasty
```

## Resuming Interrupted Scrapes

The scraper automatically skips recipes that already exist in your database, so you can safely restart if interrupted. It will continue from where it left off.

## Best Practices

1. **Start with dry run**: Always test with `--dry-run` first
2. **Monitor progress**: Watch the console output for any issues
3. **Use appropriate limits**: Start with smaller limits for testing
4. **Respect the server**: Don't modify delays to be too aggressive
5. **Check Firebase quota**: Ensure you have sufficient Firestore write quota

## Results

After a successful run, you'll see statistics like:

```
✅ Scraping completed!
📊 Results:
   Successful: 2847
   Failed: 23
   Skipped: 130
   Duplicates removed: 0

📈 Database stats:
   Total recipes: 3000
   Tasty recipes: 2847 (94.9%)
   Recently scraped: 2847
``` 
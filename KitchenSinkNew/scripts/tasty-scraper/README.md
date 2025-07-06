# Tasty Recipe Scraper

A comprehensive scraper system for extracting recipes from Tasty.co and saving them to Firebase/Firestore.

## Features

- 🔍 **Index Scraping**: Automatically discovers recipe URLs from Tasty.co
- 🍳 **Recipe Extraction**: Extracts comprehensive recipe data including ingredients, instructions, images, and metadata
- 📁 **Image Upload**: Downloads and uploads recipe images to Firebase Storage
- 🔥 **Firebase Integration**: Saves recipes to Firestore in your app's format
- 📊 **Statistics & Monitoring**: Track scraping progress and database stats
- 🧹 **Duplicate Management**: Automatically detects and removes duplicate recipes
- ⚡ **Batch Processing**: Processes recipes in batches with rate limiting
- 🛡️ **Error Handling**: Robust error handling with detailed logging

## Prerequisites

1. **Node.js** (version 14+)
2. **Firebase Admin SDK** credentials
3. **Firebase Storage** bucket configured
4. **Playwright** for browser automation

## Setup

### 1. Install Dependencies

From the KitchenSinkNew directory:

```bash
npm install
```

### 2. Firebase Configuration

1. Go to your Firebase Console
2. Navigate to Project Settings > Service Accounts
3. Generate a new private key (JSON file)
4. Save the JSON file securely (e.g., `firebase-service-account.json`)

### 3. Environment Configuration

1. Copy the example environment file:
   ```bash
   cp scripts/tasty-scraper/.env.example scripts/tasty-scraper/.env
   ```

2. Edit the `.env` file:
   ```bash
   # Firebase Configuration
   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/firebase-service-account.json
   FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   
   # Scraping Configuration
   MAX_RECIPES=50
   BATCH_SIZE=5
   DELAY_BETWEEN_BATCHES=5000
   DELAY_BETWEEN_RECIPES=2000
   
   # Options
   SKIP_IMAGE_UPLOAD=false
   DRY_RUN=false
   ```

### 4. Install Playwright Browsers

```bash
npx playwright install chromium
```

## Usage

### Quick Start

1. **Test the scraper** (recommended first step):
   ```bash
   npm run scrape:tasty:test
   ```

2. **Run a small scraping session**:
   ```bash
   MAX_RECIPES=10 npm run scrape:tasty
   ```

3. **Full scraping session**:
   ```bash
   npm run scrape:tasty
   ```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run scrape:tasty` | Run the full scraper |
| `npm run scrape:tasty:test` | Test scraper on 3 sample recipes |
| `npm run scrape:tasty:verify` | Verify scraped recipes exist in Firestore |
| `npm run scrape:tasty:stats` | Show current database statistics |
| `npm run scrape:tasty:cleanup` | Remove duplicate recipes |

### Environment Variables

You can override any configuration via environment variables:

```bash
# Scrape only 20 recipes with image upload disabled
MAX_RECIPES=20 SKIP_IMAGE_UPLOAD=true npm run scrape:tasty

# Dry run (no actual saving to database)
DRY_RUN=true npm run scrape:tasty

# Smaller batches with longer delays
BATCH_SIZE=3 DELAY_BETWEEN_BATCHES=10000 npm run scrape:tasty
```

## Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_RECIPES` | 50 | Maximum recipes to scrape |
| `BATCH_SIZE` | 5 | Number of recipes to process simultaneously |
| `DELAY_BETWEEN_BATCHES` | 5000 | Delay in ms between batches |
| `DELAY_BETWEEN_RECIPES` | 2000 | Delay in ms between individual recipes |
| `SKIP_IMAGE_UPLOAD` | false | Skip downloading/uploading images |
| `DRY_RUN` | false | Test mode - don't save to database |

## Recipe Data Structure

The scraper extracts and converts recipes to match your app's `Recipe` interface:

```typescript
{
  id: string;              // Generated from URL
  name: string;            // Recipe title
  description: string;     // Recipe description
  prepTime: string;        // Preparation time
  cookTime: string;        // Cooking time
  servings: number;        // Number of servings
  ingredients: {           // Parsed ingredients
    item: string;
    measurement: string;
  }[];
  instructions: string[];  // Step-by-step instructions
  imageUrl?: string;       // Uploaded image URL
  tags: string[];          // Auto-generated tags
  estimatedCost: number;   // Estimated cost in dollars
  source: 'tasty.co';      // Source identifier
  sourceUrl: string;       // Original URL
}
```

## Auto-Generated Tags

The scraper intelligently generates tags based on:

- **Meal Types**: breakfast, lunch, dinner, snacks
- **Dietary**: vegetarian, vegan (based on ingredients)
- **Cuisine**: italian, mexican, asian, indian
- **Cooking Method**: baked, grilled, fried
- **Source**: tasty

## Monitoring & Statistics

### View Current Stats
```bash
npm run scrape:tasty:stats
```

Example output:
```
📊 Current scraping statistics:
{
  totalRecipes: 1247,
  tastyRecipes: 156,
  recentlyScraped: 23,
  tastyPercentage: '12.5'
}
```

### Cleanup Duplicates
```bash
npm run scrape:tasty:cleanup
```

### Verify Scraped Recipes
Test that scraped recipes exist in Firestore:
```bash
npm run scrape:tasty:verify
```

This verification test:
- Scrapes the first 10 recipe URLs from Tasty.co
- Checks if each recipe exists in your Firestore database
- Provides detailed results showing which recipes are found/missing
- Useful for validating your scraping pipeline integrity

Example output:
```
🧪 Running Recipe Verification Test
═══════════════════════════════════════════════════════════
This test will:
1. Scrape the first 10 recipe URLs from Tasty.co
2. Check if each recipe exists in Firestore
3. Report which recipes are found/missing
═══════════════════════════════════════════════════════════

📋 Step 1: Scraping first 10 recipe URLs...
✅ Successfully scraped 10 URLs

📝 URLs being tested:
  1. https://tasty.co/recipe/chicken-teriyaki-bowls
  2. https://tasty.co/recipe/one-pot-pasta-primavera
  ...

🔍 Step 2: Checking recipes in Firestore...
  [1/10] Checking: chicken-teriyaki-bowls...
    ✅ FOUND - Recipe exists in Firestore
  [2/10] Checking: one-pot-pasta-primavera...
    ✅ FOUND - Recipe exists in Firestore
  ...

📊 TEST RESULTS SUMMARY
═══════════════════════════════════════════════════════
Total URLs tested: 10
Recipes found in Firestore: 10
Recipes missing from Firestore: 0
Success rate: 100.0%

🎯 TEST ASSERTION
═══════════════════════════════════════════════════════
✅ TEST PASSED: All scraped recipes exist in Firestore
```

## Error Handling

The scraper includes comprehensive error handling:

- **Network timeouts**: Automatic retries with exponential backoff
- **Parsing failures**: Continues with next recipe, logs errors
- **Firebase errors**: Graceful degradation, maintains original URLs as fallback
- **Rate limiting**: Built-in delays to respect server limits

## Best Practices

### Testing First
Always run the test command before full scraping:
```bash
npm run scrape:tasty:test
```

### Start Small
Begin with a small number of recipes:
```bash
MAX_RECIPES=10 npm run scrape:tasty
```

### Monitor Progress
The scraper provides detailed logging:
- ✅ Successful operations
- ❌ Failed operations
- ⚠️ Warnings and fallbacks
- 📊 Progress statistics

### Rate Limiting
Be respectful to Tasty.co servers:
- Default delays are conservative
- Increase delays if you encounter rate limiting
- Use smaller batch sizes for slower connections

## Troubleshooting

### Common Issues

1. **Firebase Permission Errors**
   ```
   Error: Firebase Storage access failed
   ```
   - Verify your service account key path is correct
   - Ensure the service account has Storage Admin permissions
   - Check that the storage bucket exists

2. **Network Timeouts**
   ```
   Error: Navigation Timeout Exceeded
   ```
   - Increase timeout values in the scraper
   - Check your internet connection
   - Try reducing batch size

3. **No Recipes Found**
   ```
   ❌ No recipe URLs found
   ```
   - Tasty.co may have changed their page structure
   - Try the test command to debug
   - Check the selectors in `tasty-index-scraper.js`

4. **Image Upload Failures**
   ```
   ⚠️ Image upload failed
   ```
   - Non-critical - scraper continues with original URLs
   - Check Firebase Storage configuration
   - Use `SKIP_IMAGE_UPLOAD=true` to disable

### Debug Mode

Enable detailed logging by setting:
```bash
DEBUG=true npm run scrape:tasty
```

### Safe Mode

Run without making any changes:
```bash
DRY_RUN=true npm run scrape:tasty
```

## File Structure

```
scripts/tasty-scraper/
├── main.js                        # Main orchestration script
├── tasty-index-scraper.js         # URL discovery
├── recipe-scraper.js              # Individual recipe extraction
├── media-downloader.js            # Image handling
├── firestore-uploader.js          # Database operations
├── verify-scraped-recipes-test.js # Recipe verification test
├── run-verification-test.js       # Test runner script
├── .env.example                   # Environment template
└── README.md                      # This file
```

## Contributing

When modifying the scraper:

1. Test with `--test` flag first
2. Use `DRY_RUN=true` for testing logic changes
3. Update selectors if Tasty.co changes their HTML structure
4. Maintain backward compatibility with existing recipe format

## License

This scraper is part of the KitchenSink application and follows the same licensing terms. 
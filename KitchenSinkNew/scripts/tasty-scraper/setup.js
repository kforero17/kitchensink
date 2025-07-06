const fs = require('fs');
const path = require('path');

/**
 * Setup script for Tasty Recipe Scraper
 */
async function setupScraper() {
  console.log('🚀 Setting up Tasty Recipe Scraper...\n');
  
  const checks = [
    checkNodeVersion,
    checkDependencies,
    checkEnvironmentFile,
    checkFirebaseCredentials,
    checkPlaywrightInstallation
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    const result = await check();
    if (!result.passed) {
      allPassed = false;
      console.error(`❌ ${result.name}: ${result.message}`);
      if (result.solution) {
        console.log(`   💡 Solution: ${result.solution}\n`);
      }
    } else {
      console.log(`✅ ${result.name}: ${result.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('🎉 Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Configure your .env file with Firebase credentials');
    console.log('2. Test the scraper: npm run scrape:tasty:test');
    console.log('3. Run a small scraping session: MAX_RECIPES=10 npm run scrape:tasty');
  } else {
    console.log('⚠️  Setup completed with issues.');
    console.log('Please resolve the issues above before running the scraper.');
  }
}

/**
 * Check Node.js version
 */
function checkNodeVersion() {
  const version = process.version;
  const majorVersion = parseInt(version.slice(1).split('.')[0]);
  
  if (majorVersion >= 14) {
    return {
      passed: true,
      name: 'Node.js Version',
      message: `${version} (✓ >= 14.0.0)`
    };
  } else {
    return {
      passed: false,
      name: 'Node.js Version',
      message: `${version} is too old`,
      solution: 'Please upgrade to Node.js 14 or later'
    };
  }
}

/**
 * Check if required dependencies are installed
 */
function checkDependencies() {
  const requiredDeps = ['cheerio', 'playwright', 'firebase-admin', 'slugify', 'node-fetch'];
  const packageJsonPath = path.join(__dirname, '../../package.json');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const missing = requiredDeps.filter(dep => !allDeps[dep]);
    
    if (missing.length === 0) {
      return {
        passed: true,
        name: 'Dependencies',
        message: 'All required packages are listed in package.json'
      };
    } else {
      return {
        passed: false,
        name: 'Dependencies',
        message: `Missing dependencies: ${missing.join(', ')}`,
        solution: 'Run: npm install'
      };
    }
  } catch (error) {
    return {
      passed: false,
      name: 'Dependencies',
      message: 'Could not read package.json',
      solution: 'Ensure you are in the correct directory'
    };
  }
}

/**
 * Check if environment file exists
 */
function checkEnvironmentFile() {
  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');
  
  if (fs.existsSync(envPath)) {
    return {
      passed: true,
      name: 'Environment File',
      message: '.env file exists'
    };
  } else {
    // Try to create .env from example
    if (fs.existsSync(envExamplePath)) {
      try {
        fs.copyFileSync(envExamplePath, envPath);
        return {
          passed: false,
          name: 'Environment File',
          message: 'Created .env from template - needs configuration',
          solution: 'Edit scripts/tasty-scraper/.env with your Firebase credentials'
        };
      } catch (error) {
        return {
          passed: false,
          name: 'Environment File',
          message: 'Could not create .env file',
          solution: 'Manually copy .env.example to .env and configure'
        };
      }
    } else {
      return {
        passed: false,
        name: 'Environment File',
        message: '.env and .env.example not found',
        solution: 'Create .env file with Firebase credentials'
      };
    }
  }
}

/**
 * Check Firebase credentials configuration
 */
function checkFirebaseCredentials() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    return {
      passed: false,
      name: 'Firebase Credentials',
      message: 'No .env file found',
      solution: 'Create .env file first'
    };
  }
  
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasCredentials = envContent.includes('GOOGLE_APPLICATION_CREDENTIALS=') && 
                          envContent.includes('FIREBASE_STORAGE_BUCKET=');
    
    if (hasCredentials) {
      // Check if the credentials file actually exists
      const credentialsMatch = envContent.match(/GOOGLE_APPLICATION_CREDENTIALS=(.+)/);
      if (credentialsMatch) {
        const credentialsPath = credentialsMatch[1].trim();
        if (fs.existsSync(credentialsPath)) {
          return {
            passed: true,
            name: 'Firebase Credentials',
            message: 'Configured and credentials file exists'
          };
        } else {
          return {
            passed: false,
            name: 'Firebase Credentials',
            message: 'Credentials file path not found',
            solution: 'Update GOOGLE_APPLICATION_CREDENTIALS path in .env'
          };
        }
      }
    }
    
    return {
      passed: false,
      name: 'Firebase Credentials',
      message: 'Not configured in .env file',
      solution: 'Set GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_STORAGE_BUCKET in .env'
    };
  } catch (error) {
    return {
      passed: false,
      name: 'Firebase Credentials',
      message: 'Could not read .env file',
      solution: 'Check .env file permissions and format'
    };
  }
}

/**
 * Check Playwright installation
 */
async function checkPlaywrightInstallation() {
  try {
    const { chromium } = require('playwright');
    
    // Try to get browser path
    const browserPath = chromium.executablePath();
    
    if (browserPath && fs.existsSync(browserPath)) {
      return {
        passed: true,
        name: 'Playwright Browsers',
        message: 'Chromium is installed'
      };
    } else {
      return {
        passed: false,
        name: 'Playwright Browsers',
        message: 'Chromium browser not found',
        solution: 'Run: npx playwright install chromium'
      };
    }
  } catch (error) {
    return {
      passed: false,
      name: 'Playwright Browsers',
      message: 'Playwright not available',
      solution: 'Install dependencies first: npm install'
    };
  }
}

/**
 * Interactive configuration helper
 */
async function interactiveSetup() {
  console.log('🛠️  Interactive Setup\n');
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
  
  try {
    console.log('Let\'s configure your Tasty scraper!\n');
    
    const credentialsPath = await question('Path to your Firebase service account JSON file: ');
    const storageBucket = await question('Firebase Storage bucket (project-id.appspot.com): ');
    const maxRecipes = await question('Maximum recipes to scrape (default: 50): ') || '50';
    
    const envContent = `# Tasty Scraper Configuration

# Firebase Configuration
GOOGLE_APPLICATION_CREDENTIALS=${credentialsPath}
FIREBASE_STORAGE_BUCKET=${storageBucket}

# Scraping Configuration
MAX_RECIPES=${maxRecipes}
BATCH_SIZE=5
DELAY_BETWEEN_BATCHES=5000
DELAY_BETWEEN_RECIPES=2000

# Options
SKIP_IMAGE_UPLOAD=false
DRY_RUN=false
`;
    
    const envPath = path.join(__dirname, '.env');
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Configuration saved to .env');
    console.log('\nNext steps:');
    console.log('1. Test the configuration: npm run scrape:tasty:test');
    console.log('2. Start scraping: npm run scrape:tasty');
    
  } catch (error) {
    console.error('Setup interrupted');
  } finally {
    rl.close();
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--interactive') || args.includes('-i')) {
    interactiveSetup();
  } else {
    setupScraper();
  }
}

module.exports = { setupScraper, interactiveSetup }; 
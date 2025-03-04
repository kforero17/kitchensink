import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug logging
console.log('Node.js version:', process.version);
console.log('Module type: ES Module');

// Check module resolution
try {
  console.log('\nChecking module resolution:');
  const expoCryptoPath = require.resolve('expo-crypto');
  console.log('expo-crypto resolved to:', expoCryptoPath);
  
  const moduleContent = await fs.promises.readFile(expoCryptoPath, 'utf8');
  console.log('Module content type:', moduleContent.includes('export ') ? 'ESM' : 'CommonJS');
} catch (err) {
  console.error('Module resolution error:', err);
}

// Check plugin configuration
try {
  console.log('\nChecking plugin configuration:');
  const babelConfig = await import('../babel.config.js');
  console.log('Babel config:', babelConfig.default({}));
} catch (err) {
  console.error('Babel config error:', err);
}

// Check Expo configuration
try {
  console.log('\nChecking Expo configuration:');
  const appConfig = await import('../app.config.js');
  console.log('App config:', appConfig.default);
} catch (err) {
  console.error('App config error:', err);
}

// Check native module linking
try {
  console.log('\nChecking native module linking:');
  const podfileProps = JSON.parse(
    await fs.promises.readFile(
      path.join(__dirname, '../ios/Podfile.properties.json'),
      'utf8'
    )
  );
  console.log('Podfile properties:', podfileProps);
} catch (err) {
  console.error('Podfile properties error:', err);
} 
import * as fs from 'fs';
import * as path from 'path';

// Read and parse the .env file
const envPath = path.resolve(__dirname, '../../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVariables = Object.fromEntries(
  envContent
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('=').map(part => part.trim()))
);

export const {
  SPOONACULAR_API_KEY,
  SPOONACULAR_BASE_URL,
  SPOONACULAR_INGREDIENTS_ENDPOINT,
  SPOONACULAR_RECIPES_ENDPOINT,
} = envVariables; 
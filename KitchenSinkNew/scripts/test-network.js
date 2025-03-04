/**
 * Network test script for Kitchen Helper app
 * 
 * Run using: node scripts/test-network.js
 */

const https = require('https');
const fetchPackage = require('node-fetch');

console.log('Starting network connectivity tests...');

// Test basic HTTPS request using Node.js native module
function testHttpsRequest() {
  console.log('\n=== Testing Node.js native HTTPS module ===');
  return new Promise((resolve) => {
    const options = {
      hostname: 'jsonplaceholder.typicode.com',
      port: 443,
      path: '/posts/1',
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      // Bypass SSL certificate validation for testing purposes
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      console.log(`HTTPS Status Code: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('HTTPS Response Body:', data.substring(0, 100) + '...');
        console.log('HTTPS test: SUCCESS');
        resolve(true);
      });
    });

    req.on('error', (error) => {
      console.error('HTTPS Error:', error);
      console.log('HTTPS test: FAILED');
      resolve(false);
    });

    req.end();
  });
}

// Test using node-fetch library
async function testNodeFetch() {
  console.log('\n=== Testing node-fetch library ===');
  try {
    const agent = new https.Agent({
      rejectUnauthorized: false
    });
    
    const response = await fetchPackage('https://jsonplaceholder.typicode.com/posts/1', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      agent
    });
    
    console.log(`Fetch Status Code: ${response.status}`);
    const data = await response.json();
    console.log('Fetch Response Body:', JSON.stringify(data).substring(0, 100) + '...');
    console.log('node-fetch test: SUCCESS');
    return true;
  } catch (error) {
    console.error('Fetch Error:', error);
    console.log('node-fetch test: FAILED');
    return false;
  }
}

// Test Spoonacular API endpoint if available
async function testSpoonacularAPI() {
  console.log('\n=== Testing Spoonacular API (if configured) ===');
  
  try {
    // Load environment variables from .env file
    require('dotenv').config();
    
    const apiKey = process.env.SPOONACULAR_API_KEY;
    if (!apiKey) {
      console.log('Spoonacular API key not found in environment variables');
      return false;
    }
    
    const url = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${apiKey}&query=pasta&number=1`;
    const agent = new https.Agent({
      rejectUnauthorized: false
    });
    
    const response = await fetchPackage(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      agent
    });
    
    console.log(`Spoonacular Status Code: ${response.status}`);
    
    const data = await response.json();
    console.log('Spoonacular Response:', JSON.stringify(data).substring(0, 100) + '...');
    
    if (response.status === 200) {
      console.log('Spoonacular API test: SUCCESS');
      return true;
    } else {
      console.log('Spoonacular API test: FAILED - Unexpected response');
      return false;
    }
  } catch (error) {
    console.error('Spoonacular API Error:', error);
    console.log('Spoonacular API test: FAILED');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('Node.js version:', process.version);
  console.log('Running on platform:', process.platform);
  
  const httpsResult = await testHttpsRequest();
  const fetchResult = await testNodeFetch();
  const spoonacularResult = await testSpoonacularAPI();
  
  console.log('\n=== Test Results Summary ===');
  console.log('HTTPS module test:', httpsResult ? 'PASSED' : 'FAILED');
  console.log('node-fetch test:', fetchResult ? 'PASSED' : 'FAILED');
  console.log('Spoonacular API test:', spoonacularResult ? 'PASSED' : 'FAILED');
  
  console.log('\nTests completed.');
}

// Execute tests
runAllTests().catch(error => {
  console.error('Unhandled error in tests:', error);
}); 
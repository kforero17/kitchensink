/**
 * Simple Proxy Server for bypassing SSL certificate validation issues
 * 
 * This server acts as a middleman between the React Native app and external APIs,
 * handling SSL certificate validation on behalf of the app.
 * 
 * Usage:
 * 1. Run this server: node server.js
 * 2. Configure your app to use this proxy
 */
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const https = require('https');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const DEFAULT_PORT = process.env.PORT || 8080;
// Try alternative ports if the default is in use
const ALTERNATIVE_PORTS = [8081, 8082, 8083, 8084, 8085];

// Enable CORS for all routes
app.use(cors());

// Create an HTTPS agent that accepts all certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Proxy server is running' });
});

// Proxy endpoint
app.get('/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    
    console.log(`Proxying request to: ${targetUrl}`);
    
    // Handle the proxy request with disabled certificate validation
    const response = await fetch(targetUrl, {
      method: 'GET',
      agent: httpsAgent,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    
    // Get the response data
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    // Set the same status code
    res.status(response.status);
    
    // Forward the content type
    if (contentType) {
      res.set('Content-Type', contentType);
    }
    
    // Send the response
    res.send(data);
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ 
      error: 'Proxy server error', 
      message: error.message 
    });
  }
});

// Try to start the server, with fallback ports if needed
function startServer(port, attemptIndex = 0) {
  const server = app.listen(port, () => {
    console.log(`Proxy server running on http://localhost:${port}`);
    console.log('Available endpoints:');
    console.log(`- Health check: http://localhost:${port}/health`);
    console.log(`- Proxy: http://localhost:${port}/proxy?url=https://api.example.com`);
    
    // Write the port to a configuration file for the app to read
    const portFile = path.join(__dirname, 'port.txt');
    fs.writeFileSync(portFile, port.toString(), 'utf8');
    console.log(`Port ${port} saved to ${portFile}`);
  });
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is already in use.`);
      
      // Try the next alternative port
      if (attemptIndex < ALTERNATIVE_PORTS.length) {
        const nextPort = ALTERNATIVE_PORTS[attemptIndex];
        console.log(`Trying alternative port ${nextPort}...`);
        startServer(nextPort, attemptIndex + 1);
      } else {
        console.error('All ports are in use. Please close other applications or specify a different port.');
        process.exit(1);
      }
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

// Start the server with the default port
startServer(DEFAULT_PORT); 
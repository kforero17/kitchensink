# Proxy Server for React Native API Certificate Bypass

This simple proxy server helps React Native applications bypass SSL certificate validation issues when working behind corporate VPNs.

## Why This Proxy Server?

Corporate VPNs often use their own certificates to intercept HTTPS traffic, causing React Native applications to fail with "Network request failed" errors. This proxy server acts as a trusted middleman that can handle certificate validation on behalf of your app.

## Features

- Bypasses SSL certificate validation for secured API endpoints
- Works with any API including Spoonacular
- Simple GET request proxy with JSON response handling
- Health check endpoint for testing connectivity

## Prerequisites

- Node.js (v14+)
- npm or yarn

## Installation

1. Install dependencies:
   ```bash
   cd proxy-server
   npm install
   ```

2. Start the server:
   ```bash
   node server.js
   ```

3. Verify it's running by visiting:
   - Health check: `http://localhost:8080/health`
   - Should return: `{"status":"ok","message":"Proxy server is running"}`

## Usage with React Native

1. Start the proxy server on your development machine
2. In your React Native app, use the proxy URL:
   ```javascript
   // Instead of fetching directly:
   // fetch('https://api.example.com/endpoint')
   
   // Fetch through the proxy:
   const originalUrl = 'https://api.example.com/endpoint';
   const encodedUrl = encodeURIComponent(originalUrl);
   const proxiedUrl = `http://localhost:8080/proxy?url=${encodedUrl}`;
   
   fetch(proxiedUrl)
     .then(response => response.json())
     .then(data => console.log(data));
   ```

3. When running on a simulator:
   - iOS Simulator: Use `http://127.0.0.1:8080` as the proxy host
   - Android Emulator: Use `http://10.0.2.2:8080` as the proxy host

## Troubleshooting

- If you can't connect to the proxy, make sure:
  - The proxy server is running
  - The port (8080) is not blocked or in use
  - For physical devices, your phone and computer are on the same network
  - For physical devices, use your computer's local IP instead of localhost

- If proxy works but API requests fail:
  - Check that your API key is valid
  - Ensure the API endpoint URL is properly encoded
  - Check the proxy server logs for detailed error messages

## Security Considerations

This proxy server disables SSL certificate validation, which is necessary to bypass corporate VPN issues but can introduce security risks. Only use this for development and testing purposes. 
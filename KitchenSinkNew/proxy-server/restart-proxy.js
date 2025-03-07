/**
 * Script to restart the proxy server by killing any running instances
 * and starting a new one
 */
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Function to kill existing proxy server processes
function killExistingProxyServers() {
  return new Promise((resolve) => {
    // Find all processes using ports 8080-8085
    if (process.platform === 'win32') {
      // Windows command
      exec('netstat -ano | findstr "8080 8081 8082 8083 8084 8085"', (error, stdout) => {
        if (error) {
          console.log('No existing proxy servers found or error finding them');
          return resolve();
        }
        
        // Extract PIDs from the output
        const lines = stdout.split('\n');
        const pids = new Set();
        
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 4) {
            pids.add(parts[4]);
          }
        });
        
        // Kill each process
        pids.forEach(pid => {
          try {
            exec(`taskkill /F /PID ${pid}`);
            console.log(`Killed process with PID: ${pid}`);
          } catch (err) {
            console.error(`Failed to kill process ${pid}:`, err);
          }
        });
        
        resolve();
      });
    } else {
      // macOS/Linux command
      exec('lsof -i:8080,8081,8082,8083,8084,8085', (error, stdout) => {
        if (error) {
          console.log('No existing proxy servers found or error finding them');
          return resolve();
        }
        
        // Extract PIDs from the output
        const lines = stdout.split('\n');
        const pids = new Set();
        
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 1) {
            pids.add(parts[1]);
          }
        });
        
        // Kill each process
        pids.forEach(pid => {
          try {
            exec(`kill -9 ${pid}`);
            console.log(`Killed process with PID: ${pid}`);
          } catch (err) {
            console.error(`Failed to kill process ${pid}:`, err);
          }
        });
        
        resolve();
      });
    }
  });
}

// Function to start a new proxy server
function startProxyServer() {
  console.log('Starting new proxy server...');
  
  // Get path to server.js
  const serverPath = path.join(__dirname, 'server.js');
  
  // Check if server.js exists
  if (!fs.existsSync(serverPath)) {
    console.error(`Server file not found at: ${serverPath}`);
    return;
  }
  
  // Start the server
  const serverProcess = spawn('node', [serverPath], {
    detached: true,
    stdio: 'inherit'
  });
  
  serverProcess.on('error', (err) => {
    console.error('Failed to start proxy server:', err);
  });
  
  // Detach the process so it keeps running after this script exits
  serverProcess.unref();
}

// Main function
async function main() {
  console.log('Restarting proxy server...');
  
  try {
    // Kill existing proxy servers
    await killExistingProxyServers();
    
    // Wait a moment for ports to be released
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start new proxy server
    startProxyServer();
    
    console.log('Proxy server restart complete!');
  } catch (error) {
    console.error('Error restarting proxy server:', error);
  }
}

// Run the main function
main(); 
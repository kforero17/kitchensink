/**
 * Script to copy the port.txt file to the iOS simulator's document directory
 * This helps the app find the proxy server port automatically
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Function to find iOS simulator data directory
function findSimulatorDataDir() {
  try {
    // This only works on macOS
    if (process.platform !== 'darwin') {
      console.error('This script only works on macOS');
      return null;
    }
    
    // Get the list of simulator devices
    const homedir = require('os').homedir();
    const simulatorsDir = path.join(homedir, 'Library/Developer/CoreSimulator/Devices');
    
    if (!fs.existsSync(simulatorsDir)) {
      console.error('iOS Simulator directory not found');
      return null;
    }
    
    // List running simulators
    const xcrunOutput = execSync('xcrun simctl list devices | grep Booted').toString();
    
    // Extract the UUID of the first booted simulator
    const match = xcrunOutput.match(/\(([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\)/i);
    
    if (!match || !match[1]) {
      console.error('No booted iOS simulator found');
      return null;
    }
    
    const simulatorUUID = match[1];
    console.log(`Found booted simulator with UUID: ${simulatorUUID}`);
    
    return path.join(simulatorsDir, simulatorUUID);
  } catch (error) {
    console.error('Error finding simulator directory:', error);
    return null;
  }
}

// Function to find the app data directory within the simulator
function findAppDataDir(simulatorDataDir) {
  try {
    // Path to the apps directory within the simulator
    const appsDir = path.join(simulatorDataDir, 'data/Containers/Data/Application');
    
    if (!fs.existsSync(appsDir)) {
      console.error('Apps directory not found in simulator');
      return null;
    }
    
    // List all app directories
    const appDirs = fs.readdirSync(appsDir);
    
    // Look for KitchenSinkNew app by checking for our specific files
    for (const appDir of appDirs) {
      const docsDir = path.join(appsDir, appDir, 'Documents');
      
      if (fs.existsSync(docsDir)) {
        // You can improve this check by looking for a specific file known to be in your app
        console.log(`Found potential app directory: ${docsDir}`);
        return docsDir;
      }
    }
    
    console.error('Could not find the app directory in simulator');
    return null;
  } catch (error) {
    console.error('Error finding app directory:', error);
    return null;
  }
}

// Main function
async function main() {
  console.log('Copying port.txt to iOS simulator document directory...');
  
  // Get the source port.txt file path
  const sourceFile = path.join(__dirname, 'port.txt');
  
  if (!fs.existsSync(sourceFile)) {
    console.error(`Source file not found: ${sourceFile}`);
    return;
  }
  
  // Read the port
  const port = fs.readFileSync(sourceFile, 'utf8').trim();
  console.log(`Proxy server is running on port: ${port}`);
  
  // Find the simulator directory
  const simulatorDir = findSimulatorDataDir();
  if (!simulatorDir) {
    return;
  }
  
  // Find the app's document directory
  const appDocsDir = findAppDataDir(simulatorDir);
  if (!appDocsDir) {
    return;
  }
  
  // Define target files
  const targetFiles = [
    path.join(appDocsDir, 'port.txt'),
    path.join(appDocsDir, 'proxy-port.txt')
  ];
  
  // Copy the port.txt file to each target location
  for (const targetFile of targetFiles) {
    try {
      fs.writeFileSync(targetFile, port);
      console.log(`Successfully copied port to: ${targetFile}`);
    } catch (error) {
      console.error(`Error copying to ${targetFile}:`, error);
    }
  }
  
  console.log('Done!');
}

// Run the main function
main(); 
/**
 * Test script to verify React Native's fetch implementation works correctly
 * 
 * This script should be executed in a React Native context
 */

export default async function testReactNativeFetch() {
  console.log('Testing React Native fetch implementation...');
  
  try {
    // Simple fetch to a reliable endpoint 
    const response = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return {
        success: false,
        message: `HTTP error! Status: ${response.status}`,
        status: response.status
      };
    }
    
    const data = await response.json();
    
    return {
      success: true,
      message: 'Successfully fetched data from JSON Placeholder',
      data: data
    };
  } catch (error) {
    return {
      success: false,
      message: `Fetch error: ${error.message}`,
      error: error.toString()
    };
  }
} 
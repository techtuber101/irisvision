import { Platform } from 'react-native';

// Get the backend URL from environment variables (already includes /api)
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://irisvision.ai/api';

// Handle React Native localhost issues
const getServerUrl = (): string => {
  let serverUrl = BACKEND_URL;
  
  // For live backend URLs (irisvision.ai), no need to modify
  if (serverUrl.includes('irisvision.ai')) {
    console.log(`[Server] Using live backend URL: ${serverUrl}`);
    return serverUrl;
  }
  
  // For ngrok URLs, no need to modify
  if (serverUrl.includes('ngrok')) {
    console.log(`[Server] Using ngrok URL: ${serverUrl}`);
    return serverUrl;
  }
  
  if (Platform.OS === 'web') {
    return serverUrl;
  }
  
  // For React Native, replace localhost with the appropriate hostname
  if (serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1')) {
    // Try multiple options for React Native connectivity
    const options = [
      process.env.EXPO_PUBLIC_SERVER_IP || '192.168.29.94', // Your IP
      'Ishaans-MacBook-Air.local', // Your hostname
      '192.168.1.100', // Common router IP
      '192.168.0.100', // Another common router IP
    ];
    
    const actualIP = options[0]; // Use the first option (your IP)
    serverUrl = serverUrl.replace('localhost', actualIP).replace('127.0.0.1', actualIP);
    console.log(`[Server] Using IP address: ${actualIP} for React Native`);
    console.log(`[Server] Alternative options: ${options.slice(1).join(', ')}`);
  }
  
  console.log(`[Server] Final SERVER_URL: ${serverUrl}`);
  return serverUrl;
};

export const SERVER_URL = getServerUrl();

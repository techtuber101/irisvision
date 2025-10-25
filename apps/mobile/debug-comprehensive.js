// Enhanced debugging for mobile app network issues
// Add this to your mobile app temporarily to debug the issue

import { SERVER_URL } from './constants/Server';
import { createSupabaseClient } from './constants/SupabaseConfig';

export const comprehensiveNetworkDebug = async () => {
  console.log('=== COMPREHENSIVE NETWORK DEBUG ===');
  
  // 1. Basic info
  console.log('1. Platform:', Platform.OS);
  console.log('2. SERVER_URL:', SERVER_URL);
  console.log('3. EXPO_PUBLIC_BACKEND_URL:', process.env.EXPO_PUBLIC_BACKEND_URL);
  console.log('4. EXPO_PUBLIC_SERVER_IP:', process.env.EXPO_PUBLIC_SERVER_IP);
  
  // 2. Test basic connectivity with different approaches
  const testUrls = [
    'http://192.168.29.94:8000/api/health',
    'http://localhost:8000/api/health',
    'http://127.0.0.1:8000/api/health',
  ];
  
  for (const url of testUrls) {
    try {
      console.log(`Testing ${url}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log(`✅ ${url} - Status: ${response.status}`);
    } catch (error) {
      console.log(`❌ ${url} - Error: ${error.message}`);
    }
  }
  
  // 3. Test authentication
  try {
    console.log('Testing authentication...');
    const supabase = createSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Auth error:', error);
    } else if (!session) {
      console.error('❌ No session found');
    } else {
      console.log('✅ Auth session valid');
      console.log('Token length:', session.access_token?.length || 0);
    }
  } catch (error) {
    console.error('❌ Auth test failed:', error);
  }
  
  // 4. Test agent initiate with minimal data
  try {
    console.log('Testing /agent/initiate with minimal data...');
    const supabase = createSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.error('❌ No auth token for agent test');
      return;
    }
    
    const formData = new FormData();
    formData.append('prompt', 'test');
    formData.append('stream', 'true');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${SERVER_URL}/agent/initiate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: formData,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    console.log(`✅ Agent initiate - Status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Agent initiate error:', errorText);
    }
  } catch (error) {
    console.error('❌ Agent initiate test failed:', error);
  }
  
  console.log('=== DEBUG COMPLETE ===');
};

// Usage: Add a button to call this function
// <TouchableOpacity onPress={comprehensiveNetworkDebug}>
//   <Text>Debug Network</Text>
// </TouchableOpacity>

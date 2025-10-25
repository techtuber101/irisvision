// Debug script to test network connectivity
// Run this in your mobile app's console or add to a component

import { SERVER_URL } from './constants/Server';
import { createSupabaseClient } from './constants/SupabaseConfig';

export const debugNetworkConnectivity = async () => {
  console.log('=== NETWORK DEBUG START ===');
  
  // 1. Check SERVER_URL configuration
  console.log('1. SERVER_URL:', SERVER_URL);
  console.log('2. EXPO_PUBLIC_BACKEND_URL:', process.env.EXPO_PUBLIC_BACKEND_URL);
  
  // 2. Test basic connectivity
  try {
    console.log('3. Testing basic connectivity...');
    const response = await fetch(`${SERVER_URL}/health`, {
      method: 'GET',
      timeout: 5000,
    });
    console.log('✅ Basic connectivity test passed:', response.status);
  } catch (error) {
    console.error('❌ Basic connectivity test failed:', error.message);
  }
  
  // 3. Test authentication
  try {
    console.log('4. Testing authentication...');
    const supabase = createSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Auth session error:', error);
    } else if (!session) {
      console.error('❌ No active session found');
    } else {
      console.log('✅ Auth session valid:', !!session.access_token);
    }
  } catch (error) {
    console.error('❌ Auth test failed:', error);
  }
  
  // 4. Test agent initiate endpoint
  try {
    console.log('5. Testing /agent/initiate endpoint...');
    const supabase = createSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.error('❌ No auth token for endpoint test');
      return;
    }
    
    const formData = new FormData();
    formData.append('prompt', 'test message');
    formData.append('stream', 'true');
    
    const response = await fetch(`${SERVER_URL}/agent/initiate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: formData,
    });
    
    console.log('✅ Agent initiate endpoint response:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Agent initiate error:', errorText);
    }
  } catch (error) {
    console.error('❌ Agent initiate test failed:', error);
  }
  
  console.log('=== NETWORK DEBUG END ===');
};

// Usage: Call debugNetworkConnectivity() in your app

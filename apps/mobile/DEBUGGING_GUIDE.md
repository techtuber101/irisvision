# Mobile App Debugging Guide

## Issue: Mobile app gets stuck at "sending request to /agent/initiate"

### Quick Fixes to Try:

1. **Check Environment Variables**
   ```bash
   # In your mobile app directory
   echo $EXPO_PUBLIC_BACKEND_URL
   echo $EXPO_PUBLIC_SERVER_URL
   ```

2. **Verify Backend is Running**
   ```bash
   # Test if backend is accessible
   curl http://localhost:8000/api/health
   # or
   curl http://vukasin.local:8000/api/health
   ```

3. **Check Network Configuration**
   - The app uses `vukasin.local` instead of `localhost` for React Native
   - Make sure this hostname resolves to your backend server
   - Try changing `apps/mobile/constants/Server.ts` line 16 to use your actual IP

4. **Authentication Check**
   - Ensure user is logged in to Supabase
   - Check if session token is valid

### Debugging Steps:

1. **Add Debug Component** (temporary):
   ```tsx
   // Add this to your main screen temporarily
   import { debugNetworkConnectivity } from './debug-network';
   
   const DebugButton = () => (
     <TouchableOpacity onPress={debugNetworkConnectivity}>
       <Text>Debug Network</Text>
     </TouchableOpacity>
   );
   ```

2. **Check Console Logs**:
   - Look for `[API] Sending request to /agent/initiate...`
   - Look for `[API] Response status:` logs
   - Check for any error messages

3. **Common Issues & Solutions**:

   **Issue**: Network timeout
   **Solution**: Increase timeout in fetch requests

   **Issue**: CORS errors
   **Solution**: Check backend CORS configuration

   **Issue**: Authentication failure
   **Solution**: Re-login user or refresh session

   **Issue**: Backend not accessible
   **Solution**: Use correct IP address instead of localhost

### Environment Configuration:

Create `.env.local` in your mobile app directory:
```
EXPO_PUBLIC_BACKEND_URL=http://YOUR_IP:8000/api
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

Replace `YOUR_IP` with your computer's IP address (not localhost).

### Testing the Fix:

1. Run the debug script
2. Check console output
3. Verify each step passes
4. Try sending a message again

If issues persist, check:
- Backend logs for incoming requests
- Network connectivity between mobile device and backend
- Supabase authentication status

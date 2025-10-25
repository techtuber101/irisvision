# Mobile App Network Debugging Steps

## Current Issue: "Network request timed out"

The backend is running and accessible from your computer, but the mobile device can't reach it.

### Quick Tests to Try:

1. **Test from Mobile Device Browser**:
   - Open Safari/Chrome on your mobile device
   - Go to: `http://192.168.29.94:8000/api/health`
   - If this works, the issue is in the mobile app
   - If this fails, it's a network/firewall issue

2. **Check WiFi Network**:
   - Make sure your mobile device and computer are on the same WiFi network
   - Try connecting both to the same network

3. **Try Different IP Addresses**:
   - Your computer's IP: `192.168.29.94`
   - Try also: `192.168.1.100`, `192.168.0.100`, etc.
   - Update `apps/mobile/constants/Server.ts` with different IPs

4. **Check Firewall**:
   ```bash
   # On macOS, check if firewall is blocking connections
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
   ```

5. **Test with Simple HTTP Request**:
   ```javascript
   // Add this to your mobile app temporarily
   fetch('http://192.168.29.94:8000/api/health')
     .then(response => console.log('Success:', response.status))
     .catch(error => console.log('Error:', error.message));
   ```

### Alternative Solutions:

1. **Use ngrok for tunneling**:
   ```bash
   # Install ngrok
   brew install ngrok
   
   # Create tunnel to your backend
   ngrok http 8000
   
   # Use the ngrok URL in your mobile app
   ```

2. **Use your computer's hostname**:
   - Try `http://YOUR_COMPUTER_NAME.local:8000/api/health`
   - Replace `YOUR_COMPUTER_NAME` with your actual computer name

3. **Check Docker networking**:
   ```bash
   # Check Docker network configuration
   docker network ls
   docker network inspect irissecond_default
   ```

### Most Likely Fix:
The issue is probably that your mobile device can't reach `192.168.29.94`. Try:
1. Test the URL in mobile browser first
2. If that fails, try a different IP address
3. If that works, update the mobile app configuration

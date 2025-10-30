# Fix SSH "Permission Denied" Error

## Current Status
- ✅ SSH key exists: `~/.ssh/id_ed25519_vm`
- ✅ SSH config configured: `~/.ssh/config` (Host: iris)
- ❌ Public key NOT authorized on server
- ❌ Password authentication disabled (key-only)

## Your Public Key
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJHRBWvz5InTtrtIKFbC6VaI6qyNvGr2gAPQoZw05uDS debian-vm-access
```

## Solution: Add Key via E2E Web Console (RECOMMENDED)

### Step 1: Access E2E Console
1. Go to: https://console.e2enetworks.com
2. Login with your E2E account
3. Navigate to: **MyAccount** → **Virtual Compute Nodes**
4. Find your "iris" node (IP: 216.48.176.196)
5. Click **"Console"** or **"Web Terminal"** button

### Step 2: Add SSH Key
Once in the console, run these commands:

```bash
# Create .ssh directory if it doesn't exist
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add your public key
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJHRBWvz5InTtrtIKFbC6VaI6qyNvGr2gAPQoZw05uDS debian-vm-access' >> ~/.ssh/authorized_keys

# Set correct permissions
chmod 600 ~/.ssh/authorized_keys

# Verify it was added
cat ~/.ssh/authorized_keys
```

### Step 3: Test Connection
After adding the key, test from your local machine:

```bash
ssh iris "echo '✅ SSH working!'"
```

---

## Alternative: Use E2E CLI to Get Console Access

If the web console isn't available, you might be able to use E2E's API to add the key, but the web console is the easiest method.

---

## Quick One-Liner (If Password Auth Were Enabled)

If password authentication was enabled, you could run:
```bash
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJHRBWvz5InTtrtIKFbC6VaI6qyNvGr2gAPQoZw05uDS debian-vm-access' | \
ssh root@216.48.176.196 \
  'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
```

But since password auth is disabled, you **must** use the web console method above.

---

## Verify After Fix

```bash
# Should work without password
ssh iris

# Execute commands
ssh iris "hostname"
ssh iris "df -h"
ssh iris "uptime"
```


# Install Cursor CLI on E2E VM

## Quick Install Commands

Run these commands on your VM (via E2E Console or SSH once working):

### For Debian/Ubuntu:

```bash
# Download and install Cursor CLI
curl -fsSL https://cursor.sh/install.sh | sh

# Or manual installation:
curl -L -o cursor-cli.deb https://download.cursor.sh/linux/appImage/x64
sudo dpkg -i cursor-cli.deb

# Verify installation
cursor --version
```

### For Linux (Generic/AppImage):

```bash
# Download Cursor CLI AppImage
curl -L -o cursor-cli https://download.cursor.sh/linux/appImage/x64
chmod +x cursor-cli
sudo mv cursor-cli /usr/local/bin/cursor

# Verify
cursor --version
```

### Alternative: Manual Binary Installation

```bash
# Create directory
mkdir -p ~/bin
cd ~/bin

# Download latest Cursor CLI binary
curl -L -o cursor https://download.cursor.sh/linux/appImage/x64

# Make executable
chmod +x cursor

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify
cursor --version
```

## Installation via E2E Console

1. Go to https://console.e2enetworks.com
2. Access your VM Console
3. Run the installation commands above
4. Test with: `cursor --version`

## Installation via SSH (once SSH is working)

```bash
# Connect via SSH
ssh iris

# Then run installation commands
curl -fsSL https://cursor.sh/install.sh | sh
```

## Troubleshooting

If the install script doesn't work:

```bash
# Check your OS
cat /etc/os-release

# For Debian/Ubuntu specifically:
wget -qO - https://cursor.sh/gpg.key | sudo apt-key add -
echo "deb https://download.cursor.sh stable main" | sudo tee /etc/apt/sources.list.d/cursor.list
sudo apt update
sudo apt install cursor
```

## Verify Installation

```bash
cursor --version
cursor --help
```

## Notes

- Cursor CLI requires an active internet connection
- Make sure you have curl/wget installed: `apt install curl wget`
- If you get permission errors, use `sudo` where needed


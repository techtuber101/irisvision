#!/bin/bash
# Install Cursor CLI on E2E VM
# Usage: Run this script on your VM via E2E Console or SSH

set -e

echo "🚀 Installing Cursor CLI..."
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    OS="unknown"
fi

echo "Detected OS: $OS"
echo ""

# Function to install on Debian/Ubuntu
install_debian() {
    echo "Installing for Debian/Ubuntu..."
    
    # Update package list
    sudo apt update
    
    # Install dependencies
    sudo apt install -y curl wget
    
    # Try official install script first
    if curl -fsSL https://cursor.sh/install.sh | sh; then
        echo "✅ Installed via official script"
    else
        echo "Official script failed, trying manual installation..."
        
        # Manual download
        curl -L -o /tmp/cursor-cli.deb https://download.cursor.sh/linux/appImage/x64 2>/dev/null || \
        wget -O /tmp/cursor-cli.deb https://download.cursor.sh/linux/appImage/x64
        
        # Install
        sudo dpkg -i /tmp/cursor-cli.deb || sudo apt install -f -y
        rm /tmp/cursor-cli.deb
    fi
}

# Function to install generic Linux (AppImage)
install_generic() {
    echo "Installing generic Linux binary..."
    
    # Create bin directory
    mkdir -p ~/bin
    cd ~/bin
    
    # Download Cursor CLI
    curl -L -o cursor https://download.cursor.sh/linux/appImage/x64 || \
    wget -O cursor https://download.cursor.sh/linux/appImage/x64
    
    # Make executable
    chmod +x cursor
    
    # Add to PATH if not already there
    if ! echo $PATH | grep -q "$HOME/bin"; then
        echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
        export PATH="$HOME/bin:$PATH"
    fi
    
    echo "✅ Installed to ~/bin/cursor"
}

# Main installation logic
case $OS in
    debian|ubuntu)
        install_debian
        ;;
    *)
        echo "Generic Linux detected, using AppImage method..."
        install_generic
        ;;
esac

# Verify installation
echo ""
echo "Verifying installation..."
if command -v cursor &> /dev/null; then
    echo "✅ Cursor CLI installed successfully!"
    cursor --version
else
    echo "⚠️  Cursor CLI not found in PATH"
    echo "Try: ~/bin/cursor --version"
    echo "Or add ~/bin to your PATH"
fi

echo ""
echo "📝 Installation complete!"
echo "Run 'cursor --help' to get started"


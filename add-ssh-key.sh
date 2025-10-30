#!/bin/bash
# Script to add SSH key to E2E VM
# This script helps you add your public key to the server

PUBLIC_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJHRBWvz5InTtrtIKFbC6VaI6qyNvGr2gAPQoZw05uDS debian-vm-access"
VM_IP="216.48.176.196"

echo "🔑 Adding SSH Key to E2E VM"
echo "============================"
echo ""
echo "Your public key:"
echo "$PUBLIC_KEY"
echo ""
echo "📋 Option 1: Manual via Password Login"
echo "   Run this command and enter root password when prompted:"
echo ""
echo "   ssh root@$VM_IP 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo \"$PUBLIC_KEY\" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && cat ~/.ssh/authorized_keys'"
echo ""
echo "📋 Option 2: Copy key to clipboard for manual paste"
echo "   Your public key is ready to copy."
echo ""
echo "📋 Option 3: Use E2E Web Console"
echo "   1. Go to https://console.e2enetworks.com"
echo "   2. Access your VM console/web terminal"
echo "   3. Run these commands:"
echo "      mkdir -p ~/.ssh"
echo "      chmod 700 ~/.ssh"
echo "      echo '$PUBLIC_KEY' >> ~/.ssh/authorized_keys"
echo "      chmod 600 ~/.ssh/authorized_keys"
echo ""
echo "Press Enter to copy the command for Option 1..."
read

echo ""
echo "Command ready to paste (copy this):"
echo "---"
echo "ssh root@$VM_IP 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo \"$PUBLIC_KEY\" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && cat ~/.ssh/authorized_keys'"
echo "---"
echo ""
echo "Or run this one-liner:"
echo "echo '$PUBLIC_KEY' | ssh root@$VM_IP 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'"


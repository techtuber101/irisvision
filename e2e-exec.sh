#!/bin/bash
# E2E Networks - Execute Commands on VM via SSH
# Usage: ./e2e-exec.sh [node_name] "command"
# This script uses SSH - make sure your SSH key is authorized on the server first!

export PATH="$HOME/Library/Python/3.9/bin:$PATH"

NODE_NAME=${1:-iris}
COMMAND=${2:-}

# Get node info from E2E CLI
get_node_info() {
    local node_name=$1
    e2e_cli node list 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for node in data.get('data', []):
        if node.get('name') == '$node_name' or str(node.get('id')) == '$node_name':
            print(f\"{node.get('name')}|{node.get('public_ip_address')}|{node.get('status')}\")
            sys.exit(0)
except:
    pass
" 2>/dev/null
}

if [ -z "$COMMAND" ]; then
    echo "E2E Networks - Execute Commands on VM"
    echo ""
    echo "Usage: $0 [node_name] \"command\""
    echo ""
    echo "Current nodes:"
    e2e_cli node list 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for node in data.get('data', []):
        print(f\"  - {node.get('name')} (ID: {node.get('id')}, IP: {node.get('public_ip_address')}, Status: {node.get('status')})\")
except:
    pass
" 2>/dev/null
    echo ""
    echo "Examples:"
    echo "  $0 iris \"hostname\""
    echo "  $0 iris \"df -h\""
    echo "  $0 iris \"uptime\""
    echo ""
    echo "💡 Tip: Use 'ssh iris' for interactive session"
    exit 1
fi

NODE_INFO=$(get_node_info "$NODE_NAME")
if [ -z "$NODE_INFO" ]; then
    echo "❌ Node '$NODE_NAME' not found!"
    exit 1
fi

IFS='|' read -r name ip status <<< "$NODE_INFO"
echo "🔌 Node: $name (Status: $status)"
echo "🌐 IP: $ip"
echo "▶️  Command: $COMMAND"
echo ""

ssh "$NODE_NAME" "$COMMAND"


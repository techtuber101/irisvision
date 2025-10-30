#!/bin/bash
# E2E Networks VM Connection Helper
# Usage: ./e2e-connect.sh [node_name] [command]

set -e

# Load E2E CLI path
export PATH="$HOME/Library/Python/3.9/bin:$PATH"

# Get node info from E2E CLI
get_node_info() {
    local node_name=$1
    e2e_cli node list 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
for node in data.get('data', []):
    if node.get('name') == '$node_name' or str(node.get('id')) == '$node_name':
        print(f\"{node.get('public_ip_address')}|{node.get('id')}\")
        sys.exit(0)
"
}

# Default to iris if no node specified
NODE_NAME=${1:-iris}
COMMAND=${2:-}

if [ -z "$COMMAND" ]; then
    # Interactive SSH connection
    echo "🔌 Connecting to E2E node: $NODE_NAME"
    ssh "$NODE_NAME"
else
    # Execute command remotely
    echo "▶️  Executing command on $NODE_NAME: $COMMAND"
    ssh "$NODE_NAME" "$COMMAND"
fi


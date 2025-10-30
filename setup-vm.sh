#!/bin/bash
# Complete VM Setup Script for Iris
# This script configures the VM, installs Docker, and sets up the irissecond repo

set -e

echo "🚀 Starting Iris VM Configuration..."
echo ""

# 1. Update system and set hostname
echo "📦 Updating system and setting hostname..."
hostnamectl set-hostname iris || hostname iris
hostname iris

# 2. Install prerequisites
echo "📦 Installing prerequisites..."
apt-get update -qq
apt-get install -y -qq \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    apt-transport-https \
    software-properties-common

# 3. Install Docker
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

# 4. Install Docker Compose (standalone if not included)
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# 5. Start and enable Docker
systemctl enable docker
systemctl start docker
usermod -aG docker root

# 6. Verify Docker installation
docker --version
docker-compose --version
echo "✅ Docker installed successfully"
echo ""

# 7. Create project directory
PROJECT_DIR="/root/irissecond"
echo "📁 Setting up project directory: $PROJECT_DIR"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# 8. Clone the repo (if not already cloned)
if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo "📥 Cloning irissecond repository..."
    # Note: You'll need to provide the repo URL
    # For now, we'll skip this and assume manual clone or provide instructions
    echo "⚠️  Repository clone step - run manually:"
    echo "   git clone <your-repo-url> $PROJECT_DIR"
else
    echo "✅ Repository already cloned"
    git pull || true
fi

# 9. Set up basic configuration files
echo "⚙️  Setting up configuration..."
mkdir -p $PROJECT_DIR/backend
mkdir -p $PROJECT_DIR/frontend

# 10. Create .env file templates (if they don't exist)
echo "📝 Creating .env file templates..."
cat > $PROJECT_DIR/backend/.env.example << 'EOF'
ENV_MODE=production
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
REDIS_HOST=redis
REDIS_PORT=6379
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
ENCRYPTION_KEY=
NEXT_PUBLIC_URL=https://iris.yourdomain.com
EOF

echo "✅ VM Configuration Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Clone your repository: git clone <repo-url> $PROJECT_DIR"
echo "2. Copy your .env files to backend/.env and frontend/.env.local"
echo "3. Configure the .env files with your actual values"
echo "4. Run: docker-compose up -d"
echo ""


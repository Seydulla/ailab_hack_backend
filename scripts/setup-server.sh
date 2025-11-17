#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if running as root or with sudo
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root. Run it as a regular user with sudo privileges."
    exit 1
fi

# Check sudo access
if ! sudo -n true 2>/dev/null; then
    print_info "This script requires sudo privileges. You may be prompted for your password."
fi

echo ""
echo "=========================================="
echo "  AILab Hack Backend - Server Setup"
echo "=========================================="
echo ""

# Step 1: Update System
print_info "Step 1/9: Updating system packages..."
sudo apt update && sudo apt upgrade -y
print_success "System updated"

# Step 2: Install Basic Tools
print_info "Step 2/9: Installing basic tools (curl, git, build-essential)..."
sudo apt install -y curl git build-essential ca-certificates gnupg lsb-release
print_success "Basic tools installed"

# Step 3: Install Node.js 22 LTS
print_info "Step 3/9: Installing Node.js 22 LTS..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 22 ]; then
        print_warning "Node.js v$NODE_VERSION already installed, skipping..."
    else
        print_info "Node.js version $NODE_VERSION detected, upgrading to v22..."
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
print_success "Node.js $NODE_VERSION and npm $NPM_VERSION installed"

# Step 4: Install Yarn
print_info "Step 4/9: Installing Yarn..."
if command -v yarn &> /dev/null; then
    YARN_VERSION=$(yarn --version)
    print_warning "Yarn $YARN_VERSION already installed, skipping..."
else
    sudo npm install -g yarn
    YARN_VERSION=$(yarn --version)
    print_success "Yarn $YARN_VERSION installed"
fi

# Step 5: Install PM2
print_info "Step 5/9: Installing PM2..."
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 --version)
    print_warning "PM2 $PM2_VERSION already installed, skipping..."
else
    sudo npm install -g pm2
    PM2_VERSION=$(pm2 --version)
    print_success "PM2 $PM2_VERSION installed"
fi

# Configure PM2 startup
print_info "Configuring PM2 to start on boot..."
print_warning "PM2 startup command will be displayed. Please run it manually if needed."
pm2 startup systemd -u $USER --hp $HOME || print_warning "PM2 startup configuration skipped (may need manual setup)"

# Step 6: Install Docker
print_info "Step 6/9: Installing Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_warning "Docker already installed: $DOCKER_VERSION"
else
    print_info "Downloading and installing Docker..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh
    rm /tmp/get-docker.sh
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    print_success "Docker installed"
    print_warning "You may need to log out and log back in for Docker group changes to take effect."
    print_info "Or run: newgrp docker"
fi

# Step 7: Install Docker Compose V2
print_info "Step 7/9: Installing Docker Compose V2..."
if docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    print_warning "Docker Compose already installed: $COMPOSE_VERSION"
else
    sudo apt install -y docker-compose-plugin
    print_success "Docker Compose V2 installed"
fi

# Step 8: Install Nginx
print_info "Step 8/9: Installing Nginx..."
if command -v nginx &> /dev/null; then
    NGINX_VERSION=$(nginx -v 2>&1 | cut -d'/' -f2)
    print_warning "Nginx already installed: $NGINX_VERSION"
else
    sudo apt install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    print_success "Nginx installed and started"
fi

# Step 9: Install Certbot
print_info "Step 9/9: Installing Certbot (Let's Encrypt)..."
if command -v certbot &> /dev/null; then
    CERTBOT_VERSION=$(certbot --version | cut -d' ' -f2)
    print_warning "Certbot already installed: $CERTBOT_VERSION"
else
    sudo apt install -y certbot python3-certbot-nginx
    print_success "Certbot installed"
fi

# Configure Firewall
print_info "Configuring firewall (UFW)..."
if command -v ufw &> /dev/null; then
    if sudo ufw status | grep -q "Status: active"; then
        print_warning "UFW is already active"
    else
        sudo ufw allow OpenSSH
        sudo ufw allow 'Nginx Full'
        print_info "Firewall rules added. Enable with: sudo ufw enable"
        print_warning "Firewall not automatically enabled for safety. Enable manually when ready."
    fi
else
    sudo apt install -y ufw
    sudo ufw allow OpenSSH
    sudo ufw allow 'Nginx Full'
    print_info "Firewall rules added. Enable with: sudo ufw enable"
    print_warning "Firewall not automatically enabled for safety. Enable manually when ready."
fi

# Verification
echo ""
echo "=========================================="
print_info "Verification Summary"
echo "=========================================="

# Check Node.js
if command -v node &> /dev/null; then
    print_success "Node.js: $(node --version)"
else
    print_error "Node.js: Not found"
fi

# Check npm
if command -v npm &> /dev/null; then
    print_success "npm: $(npm --version)"
else
    print_error "npm: Not found"
fi

# Check Yarn
if command -v yarn &> /dev/null; then
    print_success "Yarn: $(yarn --version)"
else
    print_error "Yarn: Not found"
fi

# Check PM2
if command -v pm2 &> /dev/null; then
    print_success "PM2: $(pm2 --version)"
else
    print_error "PM2: Not found"
fi

# Check Docker
if command -v docker &> /dev/null; then
    print_success "Docker: $(docker --version)"
else
    print_error "Docker: Not found"
fi

# Check Docker Compose
if docker compose version &> /dev/null; then
    print_success "Docker Compose: $(docker compose version)"
else
    print_error "Docker Compose: Not found"
fi

# Check Nginx
if command -v nginx &> /dev/null; then
    print_success "Nginx: $(nginx -v 2>&1 | cut -d'/' -f2)"
else
    print_error "Nginx: Not found"
fi

# Check Certbot
if command -v certbot &> /dev/null; then
    print_success "Certbot: $(certbot --version | cut -d' ' -f2)"
else
    print_error "Certbot: Not found"
fi

echo ""
echo "=========================================="
print_success "Server setup completed!"
echo "=========================================="
echo ""
print_info "Next steps:"
echo "  1. If Docker was just installed, log out and log back in (or run: newgrp docker)"
echo "  2. Clone your repository: git clone <repo-url>"
echo "  3. Copy nginx config: sudo cp nginx/ailab.seydulla.com.conf /etc/nginx/sites-available/"
echo "  4. Enable site: sudo ln -s /etc/nginx/sites-available/ailab.seydulla.com /etc/nginx/sites-enabled/"
echo "  5. Obtain SSL certificate: sudo certbot --nginx -d ailab.seydulla.com"
echo "  6. Set up your .env file with production variables"
echo "  7. Start Docker services: docker compose -f docker-compose.prod.yml up -d"
echo "  8. Build and start app: yarn install && yarn build && pm2 start ecosystem.config.js"
echo ""
print_warning "Don't forget to enable firewall when ready: sudo ufw enable"
echo ""


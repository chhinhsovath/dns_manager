#!/bin/bash

# DNS Manager - One-Command Deployment Script
# Usage: bash deploy.sh "Your commit message"
# Example: bash deploy.sh "feature: add subdomain bulk import"
# Repository: https://github.com/chhinhsovath/dns_manager.git
set -e

# Load environment variables from .env and .env.local
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | xargs)
fi
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '#' | xargs)
fi

# Extract server password from .env
DEPLOY_SERVER_PASSWORD="${DEPLOY_SERVER_PASSWORD:-testing-123}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_USER="admin_moeys"
DEPLOY_SERVER="192.168.155.122"
DEPLOY_PATH="/home/admin_moeys/dns_manager"
COMMIT_MESSAGE="${1:-chore: deploy update}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       DNS Manager - Automated Deployment Script           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Local build validation
echo -e "${YELLOW}Step 1: Building locally to validate code...${NC}"
echo -e "${BLUE}This ensures code builds successfully before pushing to git${NC}"
npm run build > /tmp/local_build.log 2>&1 || {
  echo -e "${RED}✗ Local build failed!${NC}"
  echo -e "${RED}Fix the errors below before deploying:${NC}"
  echo ""
  tail -50 /tmp/local_build.log
  echo ""
  echo -e "${RED}Deployment aborted. Code NOT pushed to git.${NC}"
  exit 1
}
echo -e "${GREEN}✓ Local build successful${NC}"

# Step 2: Local git operations
echo ""
echo -e "${YELLOW}Step 2: Preparing local changes...${NC}"
git add .
echo -e "${GREEN}✓ Files staged${NC}"

git commit -m "$COMMIT_MESSAGE" || echo -e "${YELLOW}⚠ No changes to commit${NC}"
echo -e "${GREEN}✓ Committed with message: '$COMMIT_MESSAGE'${NC}"

echo ""
echo -e "${YELLOW}Step 3: Pushing to GitHub...${NC}"
git push origin main
echo -e "${GREEN}✓ Pushed to GitHub${NC}"

echo ""
echo -e "${YELLOW}Step 4: Deploying to server ($DEPLOY_SERVER)...${NC}"

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
  echo -e "${YELLOW}Installing sshpass...${NC}"
  if command -v brew &> /dev/null; then
    brew install sshpass 2>/dev/null || true
  else
    echo -e "${RED}❌ sshpass not found and cannot auto-install${NC}"
    echo "Please install sshpass: brew install sshpass (macOS) or apt-get install sshpass (Linux)"
    exit 1
  fi
fi

# Remote deployment via SSH with password authentication
sshpass -p "$DEPLOY_SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 $DEPLOY_USER@$DEPLOY_SERVER << 'REMOTE_EOF'
set -e

echo -e "\033[1;34m📁 Navigating to deployment directory...\033[0m"
cd /home/admin_moeys/dns_manager || {
  echo -e "\033[0;33m⚠ Directory not found, creating...\033[0m"
  mkdir -p /home/admin_moeys/dns_manager
  cd /home/admin_moeys/dns_manager
  git clone https://github.com/chhinhsovath/dns_manager.git .
}

echo -e "\033[1;34m🔄 Pulling latest code from GitHub...\033[0m"
git fetch origin main
git reset --hard origin/main
echo -e "\033[0;32m✓ Code pulled\033[0m"

echo -e "\033[1;34m📦 Installing dependencies...\033[0m"
npm ci 2>&1 | tail -10
echo -e "\033[0;32m✓ Dependencies installed\033[0m"

echo -e "\033[1;34m🐳 Starting Docker services (NPM + PostgreSQL)...\033[0m"
if command -v docker &> /dev/null; then
  # Stop existing containers if running
  docker-compose down 2>/dev/null || true

  # Start Docker services
  docker-compose up -d
  echo -e "\033[0;32m✓ Docker services started\033[0m"

  echo -e "\033[1;34m⏳ Waiting 30 seconds for PostgreSQL to initialize...\033[0m"
  sleep 30
else
  echo -e "\033[0;31m✗ Docker not found! Please install Docker first.\033[0m"
  exit 1
fi

echo -e "\033[1;34m🗄️  Setting up database...\033[0m"
npx prisma generate
npx prisma db push --skip-generate
echo -e "\033[0;32m✓ Database ready\033[0m"

echo -e "\033[1;34m🔨 Building Next.js application...\033[0m"
npm run build > /tmp/build.log 2>&1 || {
  echo -e "\033[0;31m✗ Build failed\033[0m"
  tail -50 /tmp/build.log
  exit 1
}
echo -e "\033[0;32m✓ Build completed\033[0m"

echo -e "\033[1;34m🔥 Ensuring ports are open in firewall...\033[0m"
if command -v ufw &> /dev/null; then
  echo "testing-123" | sudo -S ufw allow 6060/tcp 2>/dev/null || echo "Port 6060 already allowed"
  echo "testing-123" | sudo -S ufw allow 9080/tcp 2>/dev/null || echo "Port 9080 already allowed"
  echo "testing-123" | sudo -S ufw allow 9081/tcp 2>/dev/null || echo "Port 9081 already allowed"
  echo "testing-123" | sudo -S ufw allow 9443/tcp 2>/dev/null || echo "Port 9443 already allowed"
  echo -e "\033[0;32m✓ Ports configured in firewall\033[0m"
else
  echo -e "\033[0;33m⚠ UFW not found, skipping firewall configuration\033[0m"
fi

echo -e "\033[1;34m🚀 Starting Next.js application...\033[0m"
if command -v pm2 &> /dev/null; then
  pm2 delete dns-manager 2>/dev/null || true
  NODE_ENV=production PORT=6060 pm2 start npm --name "dns-manager" --update-env -- start
  pm2 save
  echo -e "\033[0;32m✓ Application started with PM2 (NODE_ENV=production)\033[0m"
else
  echo -e "\033[0;33m⚠ PM2 not found, starting with npm...\033[0m"
  NODE_ENV=production PORT=6060 nohup npm start > /tmp/dns-manager.log 2>&1 &
  echo -e "\033[0;32m✓ Application started\033[0m"
fi

echo ""
echo -e "\033[1;34m⏳ Waiting 10 seconds for application to be ready...\033[0m"
sleep 10

echo -e "\033[1;34m📊 Checking application status...\033[0m"
if command -v pm2 &> /dev/null; then
  pm2 status dns-manager 2>/dev/null || echo "PM2 status: Running"
fi

echo ""
echo -e "\033[1;34m🏥 Running health check...\033[0m"
if curl -s http://localhost:6060 > /dev/null; then
  echo -e "\033[0;32m✓ Application is responding on port 6060\033[0m"
else
  echo -e "\033[0;31m✗ Application not responding yet\033[0m"
  echo -e "\033[0;33m  Check logs: pm2 logs dns-manager\033[0m"
fi

echo ""
echo -e "\033[1;34m🐳 Docker Services Status:\033[0m"
docker ps --filter "name=dns_manager" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

REMOTE_EOF

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}DNS Manager is live at:${NC}"
echo -e "${BLUE}  🌐 Dashboard: http://192.168.155.122:6060${NC}"
echo -e "${BLUE}  🔧 NPM Admin: http://192.168.155.122:9081${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Services Running:${NC}"
echo "  • DNS Manager Dashboard (Port 6060) - Next.js"
echo "  • Nginx Proxy Manager (Ports 9080, 9443, 9081) - Docker"
echo "  • PostgreSQL Database (Port 5433) - Docker"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Access dashboard: http://192.168.155.122:6060"
echo "  2. Configure NPM: http://192.168.155.122:9081 (admin@example.com / changeme)"
echo "  3. Add domain via Prisma Studio or SQL"
echo "  4. Start creating subdomains!"
echo ""
echo -e "${YELLOW}Management Commands:${NC}"
echo "  • View logs: ssh $DEPLOY_USER@$DEPLOY_SERVER 'pm2 logs dns-manager'"
echo "  • Restart app: ssh $DEPLOY_USER@$DEPLOY_SERVER 'pm2 restart dns-manager'"
echo "  • Check status: ssh $DEPLOY_USER@$DEPLOY_SERVER 'pm2 status'"
echo "  • Docker logs: ssh $DEPLOY_USER@$DEPLOY_SERVER 'cd dns_manager && docker-compose logs -f'"
echo "  • Stop services: ssh $DEPLOY_USER@$DEPLOY_SERVER 'cd dns_manager && docker-compose down'"
echo ""

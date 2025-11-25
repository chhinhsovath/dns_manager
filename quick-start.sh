#!/bin/bash

# DNS Manager Quick Start Script
# This script automates the initial setup

set -e  # Exit on error

echo "=========================================="
echo "DNS Manager - Quick Start Setup"
echo "=========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ All prerequisites installed"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Copying .env.example to .env..."
    cp .env.example .env
    echo ""
    echo "❗ IMPORTANT: Please edit .env file with your credentials:"
    echo "   - CLOUDFLARE_API_TOKEN"
    echo "   - CLOUDFLARE_ZONE_ID"
    echo "   - CLOUDFLARE_EMAIL"
    echo "   - DATABASE_URL password"
    echo ""
    echo "After editing .env, run this script again."
    exit 0
fi

echo "✅ .env file found"
echo ""

# Check if required env vars are set
source .env

if [ "$CLOUDFLARE_API_TOKEN" == "your-cloudflare-api-token-here" ]; then
    echo "❌ Please configure CLOUDFLARE_API_TOKEN in .env file"
    exit 1
fi

if [ "$CLOUDFLARE_ZONE_ID" == "your-openplp-org-zone-id-here" ]; then
    echo "❌ Please configure CLOUDFLARE_ZONE_ID in .env file"
    exit 1
fi

echo "✅ Environment variables configured"
echo ""

# Start Docker services
echo "Starting Docker containers..."
docker-compose up -d

echo "Waiting for containers to initialize (30 seconds)..."
sleep 30

# Check if containers are running
if ! docker ps | grep -q dns_manager_npm; then
    echo "❌ Nginx Proxy Manager container failed to start"
    echo "Check logs: docker logs dns_manager_npm"
    exit 1
fi

if ! docker ps | grep -q dns_manager_db; then
    echo "❌ PostgreSQL container failed to start"
    echo "Check logs: docker logs dns_manager_db"
    exit 1
fi

echo "✅ Docker containers running"
echo ""

# Install npm dependencies
echo "Installing Node.js dependencies..."
npm install

# Setup database
echo "Setting up database..."
npm run db:generate
npm run db:push

echo "✅ Database setup complete"
echo ""

# Instructions for next steps
echo "=========================================="
echo "Setup Complete! 🎉"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Configure Nginx Proxy Manager:"
echo "   Open: http://localhost:81"
echo "   Login: admin@example.com / changeme"
echo "   Change password and update .env file"
echo ""
echo "2. Add domain to database:"
echo "   Run: npm run db:studio"
echo "   Add record to 'domains' table:"
echo "   - domain_name: openplp.org"
echo "   - cloudflare_zone_id: $CLOUDFLARE_ZONE_ID"
echo ""
echo "3. Start the dashboard:"
echo "   Run: npm run dev"
echo "   Open: http://localhost:6060"
echo ""
echo "4. Create your first subdomain via the UI!"
echo ""
echo "For detailed instructions, see SETUP.md"
echo ""

# DNS Manager - Complete Setup Guide

This guide walks you through setting up the DNS Manager system from scratch.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Docker and Docker Compose installed
- [ ] Node.js 18+ and npm installed
- [ ] Access to Cloudflare account with openplp.org
- [ ] Server access (192.168.155.122) with sudo privileges
- [ ] Ports 80, 443, 81, 5432 available

## Step-by-Step Setup

### Step 1: Get Cloudflare Credentials (5 minutes)

#### Get API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit zone DNS" template
4. Permissions needed:
   - Zone - DNS - Edit
   - Zone - Zone - Read
5. Zone Resources: Include - Specific zone - openplp.org
6. Click "Continue to summary" → "Create Token"
7. **Copy the token** (you won't see it again)

#### Get Zone ID

1. Go to https://dash.cloudflare.com
2. Click on openplp.org domain
3. Scroll down right sidebar to "API" section
4. Copy the "Zone ID"

### Step 2: Clone and Configure (5 minutes)

```bash
cd /Users/chhinhsovath/Documents/GitServers/DNS_Manager

# Copy environment template
cp .env.example .env

# Edit with your credentials
nano .env
```

**Required values in `.env`:**

```bash
# Database - Change password to something secure
DATABASE_URL="postgresql://dns_admin:YOUR_SECURE_PASSWORD@localhost:5432/dns_manager?schema=public"

# Cloudflare - Use values from Step 1
CLOUDFLARE_API_TOKEN="your-token-here"
CLOUDFLARE_ZONE_ID="your-zone-id-here"
CLOUDFLARE_EMAIL="your-email@example.com"

# NPM - Keep defaults for now
NPM_API_URL="http://localhost:81/api"
NPM_EMAIL="admin@example.com"
NPM_PASSWORD="changeme"

# Server
HOST_SERVER_IP="192.168.155.122"
```

### Step 3: Start Docker Services (2 minutes)

```bash
# Start NPM and PostgreSQL containers
npm run docker:up

# Verify containers are running
docker ps

# You should see:
# - dns_manager_npm (Nginx Proxy Manager)
# - dns_manager_db (PostgreSQL)
```

**Wait 30 seconds** for containers to fully initialize.

### Step 4: Setup Next.js Application (3 minutes)

```bash
# Install Node.js dependencies
npm install

# Generate Prisma client
npm run db:generate

# Create database tables
npm run db:push

# Verify database setup
npm run db:studio
# Opens http://localhost:5555 - you should see empty tables
```

### Step 5: Configure Nginx Proxy Manager (5 minutes)

1. Open http://192.168.155.122:81 (or http://localhost:81)

2. Login with default credentials:
   - Email: `admin@example.com`
   - Password: `changeme`

3. You'll be prompted to:
   - Change email (use your real email)
   - Change password (use strong password)
   - Enter your name

4. **Important**: Update `.env` with new credentials:
   ```bash
   NPM_EMAIL="your-new-email@example.com"
   NPM_PASSWORD="your-new-password"
   ```

### Step 6: Add Domain to Database (2 minutes)

**Option A: Using Prisma Studio (Recommended)**

```bash
# Open Prisma Studio
npm run db:studio
```

1. Click "domains" table
2. Click "Add record"
3. Fill in:
   - `domain_name`: openplp.org
   - `cloudflare_zone_id`: (paste from Step 1)
4. Click "Save 1 change"

**Option B: Using SQL**

```bash
# Connect to database
docker exec -it dns_manager_db psql -U dns_admin -d dns_manager

# Insert domain
INSERT INTO domains (domain_name, cloudflare_zone_id)
VALUES ('openplp.org', 'YOUR_ZONE_ID_HERE');

# Verify
SELECT * FROM domains;

# Exit
\q
```

### Step 7: Start Dashboard (1 minute)

```bash
# Development mode
npm run dev

# Or production mode
npm run build
npm start
```

Dashboard will be available at: http://localhost:6060

### Step 8: Create Your First Subdomain (2 minutes)

1. Open http://localhost:6060
2. Click "Add Subdomain" button
3. Fill in form:
   - Domain: openplp.org
   - Subdomain Name: `test`
   - Target Port: `5050` (or any port your service runs on)
   - Protocol: HTTP
   - Enable SSL: ✓ (checked)
   - Description: "Test subdomain"
4. Click "Create Subdomain"

**What happens:**
- Creates `test.openplp.org` DNS A record in Cloudflare
- Configures Nginx to proxy `test.openplp.org` → `192.168.155.122:5050`
- Requests Let's Encrypt SSL certificate
- Saves configuration to database

**Verify:**
1. Check Cloudflare DNS: https://dash.cloudflare.com → DNS → Records
2. Check NPM: http://localhost:81 → Hosts → Proxy Hosts
3. Test subdomain: http://test.openplp.org (should route to your service)

## Common Setup Issues

### Issue: Docker containers won't start

**Error**: Port already in use

**Fix**:
```bash
# Check what's using the ports
lsof -i :80
lsof -i :443
lsof -i :81

# Stop conflicting services
sudo systemctl stop nginx  # If Nginx is running
sudo systemctl stop apache2  # If Apache is running

# Or change ports in docker-compose.yml
```

### Issue: Can't connect to NPM API

**Error**: "NPM Authentication failed"

**Fix**:
1. Verify NPM is running: `docker ps | grep npm`
2. Access NPM UI: http://localhost:81
3. Ensure `.env` credentials match NPM login
4. Check logs: `docker logs dns_manager_npm`

### Issue: Cloudflare API errors

**Error**: "Cloudflare API authentication failed"

**Fix**:
1. Verify API token has correct permissions
2. Check Zone ID matches openplp.org
3. Test API manually:
   ```bash
   curl -X GET "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID" \
     -H "Authorization: Bearer YOUR_API_TOKEN" \
     -H "Content-Type: application/json"
   ```

### Issue: Database connection failed

**Error**: "Can't reach database server"

**Fix**:
```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs dns_manager_db

# Try manual connection
docker exec -it dns_manager_db psql -U dns_admin -d dns_manager

# If password wrong, restart with correct password:
docker-compose down
# Edit docker-compose.yml with matching password
docker-compose up -d
```

## Production Deployment

### Deploy to 192.168.155.122

```bash
# SSH to server
ssh ubuntu@192.168.155.122

# Clone repository
cd /opt
sudo git clone <repo-url> dns-manager
cd dns-manager

# Setup environment
cp .env.example .env
sudo nano .env  # Configure production values

# Install dependencies
npm install

# Start services
npm run docker:up
npm run setup

# Build application
npm run build

# Option 1: Run with PM2 (recommended)
sudo npm install -g pm2
pm2 start npm --name "dns-manager" -- start
pm2 save
pm2 startup

# Option 2: Run with systemd
sudo nano /etc/systemd/system/dns-manager.service
```

**systemd service file:**

```ini
[Unit]
Description=DNS Manager Dashboard
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/dns-manager
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable dns-manager
sudo systemctl start dns-manager
sudo systemctl status dns-manager
```

### Firewall Configuration

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Restrict NPM admin panel (only local access)
sudo ufw deny 81/tcp

# Restrict PostgreSQL (only local access)
sudo ufw deny 5432/tcp

# Enable firewall
sudo ufw enable
```

### SSL Certificate Management

**Automatic (via NPM):**
- Enable SSL when creating subdomain in dashboard
- NPM handles Let's Encrypt automatically

**Manual (if needed):**
1. Go to NPM UI: http://localhost:81
2. SSL Certificates → Add SSL Certificate
3. Choose "Let's Encrypt"
4. Enter domain names
5. Enable "Force SSL" on proxy hosts

## Backup and Restore

### Backup Database

```bash
# Backup
docker exec dns_manager_db pg_dump -U dns_admin dns_manager > backup.sql

# With timestamp
docker exec dns_manager_db pg_dump -U dns_admin dns_manager > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database

```bash
# Restore
docker exec -i dns_manager_db psql -U dns_admin dns_manager < backup.sql
```

### Backup NPM Configuration

```bash
# Backup NPM data
tar -czf npm_backup.tar.gz npm-data/
```

## Monitoring

### View Logs

```bash
# NPM logs
docker logs -f dns_manager_npm

# PostgreSQL logs
docker logs -f dns_manager_db

# Next.js logs (if using PM2)
pm2 logs dns-manager

# Activity logs (in database)
npm run db:studio
# Click "activity_logs" table
```

### Health Checks

```bash
# Check all containers
docker ps

# Check disk space
df -h

# Check NPM status
curl -I http://localhost:81

# Check dashboard
curl -I http://localhost:6060

# Check specific subdomain
curl -I http://mel.openplp.org
```

## Next Steps

1. Create subdomains for your existing services:
   - mel.openplp.org → 5050
   - blog.openplp.org → 5051
   - wiki.openplp.org → 5052

2. Enable SSL for all subdomains

3. Set up automatic backups (cron job)

4. Add authentication to Next.js dashboard

5. Configure monitoring and alerts

## Support

If you encounter issues:

1. Check logs: `npm run docker:logs`
2. Review activity_logs table: `npm run db:studio`
3. Verify NPM UI: http://localhost:81
4. Test Cloudflare API credentials
5. Check DNS propagation: https://dnschecker.org

For more help:
- CLAUDE.md - Project-specific guidelines
- README.md - Complete documentation
- Nginx Proxy Manager docs: https://nginxproxymanager.com

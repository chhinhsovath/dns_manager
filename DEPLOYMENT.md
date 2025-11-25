# DNS Manager - Production Deployment Guide

This guide covers deploying DNS Manager to your production server (192.168.155.122) using the automated deployment script.

## Prerequisites

**On Your Local Machine:**
- Git configured with GitHub access
- Node.js 18+ installed
- sshpass installed (for automated deployment)

**On Production Server (192.168.155.122):**
- Docker and Docker Compose installed
- Node.js 18+ installed
- PM2 installed (`npm install -g pm2`)
- SSH access with username: `admin_moeys`
- Ports available: 6060 (dashboard), 80, 443, 81 (NPM), 5432 (PostgreSQL)

## Port Configuration on Server

The DNS Manager uses these ports on 192.168.155.122:

| Port | Service | Public? | Purpose |
|------|---------|---------|---------|
| 80 | Nginx Proxy Manager | ✅ Yes | HTTP (redirects to HTTPS) |
| 443 | Nginx Proxy Manager | ✅ Yes | HTTPS with SSL |
| 81 | NPM Admin UI | ❌ No | Manage proxy hosts (internal only) |
| 6060 | DNS Manager Dashboard | ❌ No | Web UI (internal only) |
| 5432 | PostgreSQL | ❌ No | Database (Docker, internal only) |

**No conflicts with existing services:**
- Port 5050: plp-contract-agreement (mel.openplp.org)
- Ports 3030, 3033, 4040, 4044: Other services

## Setup Environment Variables

1. **Add deployment password to `.env`:**

```bash
# In /Users/chhinhsovath/Documents/GitServers/DNS_Manager/.env
DEPLOY_SERVER_PASSWORD="testing-123"
```

2. **Verify all credentials are set:**

```bash
# Check .env has these values
CLOUDFLARE_API_TOKEN="Q-Xm43SUgAxSIDrCZrPA7xPAOkKfwD39YYodLIiZ"
CLOUDFLARE_ZONE_ID="3b07695865141ef45be7adc352decc5a"
CLOUDFLARE_EMAIL="Chhinhs@gmail.com"
DATABASE_URL="postgresql://ped_dns_manager:admin_moeys@localhost:5432/ped_dns_manager?schema=public"
NPM_EMAIL="chhinhhs@gmail.com"
NPM_PASSWORD="changeme"
HOST_SERVER_IP="192.168.155.122"
DEPLOY_SERVER_PASSWORD="testing-123"
```

## One-Command Deployment

The `deploy.sh` script handles everything automatically:

```bash
cd /Users/chhinhsovath/Documents/GitServers/DNS_Manager

# Deploy with custom commit message
bash deploy.sh "feature: add bulk subdomain import"

# Or use default message
bash deploy.sh
```

### What the Script Does:

**Local Steps:**
1. ✅ Validates code builds locally
2. ✅ Stages all changes to git
3. ✅ Commits with your message
4. ✅ Pushes to GitHub

**Remote Steps (on 192.168.155.122):**
1. ✅ Creates `/home/admin_moeys/dns_manager` directory
2. ✅ Clones/pulls latest code from GitHub
3. ✅ Installs npm dependencies
4. ✅ Starts Docker services (NPM + PostgreSQL)
5. ✅ Waits for PostgreSQL to initialize (30 seconds)
6. ✅ Runs Prisma migrations
7. ✅ Builds Next.js application
8. ✅ Opens port 6060 in firewall
9. ✅ Starts app with PM2 on port 6060
10. ✅ Verifies deployment health

## First-Time Deployment Steps

### Step 1: Run Deployment Script

```bash
cd /Users/chhinhsovath/Documents/GitServers/DNS_Manager
bash deploy.sh "initial deployment"
```

### Step 2: Configure Nginx Proxy Manager

1. **Access NPM Admin UI:**
   ```
   http://192.168.155.122:81
   ```

2. **First Login:**
   - Email: `admin@example.com`
   - Password: `changeme`

3. **Change Credentials:**
   - Update email to: `chhinhhs@gmail.com`
   - Set strong password
   - Update `.env` with new credentials

4. **Update `.env` locally and on server:**
   ```bash
   # Local
   nano .env
   # Update NPM_EMAIL and NPM_PASSWORD

   # Then redeploy
   bash deploy.sh "update: NPM credentials"
   ```

### Step 3: Add Domain to Database

**Option A: Via SSH and Prisma Studio**

```bash
ssh admin_moeys@192.168.155.122
cd /home/admin_moeys/dns_manager
npx prisma studio
```

Then in browser (http://192.168.155.122:5555):
- Click "domains" table
- Add record:
  - `domain_name`: openplp.org
  - `cloudflare_zone_id`: 3b07695865141ef45be7adc352decc5a

**Option B: Via SQL**

```bash
ssh admin_moeys@192.168.155.122
docker exec -it dns_manager_db psql -U ped_dns_manager -d ped_dns_manager

INSERT INTO domains (domain_name, cloudflare_zone_id)
VALUES ('openplp.org', '3b07695865141ef45be7adc352decc5a');

SELECT * FROM domains;
\q
```

### Step 4: Access Dashboard

```
http://192.168.155.122:6060
```

You should see the DNS Manager dashboard ready to create subdomains!

## Subdomain Management Workflow

### Create Your First Subdomain

1. Open dashboard: http://192.168.155.122:6060
2. Click "Add Subdomain"
3. Fill form:
   - **Domain**: openplp.org
   - **Subdomain Name**: test
   - **Target Port**: 5050 (or your service port)
   - **Protocol**: HTTP
   - **Enable SSL**: ✓
4. Click "Create Subdomain"

**Result:**
- DNS record created: test.openplp.org → 192.168.155.122
- NPM proxy configured: test.openplp.org → localhost:5050
- SSL certificate requested from Let's Encrypt
- Accessible at: https://test.openplp.org

## Management Commands

### Application Management

```bash
# View logs
ssh admin_moeys@192.168.155.122 'pm2 logs dns-manager'

# Restart application
ssh admin_moeys@192.168.155.122 'pm2 restart dns-manager'

# Stop application
ssh admin_moeys@192.168.155.122 'pm2 stop dns-manager'

# Check status
ssh admin_moeys@192.168.155.122 'pm2 status'

# View all PM2 processes
ssh admin_moeys@192.168.155.122 'pm2 list'
```

### Docker Services Management

```bash
# View Docker container status
ssh admin_moeys@192.168.155.122 'docker ps'

# View NPM logs
ssh admin_moeys@192.168.155.122 'docker logs -f dns_manager_npm'

# View PostgreSQL logs
ssh admin_moeys@192.168.155.122 'docker logs -f dns_manager_db'

# Restart Docker services
ssh admin_moeys@192.168.155.122 'cd dns_manager && docker-compose restart'

# Stop Docker services
ssh admin_moeys@192.168.155.122 'cd dns_manager && docker-compose down'

# Start Docker services
ssh admin_moeys@192.168.155.122 'cd dns_manager && docker-compose up -d'
```

### Database Management

```bash
# Access PostgreSQL CLI
ssh admin_moeys@192.168.155.122
docker exec -it dns_manager_db psql -U ped_dns_manager -d ped_dns_manager

# Backup database
ssh admin_moeys@192.168.155.122 \
  'docker exec dns_manager_db pg_dump -U ped_dns_manager ped_dns_manager' > backup.sql

# Restore database
cat backup.sql | ssh admin_moeys@192.168.155.122 \
  'docker exec -i dns_manager_db psql -U ped_dns_manager ped_dns_manager'
```

## Redeployment (Updates)

For subsequent deployments after code changes:

```bash
cd /Users/chhinhsovath/Documents/GitServers/DNS_Manager

# Make your code changes
# Edit files...

# Deploy with one command
bash deploy.sh "fix: resolve subdomain deletion bug"
```

The script will:
1. Build and validate locally
2. Push to GitHub
3. Pull on server
4. Rebuild and restart

**Zero downtime:** PM2 handles graceful restarts.

## Troubleshooting

### Issue: Local build fails

**Error:** `npm run build` fails before deployment

**Solution:**
```bash
# Fix the errors shown in output
# Common issues:
# - TypeScript errors
# - Missing dependencies
# - Import errors

# Verify build works
npm run build

# Then redeploy
bash deploy.sh "fix: resolve build errors"
```

### Issue: Docker containers not starting

**Error:** PostgreSQL or NPM containers fail to start

**Solution:**
```bash
ssh admin_moeys@192.168.155.122
cd /home/admin_moeys/dns_manager

# Check Docker status
docker ps -a

# View logs
docker logs dns_manager_db
docker logs dns_manager_npm

# Restart Docker services
docker-compose down
docker-compose up -d

# Check if ports are in use
sudo lsof -i :5432
sudo lsof -i :81
```

### Issue: Application not responding on port 6060

**Error:** `curl http://localhost:6060` fails

**Solution:**
```bash
ssh admin_moeys@192.168.155.122

# Check PM2 status
pm2 status dns-manager

# View application logs
pm2 logs dns-manager

# Check if port is in use
sudo lsof -i :6060

# Restart application
pm2 restart dns-manager
```

### Issue: Firewall blocking access

**Error:** Cannot access from outside server

**Solution:**
```bash
ssh admin_moeys@192.168.155.122

# Check firewall status
sudo ufw status

# Open required ports
echo "testing-123" | sudo -S ufw allow 80/tcp
echo "testing-123" | sudo -S ufw allow 443/tcp
echo "testing-123" | sudo -S ufw allow 81/tcp
echo "testing-123" | sudo -S ufw allow 6060/tcp
```

### Issue: Cloudflare API errors

**Error:** DNS records not created

**Solution:**
1. Verify API token is valid:
   ```bash
   curl "https://api.cloudflare.com/client/v4/user/tokens/verify" \
     -H "Authorization: Bearer Q-Xm43SUgAxSIDrCZrPA7xPAOkKfwD39YYodLIiZ"
   ```

2. Check Zone ID is correct for openplp.org

3. Verify token has DNS edit permissions

## Monitoring

### Health Checks

```bash
# Check dashboard
curl http://192.168.155.122:6060

# Check NPM
curl http://192.168.155.122:81

# Check Docker services
ssh admin_moeys@192.168.155.122 'docker ps'

# Check database connectivity
ssh admin_moeys@192.168.155.122 \
  'docker exec dns_manager_db pg_isready -U ped_dns_manager'
```

### Resource Usage

```bash
ssh admin_moeys@192.168.155.122

# Check disk space
df -h

# Check memory usage
free -h

# Check Docker disk usage
docker system df

# Check PM2 resource usage
pm2 monit
```

## Accessing Services

### From Internal Network (192.168.155.x):

- **Dashboard**: http://192.168.155.122:6060
- **NPM Admin**: http://192.168.155.122:81
- **Managed Subdomains**: https://[subdomain].openplp.org

### From Internet:

- **Only subdomains** created via dashboard are publicly accessible
- Dashboard (6060) and NPM Admin (81) should remain internal only
- All public traffic goes through ports 80/443 (managed by NPM)

## Security Recommendations

1. **Restrict Admin Access:**
   ```bash
   # Only allow dashboard access from internal network
   sudo ufw deny 6060/tcp
   sudo ufw allow from 192.168.155.0/24 to any port 6060

   # Same for NPM admin
   sudo ufw deny 81/tcp
   sudo ufw allow from 192.168.155.0/24 to any port 81
   ```

2. **Change Default Passwords:**
   - NPM admin password
   - PostgreSQL password
   - Server SSH password

3. **Enable SSL for All Subdomains:**
   - Always check "Enable SSL" when creating subdomains
   - Let's Encrypt handles certificates automatically

4. **Regular Backups:**
   ```bash
   # Set up daily database backup cron
   ssh admin_moeys@192.168.155.122
   crontab -e

   # Add this line:
   0 2 * * * docker exec dns_manager_db pg_dump -U ped_dns_manager ped_dns_manager > /home/admin_moeys/backups/dns_manager_$(date +\%Y\%m\%d).sql
   ```

## Integration with Existing Services

DNS Manager can now manage all your subdomains on 192.168.155.122:

**Current Services:**
- mel.openplp.org → Port 5050 (plp-contract-agreement)
- Other services on ports 3030, 3033, 4040, 4044

**Create New Subdomains via Dashboard:**
```
blog.openplp.org → 5051
wiki.openplp.org → 5052
api.openplp.org → 4040
admin.openplp.org → 4044
```

All routing happens automatically through Nginx Proxy Manager!

## Summary

**Deployment:** One command (`bash deploy.sh`)
**Access Dashboard:** http://192.168.155.122:6060
**Create Subdomains:** Via web UI in seconds
**Zero Conflicts:** Runs alongside all existing services
**Automatic SSL:** Let's Encrypt integration via NPM

Your DNS Manager is now production-ready on server 192.168.155.122 using port 6060! 🚀

# DNS Manager for openplp.org

A self-hosted DNS and reverse proxy management system that combines Nginx Proxy Manager with a custom Next.js dashboard. Manage multiple subdomains routing to different ports on your server through a unified web interface.

## Architecture

```
Internet
    ↓
Cloudflare DNS (openplp.org)
    ↓
192.168.155.122:80/443
    ↓
Nginx Proxy Manager (Backend Engine)
    ├─ mel.openplp.org → :5050
    ├─ blog.openplp.org → :5051
    ├─ wiki.openplp.org → :5052
    └─ www.openplp.org → :5055
    ↑
Custom Next.js Dashboard (Management UI)
```

## Features

- **Unified Management**: Create subdomains in one place - automatically configures both DNS and reverse proxy
- **Cloudflare Integration**: Automatic DNS record creation and management
- **Nginx Proxy Manager Backend**: Battle-tested reverse proxy engine
- **SSL Management**: Automatic Let's Encrypt certificate requests
- **Activity Logging**: Complete audit trail of all changes
- **Snake_case Convention**: Consistent naming across database and APIs

## Quick Start

### 1. Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ and npm installed
- Cloudflare account with openplp.org domain
- Access to server 192.168.155.122

### 2. Clone and Setup

```bash
cd /Users/chhinhsovath/Documents/GitServers/DNS_Manager

# Copy environment variables
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 3. Configure Environment Variables

Edit `.env` file:

```bash
# Database
DATABASE_URL="postgresql://dns_admin:YOUR_STRONG_PASSWORD@localhost:5432/dns_manager?schema=public"

# Cloudflare API
CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
CLOUDFLARE_ZONE_ID="your-zone-id-for-openplp-org"
CLOUDFLARE_EMAIL="your-email@example.com"

# NPM API (use defaults initially, change after first login)
NPM_API_URL="http://localhost:81/api"
NPM_EMAIL="admin@example.com"
NPM_PASSWORD="changeme"

# Server Config
HOST_SERVER_IP="192.168.155.122"
```

### 4. Get Cloudflare Credentials

**Get API Token:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit zone DNS" template
4. Select your openplp.org zone
5. Copy the token to `.env`

**Get Zone ID:**
1. Go to https://dash.cloudflare.com
2. Select openplp.org domain
3. Scroll down to "API" section on right sidebar
4. Copy "Zone ID"

### 5. Start Services

```bash
# Start Docker containers (NPM + PostgreSQL)
npm run docker:up

# Wait 30 seconds for containers to initialize
sleep 30

# Install dependencies
npm install

# Setup database
npm run db:generate
npm run db:push

# Start Next.js dashboard
npm run dev
```

### 6. Initial Setup

**Access Nginx Proxy Manager (first time only):**
1. Open http://192.168.155.122:81
2. Login with:
   - Email: `admin@example.com`
   - Password: `changeme`
3. Change password when prompted
4. Update `.env` with new password

**Add Domain to Database:**
```bash
# Using Prisma Studio
npm run db:studio

# Or via PostgreSQL directly
docker exec -it dns_manager_db psql -U dns_admin -d dns_manager

INSERT INTO domains (domain_name, cloudflare_zone_id)
VALUES ('openplp.org', 'YOUR_ZONE_ID');
```

### 7. Access Dashboard

Open http://localhost:6060

You should see the DNS Manager dashboard. Click "Add Subdomain" to create your first subdomain mapping.

## Usage

### Creating a Subdomain

1. Click "Add Subdomain" button
2. Fill in the form:
   - **Domain**: Select openplp.org
   - **Subdomain Name**: e.g., `mel`, `blog`, `api`
   - **Target Port**: The port your service runs on (e.g., 5050)
   - **Protocol**: HTTP or HTTPS
   - **Enable SSL**: Check to auto-request Let's Encrypt certificate
   - **Description**: Optional notes

3. Click "Create Subdomain"

**What happens:**
- DNS A record created in Cloudflare pointing to 192.168.155.122
- Nginx reverse proxy configured to route subdomain to port
- Database record created for management
- Activity logged

### Deleting a Subdomain

1. Click trash icon next to subdomain
2. Confirm deletion

**What happens:**
- Nginx proxy host removed
- Cloudflare DNS record deleted
- Database record deleted
- Activity logged

## Commands Reference

```bash
# Development
npm run dev              # Start Next.js dev server (port 6060)
npm run build            # Build for production
npm start               # Start production server

# Database
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema changes to database
npm run db:migrate      # Create migration
npm run db:studio       # Open Prisma Studio GUI

# Docker
npm run docker:up       # Start NPM + PostgreSQL containers
npm run docker:down     # Stop containers
npm run docker:logs     # View container logs

# Complete Setup
npm run setup           # Install + generate + push (one command)
```

## Project Structure

```
DNS_Manager/
├── docker-compose.yml           # NPM + PostgreSQL containers
├── prisma/
│   └── schema.prisma           # Database schema (snake_case)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── domains/        # Domain management API
│   │   │   └── subdomains/     # Subdomain management API
│   │   ├── layout.tsx          # Mantine provider
│   │   └── page.tsx            # Main dashboard UI
│   └── lib/
│       ├── cloudflare.ts       # Cloudflare API service
│       ├── npm.ts              # NPM API service
│       └── prisma.ts           # Prisma client
├── .env                        # Environment variables (create from .env.example)
└── package.json
```

## Database Schema

All fields use **snake_case** convention:

```sql
domains (
  domain_id             SERIAL PRIMARY KEY,
  domain_name           VARCHAR NOT NULL,
  cloudflare_zone_id    VARCHAR NOT NULL,
  created_at            TIMESTAMP DEFAULT NOW()
)

subdomains (
  subdomain_id          SERIAL PRIMARY KEY,
  domain_id             INT REFERENCES domains,
  subdomain_name        VARCHAR NOT NULL,
  full_domain           VARCHAR UNIQUE NOT NULL,
  target_host           VARCHAR DEFAULT '192.168.155.122',
  target_port           INT NOT NULL,
  cloudflare_record_id  VARCHAR,
  npm_proxy_host_id     INT,
  npm_ssl_enabled       BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMP DEFAULT NOW()
)

activity_logs (
  log_id                SERIAL PRIMARY KEY,
  action_type           VARCHAR NOT NULL,
  resource_type         VARCHAR NOT NULL,
  status                VARCHAR NOT NULL,
  created_at            TIMESTAMP DEFAULT NOW()
)
```

## API Endpoints

### Domains

- `GET /api/domains` - List all domains
- `POST /api/domains` - Create domain

### Subdomains

- `GET /api/subdomains` - List all subdomains
- `POST /api/subdomains` - Create subdomain (creates DNS + proxy)
- `PUT /api/subdomains/[id]` - Update subdomain
- `DELETE /api/subdomains/[id]` - Delete subdomain (removes DNS + proxy)

### Example: Create Subdomain via API

```bash
curl -X POST http://localhost:6060/api/subdomains \
  -H "Content-Type: application/json" \
  -d '{
    "subdomain_name": "api",
    "target_port": 3001,
    "domain_id": 1,
    "target_scheme": "http",
    "enable_ssl": true,
    "description": "API Server"
  }'
```

## Troubleshooting

### NPM API Connection Failed

**Problem**: Dashboard shows errors connecting to NPM API

**Solution**:
1. Verify NPM is running: `docker ps | grep dns_manager_npm`
2. Check NPM credentials in `.env` match your actual NPM login
3. Try accessing http://localhost:81 directly
4. View logs: `npm run docker:logs`

### Cloudflare DNS Not Created

**Problem**: Subdomain created but DNS record missing in Cloudflare

**Solution**:
1. Verify `CLOUDFLARE_API_TOKEN` has "Edit zone DNS" permission
2. Verify `CLOUDFLARE_ZONE_ID` is correct for openplp.org
3. Check activity_logs table for error details:
   ```sql
   SELECT * FROM activity_logs WHERE status = 'FAILED' ORDER BY created_at DESC;
   ```

### Port Already in Use

**Problem**: Docker containers fail to start (port conflict)

**Solution**:
1. Check what's using the ports:
   ```bash
   lsof -i :80
   lsof -i :443
   lsof -i :81
   lsof -i :5432
   ```
2. Stop conflicting services or change ports in `docker-compose.yml`

### Database Connection Error

**Problem**: `DATABASE_URL` connection failed

**Solution**:
1. Verify PostgreSQL container is running: `docker ps`
2. Check password in `.env` matches `docker-compose.yml`
3. Try connecting manually:
   ```bash
   docker exec -it dns_manager_db psql -U dns_admin -d dns_manager
   ```

## Production Deployment

### Option 1: Deploy on 192.168.155.122

```bash
# SSH to server
ssh ubuntu@192.168.155.122

# Clone repository
cd /opt
git clone <your-repo-url> dns-manager
cd dns-manager

# Setup environment
cp .env.example .env
nano .env  # Configure production values

# Start services
npm run docker:up
npm install
npm run setup

# Build and start
npm run build
npm start  # Or use PM2 for process management
```

### Option 2: Use PM2 for Process Management

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "dns-manager" -- start
pm2 save
pm2 startup  # Configure auto-start
```

### Security Considerations

1. **Change default passwords**: NPM admin password, database password
2. **Firewall rules**: Only expose ports 80, 443 publicly
3. **SSL certificates**: Enable for all public-facing subdomains
4. **API authentication**: Add authentication to Next.js dashboard (currently open)
5. **Backup database**: Regular backups of PostgreSQL

## Adding More Domains

To manage multiple domains (not just openplp.org):

```sql
INSERT INTO domains (domain_name, cloudflare_zone_id)
VALUES ('anotherdomain.com', 'another_zone_id');
```

Then select the new domain when creating subdomains in the dashboard.

## License

MIT

## Support

For issues and questions, refer to:
- Nginx Proxy Manager docs: https://nginxproxymanager.com/guide/
- Cloudflare API docs: https://developers.cloudflare.com/api/
- Next.js docs: https://nextjs.org/docs

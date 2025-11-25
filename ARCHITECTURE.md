# DNS Manager - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE DNS                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  openplp.org              → 192.168.155.122              │  │
│  │  www.openplp.org          → 192.168.155.122              │  │
│  │  mel.openplp.org          → 192.168.155.122              │  │
│  │  blog.openplp.org         → 192.168.155.122              │  │
│  │  wiki.openplp.org         → 192.168.155.122              │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              SERVER: 192.168.155.122                             │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         NGINX PROXY MANAGER (Ports 80, 443)                │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  Reverse Proxy Rules:                                │  │ │
│  │  │  - mel.openplp.org    → localhost:5050               │  │ │
│  │  │  - blog.openplp.org   → localhost:5051               │  │ │
│  │  │  - wiki.openplp.org   → localhost:5052               │  │ │
│  │  │  - www.openplp.org    → localhost:5055               │  │ │
│  │  │  + SSL Certificate Management (Let's Encrypt)        │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                                                              │ │
│  │  Admin UI: http://192.168.155.122:81                        │ │
│  └──────────────────────────┬───────────────────────────────────┘ │
│                             │                                     │
│                             │ Managed via API                     │
│                             │                                     │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │     CUSTOM NEXT.JS DASHBOARD (Port 6060)                  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  Web UI:                                           │  │   │
│  │  │  - Subdomain Management Interface                  │  │   │
│  │  │  - Create/Update/Delete Subdomains                 │  │   │
│  │  │  - SSL Management                                  │  │   │
│  │  │  - Activity Logs                                   │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                            │   │
│  │  API Routes:                                               │   │
│  │  - POST /api/subdomains   (create subdomain)              │   │
│  │  - GET  /api/subdomains   (list all)                      │   │
│  │  - PUT  /api/subdomains/:id (update)                      │   │
│  │  - DELETE /api/subdomains/:id (delete)                    │   │
│  └──────────────┬────────────────────────┬────────────────────┘   │
│                 │                        │                        │
│                 │                        │                        │
│         ┌───────▼─────────┐      ┌──────▼──────────┐            │
│         │  Cloudflare API │      │   NPM API       │            │
│         │  Integration    │      │   Integration   │            │
│         └───────┬─────────┘      └──────┬──────────┘            │
│                 │                        │                        │
│                 └────────┬───────────────┘                        │
│                          │                                        │
│                 ┌────────▼──────────┐                            │
│                 │   PostgreSQL DB   │                            │
│                 │   (Port 5432)     │                            │
│                 │                   │                            │
│                 │  Tables:          │                            │
│                 │  - domains        │                            │
│                 │  - subdomains     │                            │
│                 │  - activity_logs  │                            │
│                 └───────────────────┘                            │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 YOUR SERVICES                               │ │
│  │  - Port 5050: mel application                              │ │
│  │  - Port 5051: blog application                             │ │
│  │  - Port 5052: wiki application                             │ │
│  │  - Port 5055: main website                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### 1. Cloudflare DNS
**Purpose**: Authoritative DNS server for openplp.org

**Managed by**: Custom Dashboard via API

**Responsibilities**:
- Resolve subdomain names to IP (192.168.155.122)
- DNSSEC
- DDoS protection
- Analytics

**API Actions**:
- Create A records
- Update records
- Delete records

---

### 2. Nginx Proxy Manager (NPM)
**Purpose**: Reverse proxy and SSL termination

**Managed by**: Custom Dashboard via API

**Responsibilities**:
- Route incoming HTTP/HTTPS requests to correct ports
- SSL certificate management (Let's Encrypt)
- Force HTTPS redirects
- Block exploits
- WebSocket support
- HTTP/2 support

**Ports**:
- 80: HTTP
- 443: HTTPS
- 81: Admin UI (fallback management)

**API Actions**:
- Create proxy hosts
- Update proxy hosts
- Delete proxy hosts
- Request SSL certificates

---

### 3. Custom Next.js Dashboard
**Purpose**: Unified management interface

**Technology**: Next.js 14, TypeScript, Mantine UI, Prisma ORM

**Responsibilities**:
- Single interface to create/manage subdomains
- Orchestrates Cloudflare + NPM operations
- Stores configuration in PostgreSQL
- Activity logging and auditing
- User-friendly web interface

**Ports**:
- 6060: Web dashboard

**Key Features**:
- One-click subdomain creation (creates DNS + proxy)
- SSL management
- Activity logs
- Real-time status

---

### 4. PostgreSQL Database
**Purpose**: Configuration storage and activity logging

**Technology**: PostgreSQL 15

**Responsibilities**:
- Store domain configurations
- Store subdomain → port mappings
- Track Cloudflare record IDs
- Track NPM proxy host IDs
- Activity logging for audit trail

**Naming Convention**: snake_case (all fields)

**Tables**:
- `domains`: Domain configurations
- `subdomains`: Subdomain → port mappings
- `activity_logs`: Audit trail

---

## Data Flow: Creating a Subdomain

```
┌──────────────┐
│     User     │
└──────┬───────┘
       │
       │ 1. Fill form: "blog" → Port 5051
       │
       ▼
┌─────────────────────────┐
│  Next.js Dashboard      │
│  POST /api/subdomains   │
└──────┬──────────────────┘
       │
       │ 2. Validate input
       │
       ▼
┌─────────────────────────┐
│  Cloudflare Service     │
│  createDNSRecord()      │
└──────┬──────────────────┘
       │
       │ 3. Create: blog.openplp.org → 192.168.155.122
       │
       ▼
┌─────────────────────────┐
│  Cloudflare API         │
│  Result: record_id      │
└──────┬──────────────────┘
       │
       │ 4. DNS created ✓
       │
       ▼
┌─────────────────────────┐
│  NPM Service            │
│  createProxyHost()      │
└──────┬──────────────────┘
       │
       │ 5. Create proxy: blog.openplp.org → localhost:5051
       │
       ▼
┌─────────────────────────┐
│  NPM API                │
│  Result: proxy_host_id  │
└──────┬──────────────────┘
       │
       │ 6. Proxy created ✓
       │
       ▼
┌─────────────────────────┐
│  PostgreSQL             │
│  INSERT INTO subdomains │
└──────┬──────────────────┘
       │
       │ 7. Save: subdomain_id, cloudflare_record_id, npm_proxy_host_id
       │
       ▼
┌─────────────────────────┐
│  Activity Log           │
│  INSERT INTO logs       │
└──────┬──────────────────┘
       │
       │ 8. Log success
       │
       ▼
┌─────────────────────────┐
│  User                   │
│  Success notification   │
└─────────────────────────┘
```

**Result**: blog.openplp.org is now accessible and routes to port 5051

---

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL 15
- **ORM**: Prisma 5
- **HTTP Client**: Axios

### Frontend
- **Framework**: Next.js 14 (React 18)
- **UI Library**: Mantine 7
- **Icons**: Tabler Icons
- **Styling**: Tailwind CSS
- **Notifications**: Mantine Notifications

### Infrastructure
- **Reverse Proxy**: Nginx Proxy Manager
- **Containerization**: Docker + Docker Compose
- **DNS**: Cloudflare

### External APIs
- **Cloudflare API**: v4 REST API
- **NPM API**: REST API (built-in)

---

## Security Architecture

### Authentication Layers

1. **NPM Admin UI** (Port 81)
   - Email + Password authentication
   - Should be restricted to localhost/internal network

2. **Next.js Dashboard** (Port 6060)
   - Currently open (no auth)
   - **TODO**: Add NextAuth.js authentication

3. **PostgreSQL** (Port 5432)
   - Username + Password authentication
   - Should be restricted to localhost only

### API Security

1. **Cloudflare API**
   - Bearer token authentication
   - Token stored in environment variables
   - Scoped to specific zone only

2. **NPM API**
   - JWT token authentication
   - Automatically handles token refresh
   - Credentials stored in environment variables

### Network Security

**Exposed Ports** (public):
- 80: HTTP (redirects to HTTPS)
- 443: HTTPS (with SSL certificates)

**Internal Ports** (localhost only):
- 81: NPM Admin UI
- 6060: Dashboard
- 5432: PostgreSQL
- 3030, 3033, 4040, 4044, 5050: Your application services

**Firewall Rules** (recommended):
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 81/tcp
sudo ufw deny 6060/tcp
sudo ufw deny 5432/tcp
```

---

## Failure Handling

### Scenario 1: Cloudflare API Fails

**Problem**: DNS record creation fails

**Handling**:
1. Stop execution immediately
2. Log error to activity_logs
3. Return error to user
4. No NPM proxy created (nothing to rollback)

---

### Scenario 2: NPM API Fails (after DNS created)

**Problem**: Proxy host creation fails, but DNS already exists

**Handling**:
1. Automatically delete Cloudflare DNS record (rollback)
2. Log error to activity_logs
3. Return error to user
4. System remains consistent

---

### Scenario 3: Database Insert Fails (after DNS + NPM created)

**Problem**: Both DNS and proxy created, but DB insert fails

**Current Behavior**: DNS and proxy exist but not tracked in DB

**Recommended Fix**: Add transaction wrapper or cleanup job

---

### Scenario 4: Partial Deletion

**Problem**: User deletes subdomain, NPM succeeds but Cloudflare fails

**Handling**:
1. Continue with deletion (delete from DB)
2. Log warnings in activity_logs
3. Return success with warnings to user
4. Manual cleanup may be needed

---

## Monitoring and Observability

### Activity Logs

All operations logged to `activity_logs` table:

```sql
SELECT
  action_type,      -- CREATE, UPDATE, DELETE
  resource_type,    -- SUBDOMAIN, DNS_RECORD, PROXY_HOST
  resource_id,
  status,          -- SUCCESS, FAILED, PARTIAL
  error_message,
  created_at
FROM activity_logs
ORDER BY created_at DESC;
```

### Docker Logs

```bash
# NPM logs
docker logs -f dns_manager_npm

# PostgreSQL logs
docker logs -f dns_manager_db
```

### Application Logs

Next.js logs are output to console during development.

For production, use PM2 or systemd to capture logs.

---

## Scalability Considerations

### Current Limitations

1. **Single Server**: All components on one server (192.168.155.122)
2. **No Load Balancing**: NPM handles all traffic
3. **No High Availability**: Single point of failure
4. **No Clustering**: Single PostgreSQL instance

### Future Improvements

1. **Multi-Server Setup**:
   - NPM on load balancer nodes
   - Application servers scaled horizontally
   - Separate database server

2. **Database Replication**:
   - PostgreSQL primary/replica setup
   - Automated failover

3. **Caching Layer**:
   - Redis for session storage
   - Caching for dashboard queries

4. **API Rate Limiting**:
   - Protect against abuse
   - Cloudflare rate limiting

---

## Development vs Production

### Development (Current Setup)

- All services on localhost
- NPM admin accessible at :81
- Dashboard at :6060
- No authentication on dashboard
- Development database credentials

### Production (Recommended)

- Deploy to 192.168.155.122
- Restrict NPM admin to internal network
- Add authentication to dashboard
- Use strong database credentials
- Enable firewall rules
- Set up automated backups
- Configure monitoring/alerts
- Use PM2 or systemd for process management

---

## File Structure

```
DNS_Manager/
├── docker-compose.yml          # NPM + PostgreSQL services
├── package.json                # Node.js dependencies
├── .env                        # Environment configuration
├── quick-start.sh              # Automated setup script
│
├── prisma/
│   └── schema.prisma          # Database schema (snake_case)
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── domains/       # Domain CRUD
│   │   │   │   └── route.ts
│   │   │   └── subdomains/    # Subdomain CRUD
│   │   │       ├── route.ts
│   │   │       └── [id]/route.ts
│   │   ├── layout.tsx         # Root layout (Mantine)
│   │   └── page.tsx           # Dashboard UI
│   │
│   └── lib/
│       ├── cloudflare.ts      # Cloudflare API client
│       ├── npm.ts             # NPM API client
│       └── prisma.ts          # Prisma client singleton
│
├── docs/
│   ├── ARCHITECTURE.md        # This file
│   ├── SETUP.md              # Step-by-step setup
│   └── README.md             # Complete documentation
│
└── CLAUDE.md                 # AI development guidelines
```

---

## Integration Points

### Cloudflare ↔ Dashboard

**Direction**: Dashboard → Cloudflare

**Method**: REST API (HTTPS)

**Authentication**: Bearer token

**Operations**:
- Create A records
- Update records
- Delete records
- List records

---

### NPM ↔ Dashboard

**Direction**: Dashboard → NPM

**Method**: REST API (HTTP)

**Authentication**: JWT token (auto-managed)

**Operations**:
- Create proxy hosts
- Update proxy hosts
- Delete proxy hosts
- Request SSL certificates

---

### Dashboard ↔ PostgreSQL

**Direction**: Bidirectional

**Method**: Prisma ORM

**Authentication**: Username/password

**Operations**:
- CRUD on all tables
- Transactions
- Joins and relations

---

## Summary

This DNS Manager system provides a complete solution for managing multiple subdomains with automatic DNS and reverse proxy configuration. The architecture separates concerns:

- **Cloudflare**: DNS management
- **NPM**: Reverse proxy and SSL
- **Next.js**: Unified management interface
- **PostgreSQL**: Configuration storage

All components work together to provide a seamless experience: create a subdomain in the dashboard, and within seconds it's accessible with HTTPS.

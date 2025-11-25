# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DNS Manager is a self-hosted DNS management tool for managing multiple subdomains under openplp.org domain via Cloudflare API. The primary goal is to provide flexible management of DNS records that route to different ports on the host server (192.168.155.122).

## Project Context

**Domain Setup:**
- Main domain: openplp.org (registered via Cloudflare)
- Host server: 192.168.155.122
- Multiple subdomains routing to different ports:
  - openplp.org → 192.168.155.122:5055
  - www.openplp.org → 192.168.155.122:5055
  - mel.openplp.org → 192.168.155.122:5050
  - blog.openplp.org → 192.168.155.122:5051
  - wiki.openplp.org → 192.168.155.122:5052

**Architecture Considerations:**
- This is a self-hosted solution (NOT serverless/Vercel)
- Will integrate with Cloudflare API for DNS management
- Needs to handle dynamic subdomain creation and routing configuration
- Consider implementing reverse proxy (Nginx/Traefik) alongside DNS management

## Technology Stack Decisions

When implementing this project, use the following guidelines:

### Backend Requirements
- **Language**: Node.js/TypeScript or Python recommended for Cloudflare API integration
- **Database**: PostgreSQL with snake_case naming convention (consistent with user's other projects)
- **API Framework**: Express.js (Node) or FastAPI (Python)

### Frontend Requirements (if building admin UI)
- **Framework**: Next.js (consistent with user's sa-training-for-plp project)
- **UI Library**: Mantine or similar (user's preference from other projects)
- **Styling**: Tailwind CSS

### Infrastructure Components
1. **DNS Management Service**: Cloudflare API integration
2. **Reverse Proxy**: Nginx or Traefik for routing subdomains to ports
3. **Configuration Storage**: Database for subdomain → port mappings
4. **API Layer**: CRUD operations for DNS records and routing rules

## Database Schema Guidelines

Follow strict snake_case convention for ALL database fields:

```sql
-- Example tables structure
domains (
  domain_id SERIAL PRIMARY KEY,
  domain_name VARCHAR NOT NULL,
  cloudflare_zone_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
)

subdomains (
  subdomain_id SERIAL PRIMARY KEY,
  domain_id INT REFERENCES domains(domain_id),
  subdomain_name VARCHAR NOT NULL,
  target_port INT NOT NULL,
  target_host VARCHAR DEFAULT '192.168.155.122',
  cloudflare_record_id VARCHAR,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
)
```

## Cloudflare API Integration

**Key Endpoints:**
- Zone management: `https://api.cloudflare.com/client/v4/zones`
- DNS records: `https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records`

**Required Credentials:**
- API Token or Global API Key
- Zone ID for openplp.org
- Email (if using Global API Key)

**Security:**
- Store API credentials in environment variables
- Never commit credentials to repository
- Use `.env` file (add to .gitignore)

## Reverse Proxy Configuration

The DNS records alone won't route traffic to different ports. You'll need:

**Option 1: Nginx Configuration**
```nginx
server {
    server_name mel.openplp.org;
    location / {
        proxy_pass http://192.168.155.122:5050;
    }
}

server {
    server_name blog.openplp.org;
    location / {
        proxy_pass http://192.168.155.122:5051;
    }
}
```

**Option 2: Traefik (Dynamic)**
- Allows dynamic configuration via labels/API
- Better suited for container-based deployments
- Can auto-generate configs from database

## Development Workflow

Once the stack is implemented, typical commands will be:

**Development:**
```bash
npm install           # Install dependencies
npm run dev          # Start development server
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed initial data
```

**Testing:**
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:integration   # Integration tests
```

**Production:**
```bash
npm run build        # Build for production
npm start           # Start production server
```

## Critical Reminders

1. **Naming Convention**: ALL database fields use snake_case (subdomain_name, target_port, created_at)
2. **Host Server**: 192.168.155.122 is the production host (no localhost assumptions)
3. **API Integration**: Read Cloudflare API documentation before implementing
4. **Security**: DNS changes can break production - implement confirmation flows
5. **Validation**: Validate subdomain names (RFC 1123 compliance)
6. **Conflict Detection**: Check for existing DNS records before creating new ones

## Architecture Decisions to Make

Before coding, clarify with user:

1. **Tech Stack**: Node.js or Python? Next.js UI or API-only?
2. **Reverse Proxy**: Nginx or Traefik? Manual config or dynamic?
3. **Deployment**: Docker or bare metal? Single server or distributed?
4. **Features**: Web UI, CLI, or both? Batch operations? DNS record types (A, CNAME, TXT)?
5. **SSL/TLS**: Let's Encrypt integration? Cloudflare proxying?

## Suggested Tools to Evaluate

**Open Source DNS/Proxy Management:**
- **Traefik**: Dynamic reverse proxy with API
- **Nginx Proxy Manager**: Web UI for Nginx configuration
- **CoreDNS**: Programmable DNS server
- **PowerDNS**: Authoritative DNS with API
- **Caddy**: Automatic HTTPS reverse proxy

**Cloudflare Management:**
- **Cloudflare API**: Direct integration
- **Terraform Cloudflare Provider**: Infrastructure as code
- **FLARECTL**: Official Cloudflare CLI

## Next Steps for Initial Setup

1. Choose technology stack (ask user preferences)
2. Set up repository structure (src/, config/, docs/)
3. Initialize package.json or requirements.txt
4. Set up database schema and migrations
5. Implement Cloudflare API authentication test
6. Create basic CRUD for subdomain management
7. Configure reverse proxy (Nginx/Traefik)
8. Build UI for subdomain management (if needed)
9. Add validation and error handling
10. Document deployment process

## Related Projects

This project should follow conventions from user's other projects:
- `sa-training-for-plp`: Next.js, PostgreSQL, snake_case, production-first deployment
- Use similar deployment patterns (self-hosted, specific ports)
- Maintain consistency in error handling and API design

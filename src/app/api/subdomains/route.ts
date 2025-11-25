import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCloudflareService } from '@/lib/cloudflare';
import { getNPMService } from '@/lib/npm';

/**
 * GET /api/subdomains - List all subdomains
 */
export async function GET() {
  try {
    const subdomains = await prisma.subdomains.findMany({
      include: {
        domain: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: subdomains,
    });
  } catch (error: any) {
    console.error('Error fetching subdomains:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subdomains - Create new subdomain
 * This creates:
 * 1. Database record
 * 2. Cloudflare DNS record
 * 3. NPM proxy host
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      subdomain_name,
      target_port,
      domain_id,
      target_scheme = 'http',
      enable_ssl = false,
      description,
    } = body;

    // Validate input
    if (!subdomain_name || !target_port || !domain_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: subdomain_name, target_port, domain_id',
        },
        { status: 400 }
      );
    }

    // Get domain info
    const domain = await prisma.domains.findUnique({
      where: { domain_id },
    });

    if (!domain) {
      return NextResponse.json(
        {
          success: false,
          error: 'Domain not found',
        },
        { status: 404 }
      );
    }

    const full_domain = subdomain_name === '@'
      ? domain.domain_name
      : `${subdomain_name}.${domain.domain_name}`;

    // Check if subdomain already exists
    const existing = await prisma.subdomains.findUnique({
      where: { full_domain },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: `Subdomain ${full_domain} already exists`,
        },
        { status: 409 }
      );
    }

    const target_host = process.env.HOST_SERVER_IP || '192.168.155.122';

    // Step 1: Create DNS record in Cloudflare
    const cloudflare = getCloudflareService();
    const dnsResult = await cloudflare.createDNSRecord({
      type: 'A',
      name: full_domain,
      content: target_host,
      ttl: 1,
      proxied: false,
    });

    if (!dnsResult.success) {
      await prisma.activity_logs.create({
        data: {
          action_type: 'CREATE',
          resource_type: 'DNS_RECORD',
          resource_id: full_domain,
          status: 'FAILED',
          error_message: dnsResult.error,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: `Failed to create DNS record: ${dnsResult.error}`,
        },
        { status: 500 }
      );
    }

    // Step 2: Create proxy host in NPM
    const npm = getNPMService();
    const proxyResult = await npm.createProxyHost({
      domain_names: [full_domain],
      forward_scheme: target_scheme,
      forward_host: target_host,
      forward_port: target_port,
      block_exploits: true,
      allow_websocket_upgrade: true,
      http2_support: true,
      ssl_forced: false,
    });

    if (!proxyResult.success) {
      // Rollback: Delete DNS record
      if (dnsResult.recordId) {
        await cloudflare.deleteDNSRecord(dnsResult.recordId);
      }

      await prisma.activity_logs.create({
        data: {
          action_type: 'CREATE',
          resource_type: 'PROXY_HOST',
          resource_id: full_domain,
          status: 'FAILED',
          error_message: proxyResult.error,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: `Failed to create proxy host: ${proxyResult.error}`,
        },
        { status: 500 }
      );
    }

    // Step 3: Create database record
    const subdomain = await prisma.subdomains.create({
      data: {
        domain_id,
        subdomain_name,
        full_domain,
        target_host,
        target_port,
        target_scheme,
        cloudflare_record_id: dnsResult.recordId,
        npm_proxy_host_id: proxyResult.proxyHostId,
        npm_ssl_enabled: enable_ssl,
        description,
      },
      include: {
        domain: true,
      },
    });

    // Log success
    await prisma.activity_logs.create({
      data: {
        action_type: 'CREATE',
        resource_type: 'SUBDOMAIN',
        resource_id: subdomain.subdomain_id.toString(),
        status: 'SUCCESS',
        details: JSON.stringify({
          full_domain,
          target_port,
          cloudflare_record_id: dnsResult.recordId,
          npm_proxy_host_id: proxyResult.proxyHostId,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: subdomain,
      message: `Subdomain ${full_domain} created successfully`,
    });
  } catch (error: any) {
    console.error('Error creating subdomain:', error);

    await prisma.activity_logs.create({
      data: {
        action_type: 'CREATE',
        resource_type: 'SUBDOMAIN',
        resource_id: 'unknown',
        status: 'FAILED',
        error_message: error.message,
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack,
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/domains - List all domains
 */
export async function GET() {
  try {
    const domains = await prisma.domains.findMany({
      include: {
        subdomains: {
          orderBy: {
            created_at: 'desc',
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: domains,
    });
  } catch (error: any) {
    console.error('Error fetching domains:', error);
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
 * POST /api/domains - Create new domain
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain_name, cloudflare_zone_id } = body;

    if (!domain_name || !cloudflare_zone_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: domain_name, cloudflare_zone_id',
        },
        { status: 400 }
      );
    }

    const domain = await prisma.domains.create({
      data: {
        domain_name,
        cloudflare_zone_id,
      },
    });

    return NextResponse.json({
      success: true,
      data: domain,
    });
  } catch (error: any) {
    console.error('Error creating domain:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

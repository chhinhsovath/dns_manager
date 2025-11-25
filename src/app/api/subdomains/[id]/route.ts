import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCloudflareService } from '@/lib/cloudflare';
import { getNPMService } from '@/lib/npm';

/**
 * DELETE /api/subdomains/[id] - Delete subdomain
 * This removes:
 * 1. NPM proxy host
 * 2. Cloudflare DNS record
 * 3. Database record
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const subdomain_id = parseInt(params.id);

    // Get subdomain info
    const subdomain = await prisma.subdomains.findUnique({
      where: { subdomain_id },
    });

    if (!subdomain) {
      return NextResponse.json(
        {
          success: false,
          error: 'Subdomain not found',
        },
        { status: 404 }
      );
    }

    const errors: string[] = [];

    // Step 1: Delete NPM proxy host
    if (subdomain.npm_proxy_host_id) {
      const npm = getNPMService();
      const npmResult = await npm.deleteProxyHost(subdomain.npm_proxy_host_id);
      if (!npmResult.success) {
        errors.push(`NPM: ${npmResult.error}`);
      }
    }

    // Step 2: Delete Cloudflare DNS record
    if (subdomain.cloudflare_record_id) {
      const cloudflare = getCloudflareService();
      const dnsResult = await cloudflare.deleteDNSRecord(subdomain.cloudflare_record_id);
      if (!dnsResult.success) {
        errors.push(`Cloudflare: ${dnsResult.error}`);
      }
    }

    // Step 3: Delete database record (always do this even if above steps failed)
    await prisma.subdomains.delete({
      where: { subdomain_id },
    });

    // Log activity
    await prisma.activity_logs.create({
      data: {
        action_type: 'DELETE',
        resource_type: 'SUBDOMAIN',
        resource_id: subdomain_id.toString(),
        status: errors.length === 0 ? 'SUCCESS' : 'PARTIAL',
        error_message: errors.length > 0 ? errors.join('; ') : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Subdomain ${subdomain.full_domain} deleted`,
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error deleting subdomain:', error);

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
 * PUT /api/subdomains/[id] - Update subdomain
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const subdomain_id = parseInt(params.id);
    const body = await request.json();

    // Get existing subdomain
    const existing = await prisma.subdomains.findUnique({
      where: { subdomain_id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Subdomain not found',
        },
        { status: 404 }
      );
    }

    const { target_port, target_scheme, is_active, description } = body;

    // Update NPM proxy host if port or scheme changed
    if (
      existing.npm_proxy_host_id &&
      (target_port !== existing.target_port || target_scheme !== existing.target_scheme)
    ) {
      const npm = getNPMService();
      await npm.updateProxyHost(existing.npm_proxy_host_id, {
        forward_port: target_port || existing.target_port,
        forward_scheme: target_scheme || existing.target_scheme,
      });
    }

    // Update database record
    const updated = await prisma.subdomains.update({
      where: { subdomain_id },
      data: {
        target_port: target_port || existing.target_port,
        target_scheme: target_scheme || existing.target_scheme,
        is_active: is_active !== undefined ? is_active : existing.is_active,
        description: description !== undefined ? description : existing.description,
      },
      include: {
        domain: true,
      },
    });

    // Log activity
    await prisma.activity_logs.create({
      data: {
        action_type: 'UPDATE',
        resource_type: 'SUBDOMAIN',
        resource_id: subdomain_id.toString(),
        status: 'SUCCESS',
        details: JSON.stringify({
          changes: body,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating subdomain:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

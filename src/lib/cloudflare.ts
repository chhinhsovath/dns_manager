/**
 * Cloudflare API Integration Service
 * Handles DNS record management via Cloudflare API
 */

import axios, { AxiosInstance } from 'axios';

interface CloudflareConfig {
  apiToken: string;
  zoneId: string;
  email?: string;
}

interface DNSRecord {
  id?: string;
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
}

interface CloudflareResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: any;
}

export class CloudflareService {
  private client: AxiosInstance;
  private zoneId: string;

  constructor(config: CloudflareConfig) {
    this.zoneId = config.zoneId;

    this.client = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create a new DNS record
   */
  async createDNSRecord(record: DNSRecord): Promise<{ success: boolean; recordId?: string; error?: string }> {
    try {
      const response = await this.client.post<CloudflareResponse>(
        `/zones/${this.zoneId}/dns_records`,
        {
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl || 1, // 1 = automatic
          proxied: record.proxied || false,
        }
      );

      if (response.data.success) {
        return {
          success: true,
          recordId: response.data.result.id,
        };
      } else {
        return {
          success: false,
          error: response.data.errors.map(e => e.message).join(', '),
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.message || error.message,
      };
    }
  }

  /**
   * Update an existing DNS record
   */
  async updateDNSRecord(recordId: string, record: Partial<DNSRecord>): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.client.put<CloudflareResponse>(
        `/zones/${this.zoneId}/dns_records/${recordId}`,
        record
      );

      if (response.data.success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: response.data.errors.map(e => e.message).join(', '),
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.message || error.message,
      };
    }
  }

  /**
   * Delete a DNS record
   */
  async deleteDNSRecord(recordId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.client.delete<CloudflareResponse>(
        `/zones/${this.zoneId}/dns_records/${recordId}`
      );

      if (response.data.success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: response.data.errors.map(e => e.message).join(', '),
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.message || error.message,
      };
    }
  }

  /**
   * List all DNS records
   */
  async listDNSRecords(): Promise<{ success: boolean; records?: any[]; error?: string }> {
    try {
      const response = await this.client.get<CloudflareResponse>(
        `/zones/${this.zoneId}/dns_records`
      );

      if (response.data.success) {
        return {
          success: true,
          records: response.data.result,
        };
      } else {
        return {
          success: false,
          error: response.data.errors.map(e => e.message).join(', '),
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.message || error.message,
      };
    }
  }

  /**
   * Get zone details
   */
  async getZoneDetails(): Promise<{ success: boolean; zone?: any; error?: string }> {
    try {
      const response = await this.client.get<CloudflareResponse>(
        `/zones/${this.zoneId}`
      );

      if (response.data.success) {
        return {
          success: true,
          zone: response.data.result,
        };
      } else {
        return {
          success: false,
          error: response.data.errors.map(e => e.message).join(', '),
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.message || error.message,
      };
    }
  }
}

// Singleton instance
let cloudflareService: CloudflareService | null = null;

export function getCloudflareService(): CloudflareService {
  if (!cloudflareService) {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;

    if (!apiToken || !zoneId) {
      throw new Error('Cloudflare API credentials not configured');
    }

    cloudflareService = new CloudflareService({
      apiToken,
      zoneId,
    });
  }

  return cloudflareService;
}

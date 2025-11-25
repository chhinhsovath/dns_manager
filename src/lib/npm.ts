/**
 * Nginx Proxy Manager API Integration Service
 * Handles proxy host management via NPM API
 */

import axios, { AxiosInstance } from 'axios';

interface NPMConfig {
  apiUrl: string;
  email: string;
  password: string;
}

interface ProxyHost {
  domain_names: string[];
  forward_scheme: string;
  forward_host: string;
  forward_port: number;
  access_list_id?: number;
  certificate_id?: number;
  ssl_forced?: boolean;
  caching_enabled?: boolean;
  block_exploits?: boolean;
  advanced_config?: string;
  allow_websocket_upgrade?: boolean;
  http2_support?: boolean;
  hsts_enabled?: boolean;
  hsts_subdomains?: boolean;
}

interface NPMResponse {
  id?: number;
  [key: string]: any;
}

export class NPMService {
  private client: AxiosInstance;
  private token: string | null = null;
  private config: NPMConfig;

  constructor(config: NPMConfig) {
    this.config = config;

    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Authenticate with NPM API
   */
  private async authenticate(): Promise<void> {
    try {
      const response = await this.client.post('/tokens', {
        identity: this.config.email,
        secret: this.config.password,
      });

      this.token = response.data.token;
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    } catch (error: any) {
      throw new Error(`NPM Authentication failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Ensure authenticated before making requests
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.token) {
      await this.authenticate();
    }
  }

  /**
   * Create a new proxy host
   */
  async createProxyHost(proxyHost: ProxyHost): Promise<{ success: boolean; proxyHostId?: number; error?: string }> {
    try {
      await this.ensureAuthenticated();

      const response = await this.client.post<NPMResponse>('/nginx/proxy-hosts', {
        domain_names: proxyHost.domain_names,
        forward_scheme: proxyHost.forward_scheme,
        forward_host: proxyHost.forward_host,
        forward_port: proxyHost.forward_port,
        access_list_id: proxyHost.access_list_id || 0,
        certificate_id: proxyHost.certificate_id || 0,
        ssl_forced: proxyHost.ssl_forced || false,
        caching_enabled: proxyHost.caching_enabled || false,
        block_exploits: proxyHost.block_exploits !== false,
        advanced_config: proxyHost.advanced_config || '',
        allow_websocket_upgrade: proxyHost.allow_websocket_upgrade !== false,
        http2_support: proxyHost.http2_support !== false,
        hsts_enabled: proxyHost.hsts_enabled || false,
        hsts_subdomains: proxyHost.hsts_subdomains || false,
      });

      return {
        success: true,
        proxyHostId: response.data.id,
      };
    } catch (error: any) {
      // Token might be expired, retry once
      if (error.response?.status === 401 && this.token) {
        this.token = null;
        return this.createProxyHost(proxyHost);
      }

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Update an existing proxy host
   */
  async updateProxyHost(proxyHostId: number, proxyHost: Partial<ProxyHost>): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureAuthenticated();

      await this.client.put(`/nginx/proxy-hosts/${proxyHostId}`, proxyHost);

      return { success: true };
    } catch (error: any) {
      if (error.response?.status === 401 && this.token) {
        this.token = null;
        return this.updateProxyHost(proxyHostId, proxyHost);
      }

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Delete a proxy host
   */
  async deleteProxyHost(proxyHostId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureAuthenticated();

      await this.client.delete(`/nginx/proxy-hosts/${proxyHostId}`);

      return { success: true };
    } catch (error: any) {
      if (error.response?.status === 401 && this.token) {
        this.token = null;
        return this.deleteProxyHost(proxyHostId);
      }

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * List all proxy hosts
   */
  async listProxyHosts(): Promise<{ success: boolean; hosts?: any[]; error?: string }> {
    try {
      await this.ensureAuthenticated();

      const response = await this.client.get('/nginx/proxy-hosts');

      return {
        success: true,
        hosts: response.data,
      };
    } catch (error: any) {
      if (error.response?.status === 401 && this.token) {
        this.token = null;
        return this.listProxyHosts();
      }

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Request SSL certificate for domain
   */
  async requestSSLCertificate(domains: string[]): Promise<{ success: boolean; certificateId?: number; error?: string }> {
    try {
      await this.ensureAuthenticated();

      const response = await this.client.post('/nginx/certificates', {
        provider: 'letsencrypt',
        domain_names: domains,
        meta: {
          letsencrypt_agree: true,
          letsencrypt_email: this.config.email,
        },
      });

      return {
        success: true,
        certificateId: response.data.id,
      };
    } catch (error: any) {
      if (error.response?.status === 401 && this.token) {
        this.token = null;
        return this.requestSSLCertificate(domains);
      }

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }
}

// Singleton instance
let npmService: NPMService | null = null;

export function getNPMService(): NPMService {
  if (!npmService) {
    const apiUrl = process.env.NPM_API_URL;
    const email = process.env.NPM_EMAIL;
    const password = process.env.NPM_PASSWORD;

    if (!apiUrl || !email || !password) {
      throw new Error('NPM API credentials not configured');
    }

    npmService = new NPMService({
      apiUrl,
      email,
      password,
    });
  }

  return npmService;
}

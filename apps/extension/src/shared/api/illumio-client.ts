import type { IllumioIPList, IllumioWorkload } from '../types';

export class IllumioClient {
  private pceUrl: string;
  private auth: string;
  private orgId: number;

  constructor(pceUrl: string, apiKeyId: string, apiKeySecret: string, orgId = 1) {
    this.pceUrl = pceUrl.replace(/\/$/, '');
    this.auth = btoa(`${apiKeyId}:${apiKeySecret}`);
    this.orgId = orgId;
  }

  private async request<T = any>(endpoint: string, method = 'GET', body?: any): Promise<T> {
    const url = `${this.pceUrl}/api/v2${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Illumio API error: ${response.status}`);
    }

    if (method === 'DELETE') return null as T;
    return response.json();
  }

  // ─────────────────────────────────────────────────────────────
  // CONNECTION TEST
  // ─────────────────────────────────────────────────────────────

  async testConnection(): Promise<boolean> {
    try {
      await this.request(`/orgs/${this.orgId}/sec_policy/draft/ip_lists?max_results=1`);
      return true;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // IP LISTS
  // ─────────────────────────────────────────────────────────────

  async createIPList(
    name: string,
    ipRanges: Array<{ from_ip: string; description?: string }>,
    description = ''
  ): Promise<IllumioIPList> {
    return this.request(
      `/orgs/${this.orgId}/sec_policy/draft/ip_lists`,
      'POST',
      {
        name,
        description: description || 'Created by Aperture',
        ip_ranges: ipRanges,
      }
    );
  }

  async getIPListByName(name: string): Promise<IllumioIPList | null> {
    const lists = await this.request<IllumioIPList[]>(
      `/orgs/${this.orgId}/sec_policy/draft/ip_lists?name=${encodeURIComponent(name)}`
    );
    return lists[0] || null;
  }

  async getApertureIPLists(): Promise<IllumioIPList[]> {
    const lists = await this.request<IllumioIPList[]>(
      `/orgs/${this.orgId}/sec_policy/draft/ip_lists`
    );
    return lists.filter(l => l.name.startsWith('Aperture:'));
  }

  async updateIPList(href: string, ipRanges: Array<{ from_ip: string; description?: string }>): Promise<IllumioIPList> {
    return this.request(href, 'PUT', { ip_ranges: ipRanges });
  }

  async deleteIPList(href: string): Promise<void> {
    await this.request(href, 'DELETE');
  }

  // ─────────────────────────────────────────────────────────────
  // WORKLOADS
  // ─────────────────────────────────────────────────────────────

  async getWorkloadByIP(ip: string): Promise<IllumioWorkload | null> {
    const workloads = await this.request<IllumioWorkload[]>(
      `/orgs/${this.orgId}/workloads?ip_address=${ip}`
    );
    return workloads[0] || null;
  }

  async getWorkloads(limit = 100): Promise<IllumioWorkload[]> {
    return this.request(`/orgs/${this.orgId}/workloads?max_results=${limit}`);
  }

  // ─────────────────────────────────────────────────────────────
  // DEEP LINKS
  // ─────────────────────────────────────────────────────────────

  getExplorerUrl(ipListHref: string): string {
    const id = ipListHref.split('/').pop();
    return `${this.pceUrl}/app/#/orgs/${this.orgId}/explorer?ip_list=${id}`;
  }

  getMapUrl(ipListHref: string): string {
    const id = ipListHref.split('/').pop();
    return `${this.pceUrl}/app/#/orgs/${this.orgId}/illumination?filter=ip_list:${id}`;
  }
}

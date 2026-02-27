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

  /**
   * Fetch all workloads from Illumio using the async GET collection API.
   * Synchronous GET is capped at 500 and ignores offset, so we must use
   * the async job approach: send Prefer: respond-async, poll the job,
   * then download the full result set.
   */
  async getAllWorkloads(): Promise<{ workloads: IllumioWorkload[]; total: number }> {
    const log = (msg: string) => console.log(`[Illumio getAllWorkloads] ${msg}`);
    const headers = {
      'Authorization': `Basic ${this.auth}`,
      'Accept': 'application/json',
    };

    // Step 1: Kick off async job (retry on 409 conflict)
    let jobLocation = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      log(`Requesting async export (attempt ${attempt + 1}/5)...`);
      const jobResponse = await fetch(
        `${this.pceUrl}/api/v2/orgs/${this.orgId}/workloads`,
        { headers: { ...headers, 'Prefer': 'respond-async' } }
      );

      if (jobResponse.status === 202) {
        jobLocation = jobResponse.headers.get('Location') || '';
        log(`Async job started: ${jobLocation}`);
        break;
      }

      if (jobResponse.status === 409) {
        log('409 conflict — previous job still running, waiting 5s...');
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      throw new Error(`Illumio async job failed to start: ${jobResponse.status}`);
    }

    if (!jobLocation) {
      throw new Error('Illumio async job: could not start after retries');
    }

    // Step 2: Poll until done (short interval to keep service worker alive)
    let resultHref = '';
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 1000));

      const pollResponse = await fetch(
        `${this.pceUrl}/api/v2${jobLocation}`,
        { headers }
      );
      const job = await pollResponse.json();

      if (i % 5 === 0) {
        log(`Poll ${i + 1}/120: status=${job.status}`);
      }

      if (job.status === 'done') {
        resultHref = job.result?.href;
        log(`Job done after ${i + 1} polls. Result: ${resultHref}`);
        break;
      }
      if (job.status === 'failed') {
        throw new Error('Illumio async job failed');
      }
    }

    if (!resultHref) {
      throw new Error('Illumio async job timed out');
    }

    // Step 3: Download results
    log('Downloading result data...');
    const dataResponse = await fetch(
      `${this.pceUrl}/api/v2${resultHref}`,
      { headers }
    );

    if (!dataResponse.ok) {
      throw new Error(`Illumio datafile download failed: ${dataResponse.status}`);
    }

    const workloads: IllumioWorkload[] = await dataResponse.json();
    log(`Downloaded ${workloads.length} workloads`);
    return { workloads, total: workloads.length };
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

import type { Portfolio, Service, Server, ServerContext, ServiceInfo, IPListData, ServiceCatalog, PortfolioCatalogEntry, ServiceCatalogEntry, AppComponent } from '../types';

export class ServiceNowClient {
  private instance: string;
  private auth: string;

  constructor(instance: string, username: string, password: string) {
    this.instance = instance;
    this.auth = btoa(`${username}:${password}`);
  }

  private async request<T = any>(table: string, queryString = '', limit = 100): Promise<T[]> {
    const url = `https://${this.instance}/api/now/table/${table}?sysparm_limit=${limit}${queryString ? '&' + queryString : ''}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(encodeURI(url), {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${table}`);
      }

      const data = await response.json();
      return data.result ?? [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private encodeValue(value: string): string {
    return encodeURIComponent(value);
  }

  // ─────────────────────────────────────────────────────────────
  // CONNECTION TEST
  // ─────────────────────────────────────────────────────────────

  async testConnection(): Promise<boolean> {
    try {
      await this.request('pm_portfolio', 'sysparm_query=active=true', 1);
      return true;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PORTFOLIOS
  // ─────────────────────────────────────────────────────────────

  async getPortfolios(): Promise<Portfolio[]> {
    const results = await this.request('pm_portfolio', 'sysparm_query=active=true');
    return results.map((p: any) => ({
      sysId: p.sys_id,
      name: p.name,
      state: p.state,
    }));
  }

  async getPortfolioByName(name: string): Promise<Portfolio | null> {
    const results = await this.request('pm_portfolio', 'sysparm_query=active=true', 100);
    const match = results.find((p: any) =>
      p.name.toLowerCase().includes(name.toLowerCase())
    );
    return match ? { sysId: match.sys_id, name: match.name } : null;
  }

  async getPortfolioById(sysId: string): Promise<Portfolio | null> {
    const results = await this.request('pm_portfolio', `sysparm_query=sys_id=${sysId}`, 1);
    return results[0] ? { sysId: results[0].sys_id, name: results[0].name } : null;
  }

  // ─────────────────────────────────────────────────────────────
  // SERVICES
  // ─────────────────────────────────────────────────────────────

  async getServices(query = 'operational_status=1', limit = 100): Promise<Service[]> {
    const results = await this.request('cmdb_ci_service', `sysparm_query=${query}`, limit);
    return results.map((s: any) => ({
      sysId: s.sys_id,
      name: s.name,
      fullName: s.u_business_service_fullname || undefined,
      description: s.short_description,
      criticality: s.busines_criticality,
      environment: s.used_for,
      category: s.category || undefined,
      portfolioId: s.u_product_portfolio?.value,
      infrastructure: s.u_infrastructure,
    }));
  }

  async getServicesByPortfolio(portfolioSysId: string, limit = 200): Promise<Service[]> {
    return this.getServices(`u_product_portfolio=${portfolioSysId}^operational_status=1`, limit);
  }

  async getServiceByName(name: string): Promise<Service | null> {
    const searchTerm = name.split(' ')[0];
    const results = await this.request(
      'cmdb_ci_service',
      `sysparm_query=nameLIKE${this.encodeValue(searchTerm)}`,
      50
    );
    const match = results.find((s: any) => s.name === name);
    return match ? {
      sysId: match.sys_id,
      name: match.name,
      fullName: match.u_business_service_fullname || undefined,
      description: match.short_description,
      criticality: match.busines_criticality,
      environment: match.used_for,
      category: match.category || undefined,
      portfolioId: match.u_product_portfolio?.value,
      infrastructure: match.u_infrastructure,
    } : null;
  }

  async getServiceBySysId(sysId: string): Promise<Service | null> {
    const results = await this.request('cmdb_ci_service', `sysparm_query=sys_id=${sysId}`, 1);
    return results[0] ? {
      sysId: results[0].sys_id,
      name: results[0].name,
      fullName: results[0].u_business_service_fullname || undefined,
      description: results[0].short_description,
      criticality: results[0].busines_criticality,
      environment: results[0].used_for,
      category: results[0].category || undefined,
      portfolioId: results[0].u_product_portfolio?.value,
      infrastructure: results[0].u_infrastructure,
    } : null;
  }

  // ─────────────────────────────────────────────────────────────
  // SERVERS
  // ─────────────────────────────────────────────────────────────

  private mapServer(s: any): Server {
    return {
      sysId: s.sys_id,
      name: s.name,
      ip: s.ip_address,
      hostname: s.host_name,
      fqdn: s.fqdn,
      os: s.os,
      environment: s.classification,
      classType: s.sys_class_name,
      virtual: s.virtual === 'true' || s.virtual === true,
      shortDescription: s.short_description,
    };
  }

  async getServers(query = 'operational_status=1^ip_addressISNOTEMPTY', limit = 100): Promise<Server[]> {
    const results = await this.request('cmdb_ci_server', `sysparm_query=${query}`, limit);
    return results.map((s: any) => this.mapServer(s));
  }

  async getServerByIP(ip: string): Promise<Server | null> {
    const results = await this.request('cmdb_ci_server', `sysparm_query=ip_address=${ip}`, 1);
    return results[0] ? this.mapServer(results[0]) : null;
  }

  // ─────────────────────────────────────────────────────────────
  // RELATIONSHIPS
  // ─────────────────────────────────────────────────────────────

  async getServersForService(serviceSysId: string): Promise<Server[]> {
    const rels = await this.request('cmdb_rel_ci', `sysparm_query=parent=${serviceSysId}`);
    if (rels.length === 0) return [];

    const childIds = rels.map((r: any) => r.child?.value).filter(Boolean);
    if (childIds.length === 0) return [];

    const children = await this.request('cmdb_ci', `sysparm_query=sys_idIN${childIds.join(',')}`);

    return children
      .filter((c: any) => c.sys_class_name?.includes('server'))
      .map((c: any) => ({
        sysId: c.sys_id,
        name: c.name,
        ip: c.ip_address,
        type: c.sys_class_name,
      }));
  }

  async getServicesForServer(serverSysId: string): Promise<Service[]> {
    const rels = await this.request('cmdb_rel_ci', `sysparm_query=child=${serverSysId}`);
    if (rels.length === 0) return [];

    const parentIds = rels.map((r: any) => r.parent?.value).filter(Boolean);
    if (parentIds.length === 0) return [];

    const parents = await this.request('cmdb_ci', `sysparm_query=sys_idIN${parentIds.join(',')}`);

    // Match BOTH cmdb_ci_service AND cmdb_ci_service_discovered
    return parents
      .filter((p: any) => p.sys_class_name?.includes('cmdb_ci_service'))
      .map((p: any) => ({
        sysId: p.sys_id,
        name: p.name,
        description: p.short_description,
        type: p.sys_class_name,
      }));
  }

  // ─────────────────────────────────────────────────────────────
  // COMPONENTS (App Servers, Web Servers)
  // ─────────────────────────────────────────────────────────────

  async getComponentsForServer(serverName: string): Promise<AppComponent[]> {
    // Components follow the naming convention "Type@hostname" (e.g. "Tomcat@densbp42",
    // "MSSQL@denamdb201d", "NGINX@dendtprd7p"). We search cmdb_ci for any record whose
    // name contains "@serverName". This captures all component types: app servers, web
    // servers, database instances, Docker engines, load balancer services, etc.
    // Exclude infrastructure CIs (network adapters, IP addresses) that also use @ in names.
    const INFRA_CLASSES = [
      'cmdb_ci_network_adapter', 'cmdb_ci_ip_address', 'dscy_router_interface',
      'dscy_route_interface', 'dscy_route_next_hop', 'cmdb_ci_dns_name',
    ];

    const results = await this.request('cmdb_ci',
      `sysparm_query=nameLIKE@${this.encodeValue(serverName)}`, 100);

    const filtered = results
      .filter((c: any) => !INFRA_CLASSES.includes(c.sys_class_name));

    // ServiceNow may contain duplicate CIs with different sys_ids but identical names.
    // Deduplicate by name, keeping the first occurrence.
    const seen = new Set<string>();
    return filtered
      .filter((c: any) => {
        if (seen.has(c.name)) return false;
        seen.add(c.name);
        return true;
      })
      .map((c: any) => ({
        sysId: c.sys_id,
        name: c.name,
        className: c.sys_class_name,
        shortDescription: c.short_description,
        serverName,
      }));
  }

  // ─────────────────────────────────────────────────────────────
  // COMPOSITE QUERIES
  // ─────────────────────────────────────────────────────────────

  async getServersForPortfolio(portfolioSysId: string): Promise<Server[]> {
    const services = await this.getServicesByPortfolio(portfolioSysId);
    const serverMap = new Map<string, Server>();

    // Limit to first 20 services to avoid timeout
    for (const service of services.slice(0, 20)) {
      const servers = await this.getServersForService(service.sysId);

      for (const server of servers) {
        if (serverMap.has(server.sysId)) {
          serverMap.get(server.sysId)!.services!.push(service.name);
        } else {
          serverMap.set(server.sysId, {
            ...server,
            services: [service.name],
          });
        }
      }
    }

    return Array.from(serverMap.values());
  }

  async getServerByName(name: string): Promise<Server | null> {
    // Try cmdb_ci_server first, then fall back to cmdb_ci (base table that includes all subtypes)
    let results = await this.request('cmdb_ci_server', `sysparm_query=name=${this.encodeValue(name)}`, 1);
    if (results.length === 0) {
      results = await this.request('cmdb_ci', `sysparm_query=name=${this.encodeValue(name)}^sys_class_nameLIKEserver`, 1);
    }
    return results[0] ? this.mapServer(results[0]) : null;
  }

  async getServerContext(identifier: string): Promise<ServerContext | null> {
    let server: Server | null = null;

    // Determine lookup strategy based on format
    const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(identifier);
    const isSysId = /^[0-9a-f]{32}$/.test(identifier);

    if (isIP) {
      server = await this.getServerByIP(identifier);
    } else if (isSysId) {
      const servers = await this.request('cmdb_ci_server', `sysparm_query=sys_id=${identifier}`, 1);
      server = servers[0] ? this.mapServer(servers[0]) : null;
    } else {
      // Treat as hostname — try name field first, then host_name, then FQDN
      // Each attempt checks cmdb_ci_server then falls back to cmdb_ci base table
      server = await this.getServerByName(identifier);
      if (!server) {
        let results = await this.request('cmdb_ci_server', `sysparm_query=host_name=${this.encodeValue(identifier)}`, 1);
        if (results.length === 0) {
          results = await this.request('cmdb_ci', `sysparm_query=host_name=${this.encodeValue(identifier)}^sys_class_nameLIKEserver`, 1);
        }
        server = results[0] ? this.mapServer(results[0]) : null;
      }
      if (!server) {
        let results = await this.request('cmdb_ci_server', `sysparm_query=fqdn=${this.encodeValue(identifier)}`, 1);
        if (results.length === 0) {
          results = await this.request('cmdb_ci', `sysparm_query=fqdn=${this.encodeValue(identifier)}^sys_class_nameLIKEserver`, 1);
        }
        server = results[0] ? this.mapServer(results[0]) : null;
      }
    }

    if (!server) return null;

    const services = await this.getServicesForServer(server.sysId);

    // Build enriched service details by looking up full service records
    // Track which portfolio ID each service belongs to
    const serviceDetails: ServiceInfo[] = [];
    const portfolioIds = new Set<string>();
    const svcPortfolioMap = new Map<string, string>(); // service name → portfolio sys_id
    for (const svc of services) {
      const mainService = await this.getServiceByName(svc.name);
      const detail: ServiceInfo = { name: svc.name };
      if (mainService) {
        detail.fullName = mainService.fullName;
        detail.description = mainService.description;
        detail.criticality = mainService.criticality;
        detail.environment = mainService.environment;
        detail.category = mainService.category;
        detail.infrastructure = mainService.infrastructure;
        if (mainService.portfolioId) {
          portfolioIds.add(mainService.portfolioId);
          svcPortfolioMap.set(svc.name, mainService.portfolioId);
        }
      }
      serviceDetails.push(detail);
    }

    // Resolve portfolio IDs to names
    const portfolioIdToName = new Map<string, string>();
    let portfolios: Portfolio[] = [];
    if (portfolioIds.size > 0) {
      const portfolioResults = await this.request(
        'pm_portfolio',
        `sysparm_query=sys_idIN${[...portfolioIds].join(',')}`
      );
      portfolios = portfolioResults.map((p: any) => ({ sysId: p.sys_id, name: p.name }));
      for (const p of portfolios) {
        portfolioIdToName.set(p.sysId, p.name);
      }
    }

    // Assign resolved portfolio name to each service detail
    for (const detail of serviceDetails) {
      const pfId = svcPortfolioMap.get(detail.name);
      if (pfId) {
        detail.portfolio = portfolioIdToName.get(pfId);
      }
    }

    // Fetch application components running on this server (via @hostname naming convention)
    const components = await this.getComponentsForServer(server.name);

    return {
      server: {
        sysId: server.sysId,
        name: server.name,
        ip: server.ip,
        os: server.os,
        environment: server.environment,
        fqdn: server.fqdn,
        classType: server.classType,
        virtual: server.virtual,
        shortDescription: server.shortDescription,
      },
      services: services.map(s => s.name),
      serviceDetails,
      portfolios: portfolios.map(p => p.name),
      isMultiUse: services.length > 1 || portfolios.length > 1,
      components,
    };
  }

  async getServiceCatalog(): Promise<ServiceCatalog> {
    const portfolios = await this.getPortfolios();
    const allServices = await this.getServices('operational_status=1', 1000);

    // Index services by portfolio ID
    const byPortfolio = new Map<string, Service[]>();
    const unassigned: Service[] = [];

    for (const svc of allServices) {
      if (svc.portfolioId) {
        const list = byPortfolio.get(svc.portfolioId) || [];
        list.push(svc);
        byPortfolio.set(svc.portfolioId, list);
      } else {
        unassigned.push(svc);
      }
    }

    // Count servers per service (batch: get all relationships for each service)
    const serverCounts = new Map<string, number>();
    for (const svc of allServices) {
      const rels = await this.request('cmdb_rel_ci', `sysparm_query=parent=${svc.sysId}^child.sys_class_nameLIKEserver`);
      serverCounts.set(svc.sysId, rels.length);
    }

    const mapService = (svc: Service): ServiceCatalogEntry => ({
      name: svc.name,
      fullName: svc.fullName,
      description: svc.description,
      criticality: svc.criticality,
      environment: svc.environment,
      category: svc.category,
      infrastructure: svc.infrastructure,
      serverCount: serverCounts.get(svc.sysId) || 0,
    });

    const catalogPortfolios: PortfolioCatalogEntry[] = portfolios.map(p => ({
      name: p.name,
      sysId: p.sysId,
      state: p.state,
      services: (byPortfolio.get(p.sysId) || []).map(mapService),
    }));

    // Sort: portfolios with services first, then alphabetically
    catalogPortfolios.sort((a, b) => {
      if (a.services.length > 0 && b.services.length === 0) return -1;
      if (a.services.length === 0 && b.services.length > 0) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      portfolios: catalogPortfolios,
      unassigned: unassigned.map(mapService),
      totalPortfolios: portfolios.length,
      totalServices: allServices.length,
      fetchedAt: new Date().toISOString(),
    };
  }

  async getIPListForPortfolio(portfolioName: string): Promise<IPListData | null> {
    const portfolio = await this.getPortfolioByName(portfolioName);
    if (!portfolio) return null;

    const servers = await this.getServersForPortfolio(portfolio.sysId);

    return {
      portfolio: portfolio.name,
      portfolioId: portfolio.sysId,
      serverCount: servers.length,
      servers: servers.map(s => ({
        ip: s.ip,
        name: s.name,
        services: s.services || [],
        description: `${s.name} | ${(s.services || []).join(', ')}`,
      })),
      ipRanges: servers
        .filter(s => s.ip)
        .map(s => ({
          from_ip: s.ip!,
          description: `${s.name} | ${(s.services || []).join(', ')}`.slice(0, 255),
        })),
    };
  }
}

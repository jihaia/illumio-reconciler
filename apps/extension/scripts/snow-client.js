// snow-client.js (fixed)

const https = require('https');

class ServiceNowClient {
  constructor(instance, username, password) {
    this.instance = instance;
    this.auth = Buffer.from(`${username}:${password}`).toString('base64');
  }

  _request(table, queryString = '', limit = 100) {
    const url = `/api/now/table/${table}?sysparm_limit=${limit}${queryString ? '&' + queryString : ''}`;

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: this.instance,
        path: encodeURI(url),
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Accept': 'application/json',
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data).result || []);
          } else {
            reject(new Error(`HTTP ${res.statusCode} for ${table}`));
          }
        });
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error(`Timeout querying ${table}`));
      });

      req.on('error', reject);
      req.end();
    });
  }

  _encodeValue(value) {
    return encodeURIComponent(value);
  }

  // ─────────────────────────────────────────────────────────────
  // PORTFOLIOS
  // ─────────────────────────────────────────────────────────────

  async getPortfolios() {
    const results = await this._request('pm_portfolio', 'sysparm_query=active=true');
    return results.map(p => ({
      sysId: p.sys_id,
      name: p.name,
      state: p.state,
    }));
  }

  async getPortfolioByName(name) {
    // Get all and filter client-side to avoid encoding issues
    const results = await this._request('pm_portfolio', 'sysparm_query=active=true', 100);
    const match = results.find(p => 
      p.name.toLowerCase().includes(name.toLowerCase())
    );
    return match ? { sysId: match.sys_id, name: match.name } : null;
  }

  async getPortfolioById(sysId) {
    const results = await this._request('pm_portfolio', `sysparm_query=sys_id=${sysId}`, 1);
    return results[0] ? { sysId: results[0].sys_id, name: results[0].name } : null;
  }

  // ─────────────────────────────────────────────────────────────
  // SERVICES
  // ─────────────────────────────────────────────────────────────

  async getServices(query = 'operational_status=1', limit = 100) {
    const results = await this._request('cmdb_ci_service', `sysparm_query=${query}`, limit);
    return results.map(s => ({
      sysId: s.sys_id,
      name: s.name,
      description: s.short_description,
      criticality: s.busines_criticality,
      environment: s.used_for,
      portfolioId: s.u_product_portfolio?.value,
      infrastructure: s.u_infrastructure,
    }));
  }

  async getServicesByPortfolio(portfolioSysId, limit = 200) {
    return this.getServices(`u_product_portfolio=${portfolioSysId}^operational_status=1`, limit);
  }

  async getServiceByName(name) {
    const searchTerm = name.split(' ')[0]; // First word only
    const results = await this._request(
      'cmdb_ci_service',
      `sysparm_query=nameLIKE${this._encodeValue(searchTerm)}`,
      50
    );
    const match = results.find(s => s.name === name);
    return match ? {
      sysId: match.sys_id,
      name: match.name,
      description: match.short_description,
      criticality: match.busines_criticality,
      portfolioId: match.u_product_portfolio?.value,
    } : null;
  }

  async getServiceBySysId(sysId) {
    const results = await this._request('cmdb_ci_service', `sysparm_query=sys_id=${sysId}`, 1);
    return results[0] ? {
      sysId: results[0].sys_id,
      name: results[0].name,
      description: results[0].short_description,
      criticality: results[0].busines_criticality,
      portfolioId: results[0].u_product_portfolio?.value,
    } : null;
  }

  // ─────────────────────────────────────────────────────────────
  // SERVERS
  // ─────────────────────────────────────────────────────────────

  async getServers(query = 'operational_status=1^ip_addressISNOTEMPTY', limit = 100) {
    const results = await this._request('cmdb_ci_server', `sysparm_query=${query}`, limit);
    return results.map(s => ({
      sysId: s.sys_id,
      name: s.name,
      ip: s.ip_address,
      hostname: s.host_name,
      fqdn: s.fqdn,
      os: s.os,
      environment: s.classification,
    }));
  }

  async getServerByIP(ip) {
    const results = await this._request('cmdb_ci_server', `sysparm_query=ip_address=${ip}`, 1);
    return results[0] ? {
      sysId: results[0].sys_id,
      name: results[0].name,
      ip: results[0].ip_address,
      os: results[0].os,
      environment: results[0].classification,
    } : null;
  }

  // ─────────────────────────────────────────────────────────────
  // RELATIONSHIPS
  // ─────────────────────────────────────────────────────────────

  async getServersForService(serviceSysId) {
    const rels = await this._request('cmdb_rel_ci', `sysparm_query=parent=${serviceSysId}`);
    if (rels.length === 0) return [];

    const childIds = rels.map(r => r.child?.value).filter(Boolean);
    if (childIds.length === 0) return [];

    const children = await this._request('cmdb_ci', `sysparm_query=sys_idIN${childIds.join(',')}`);

    // Match any server type (includes linux_server, win_server, esx_server, etc.)
    return children
      .filter(c => c.sys_class_name?.includes('server'))
      .map(c => ({
        sysId: c.sys_id,
        name: c.name,
        ip: c.ip_address,
        type: c.sys_class_name,
      }));
  }

  async getServicesForServer(serverSysId) {
    const rels = await this._request('cmdb_rel_ci', `sysparm_query=child=${serverSysId}`);
    if (rels.length === 0) return [];

    const parentIds = rels.map(r => r.parent?.value).filter(Boolean);
    if (parentIds.length === 0) return [];

    const parents = await this._request('cmdb_ci', `sysparm_query=sys_idIN${parentIds.join(',')}`);

    // Match BOTH cmdb_ci_service AND cmdb_ci_service_discovered
    return parents
      .filter(p => p.sys_class_name?.includes('cmdb_ci_service'))
      .map(p => ({
        sysId: p.sys_id,
        name: p.name,
        description: p.short_description,
        type: p.sys_class_name,
      }));
  }

  // ─────────────────────────────────────────────────────────────
  // COMPOSITE QUERIES
  // ─────────────────────────────────────────────────────────────

  async getServersForPortfolio(portfolioSysId) {
    const services = await this.getServicesByPortfolio(portfolioSysId);
    const serverMap = new Map();

    // Limit to first 20 services to avoid timeout
    for (const service of services.slice(0, 20)) {
      const servers = await this.getServersForService(service.sysId);
      
      for (const server of servers) {
        if (serverMap.has(server.sysId)) {
          serverMap.get(server.sysId).services.push(service.name);
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

  async getServerContext(serverSysIdOrIP) {
    // Get server
    let server;
    if (serverSysIdOrIP.includes('.')) {
      server = await this.getServerByIP(serverSysIdOrIP);
    } else {
      const servers = await this._request('cmdb_ci_server', `sysparm_query=sys_id=${serverSysIdOrIP}`, 1);
      server = servers[0] ? {
        sysId: servers[0].sys_id,
        name: servers[0].name,
        ip: servers[0].ip_address,
        os: servers[0].os,
        environment: servers[0].classification,
      } : null;
    }

    if (!server) return null;

    // Get services (now includes cmdb_ci_service_discovered)
    const services = await this.getServicesForServer(server.sysId);

    // For discovered services, try to get portfolio from the main service table
    // by matching name pattern (e.g., "NMT [M-T #4] (P)")
    const portfolioIds = new Set();
    
    for (const svc of services) {
      // Try to find matching service in cmdb_ci_service to get portfolio
      const mainService = await this.getServiceByName(svc.name);
      if (mainService?.portfolioId) {
        portfolioIds.add(mainService.portfolioId);
      }
    }

    // Get portfolio names
    let portfolios = [];
    if (portfolioIds.size > 0) {
      const portfolioResults = await this._request(
        'pm_portfolio',
        `sysparm_query=sys_idIN${[...portfolioIds].join(',')}`
      );
      portfolios = portfolioResults.map(p => ({ sysId: p.sys_id, name: p.name }));
    }

    return {
      server: {
        sysId: server.sysId,
        name: server.name,
        ip: server.ip,
        os: server.os,
        environment: server.environment,
      },
      services: services.map(s => s.name),
      portfolios: portfolios.map(p => p.name),
      isMultiUse: services.length > 1 || portfolios.length > 1,
    };
  }

  async getIPListForPortfolio(portfolioName) {
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
        services: s.services,
        description: `${s.name} | ${s.services.join(', ')}`,
      })),
      ipRanges: servers
        .filter(s => s.ip)
        .map(s => ({
          from_ip: s.ip,
          description: `${s.name} | ${s.services.join(', ')}`.slice(0, 255),
        })),
    };
  }
}

module.exports = { ServiceNowClient };
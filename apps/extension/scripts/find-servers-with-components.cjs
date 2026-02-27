// find-servers-with-components.cjs
// Diagnoses which servers loaded in the graph have components,
// and whether component-hosting servers are in portfolios that get loaded.

const https = require('https');

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const INSTANCE = 'digitalaviation.service-now.com';
const USERNAME = 'jason.ihaia@subjectdata.com';
const PASSWORD = '4ki8qm7@BTQPhqez';
const AUTH = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

const INFRA_CLASSES = [
  'cmdb_ci_network_adapter', 'cmdb_ci_ip_address', 'dscy_router_interface',
  'dscy_route_interface', 'dscy_route_next_hop', 'cmdb_ci_dns_name',
];

// ─────────────────────────────────────────────────────────────
// HTTP HELPER
// ─────────────────────────────────────────────────────────────

let apiCallCount = 0;

function request(table, queryString = '', limit = 100) {
  const path = `/api/now/table/${table}?sysparm_limit=${limit}${queryString ? '&' + queryString : ''}`;
  apiCallCount++;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: INSTANCE,
      path: encodeURI(path),
      method: 'GET',
      headers: {
        'Authorization': `Basic ${AUTH}`,
        'Accept': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data).result || []);
          } catch (e) {
            reject(new Error(`JSON parse error for ${table}: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode} for ${table} (${path.substring(0, 120)})`));
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

// ─────────────────────────────────────────────────────────────
// HELPERS (mirror extension logic exactly)
// ─────────────────────────────────────────────────────────────

async function getPortfolios() {
  const results = await request('pm_portfolio', 'sysparm_query=active=true');
  return results.map(p => ({ sysId: p.sys_id, name: p.name, state: p.state }));
}

async function getServicesByPortfolio(portfolioSysId) {
  const results = await request(
    'cmdb_ci_service',
    `sysparm_query=u_product_portfolio=${portfolioSysId}^operational_status=1`,
    200
  );
  return results.map(s => ({
    sysId: s.sys_id,
    name: s.name,
    portfolioId: s.u_product_portfolio?.value,
  }));
}

async function getServersForService(serviceSysId) {
  const rels = await request('cmdb_rel_ci', `sysparm_query=parent=${serviceSysId}`);
  if (rels.length === 0) return [];

  const childIds = rels.map(r => r.child?.value).filter(Boolean);
  if (childIds.length === 0) return [];

  const children = await request('cmdb_ci', `sysparm_query=sys_idIN${childIds.join(',')}`);
  return children
    .filter(c => c.sys_class_name?.includes('server'))
    .map(c => ({
      sysId: c.sys_id,
      name: c.name,
      ip: c.ip_address,
      type: c.sys_class_name,
    }));
}

async function getComponentsForServer(serverName) {
  // EXACT same query as the extension: cmdb_ci, nameLIKE@{serverName}, limit 100
  const results = await request(
    'cmdb_ci',
    `sysparm_query=nameLIKE@${encodeURIComponent(serverName)}`,
    100
  );

  return {
    raw: results.map(c => ({
      sysId: c.sys_id,
      name: c.name,
      className: c.sys_class_name,
    })),
    filtered: results
      .filter(c => !INFRA_CLASSES.includes(c.sys_class_name))
      .map(c => ({
        sysId: c.sys_id,
        name: c.name,
        className: c.sys_class_name,
        shortDescription: c.short_description,
      })),
  };
}

// ─────────────────────────────────────────────────────────────
// PART 1: Simulate extension graph load, check for components
// ─────────────────────────────────────────────────────────────

async function part1_simulateExtensionLoad() {
  console.log('='.repeat(80));
  console.log('PART 1: Simulating extension getAllCMDBData (first 10 portfolios)');
  console.log('='.repeat(80));
  console.log();

  // Step 1: Get all active portfolios (limit 100, same as extension)
  const allPortfolios = await getPortfolios();
  console.log(`Total active portfolios: ${allPortfolios.length}`);
  console.log();

  const loadedPortfolios = allPortfolios.slice(0, 10);
  console.log(`Loading first 10 portfolios:`);
  loadedPortfolios.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.sysId})`));
  console.log();

  // Per-portfolio results
  const portfolioResults = [];
  let totalServers = 0;
  let totalServersWithComponents = 0;
  let totalComponentCount = 0;

  for (const portfolio of loadedPortfolios) {
    console.log(`--- Portfolio: ${portfolio.name} ---`);

    // Step 2: Get services for this portfolio
    const services = await getServicesByPortfolio(portfolio.sysId);
    console.log(`  Services (operational_status=1): ${services.length}`);

    const serverMap = new Map(); // deduplicate servers within this portfolio

    // Step 3: For each service (up to 20, same as extension getServersForPortfolio but
    // getAllCMDBData iterates all services without a .slice(0, 20) — it does services.slice(0, 20) 
    // ... wait, looking at the code: getAllCMDBData does NOT slice services. Only getServersForPortfolio 
    // does. But getAllCMDBData iterates: for (const service of services.slice(0, 20))
    // Actually re-reading: getAllCMDBData does services.slice(0, 20). So we do the same.
    for (const service of services.slice(0, 20)) {
      const servers = await getServersForService(service.sysId);
      for (const server of servers) {
        if (!serverMap.has(server.sysId)) {
          serverMap.set(server.sysId, {
            ...server,
            services: [service.name],
          });
        } else {
          serverMap.get(server.sysId).services.push(service.name);
        }
      }
    }

    const serversInPortfolio = Array.from(serverMap.values());
    console.log(`  Servers found: ${serversInPortfolio.length}`);

    // Step 4 & 5: For each server, get components (exact extension query)
    const serversWithComponents = [];
    const serversWithoutComponents = [];

    for (const server of serversInPortfolio) {
      const { raw, filtered } = await getComponentsForServer(server.name);

      if (filtered.length > 0) {
        serversWithComponents.push({
          name: server.name,
          ip: server.ip,
          type: server.type,
          services: server.services,
          componentCount: filtered.length,
          rawCount: raw.length,
          filteredOut: raw.length - filtered.length,
          components: filtered.map(c => `${c.name} (${c.className})`),
        });
        totalServersWithComponents++;
        totalComponentCount += filtered.length;
      } else {
        serversWithoutComponents.push({
          name: server.name,
          rawCount: raw.length,
        });
      }
    }

    totalServers += serversInPortfolio.length;

    // Print results for this portfolio
    if (serversWithComponents.length > 0) {
      console.log(`  ** Servers WITH components: ${serversWithComponents.length} **`);
      for (const s of serversWithComponents) {
        console.log(`    ${s.name} (${s.type}) — ${s.componentCount} components (${s.filteredOut} infra filtered out)`);
        for (const c of s.components.slice(0, 5)) {
          console.log(`      - ${c}`);
        }
        if (s.components.length > 5) {
          console.log(`      ... and ${s.components.length - 5} more`);
        }
      }
    }

    if (serversWithoutComponents.length > 0) {
      console.log(`  Servers without components: ${serversWithoutComponents.length}`);
      // Show which ones had raw results that were all filtered out
      const hadRawButFiltered = serversWithoutComponents.filter(s => s.rawCount > 0);
      if (hadRawButFiltered.length > 0) {
        console.log(`    (${hadRawButFiltered.length} had raw matches that were all infrastructure classes)`);
        for (const s of hadRawButFiltered) {
          console.log(`      ${s.name}: ${s.rawCount} raw results, all filtered`);
        }
      }
    }

    portfolioResults.push({
      portfolio: portfolio.name,
      serverCount: serversInPortfolio.length,
      serversWithComponents: serversWithComponents.length,
      totalComponents: serversWithComponents.reduce((sum, s) => sum + s.componentCount, 0),
    });

    console.log();
  }

  // Summary
  console.log('='.repeat(80));
  console.log('PART 1 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total portfolios loaded: ${loadedPortfolios.length}`);
  console.log(`Total unique servers across all portfolios: ${totalServers}`);
  console.log(`Servers with components: ${totalServersWithComponents}`);
  console.log(`Total components found: ${totalComponentCount}`);
  console.log();
  console.log('Per-portfolio breakdown:');
  for (const r of portfolioResults) {
    const pct = r.serverCount > 0 ? Math.round(r.serversWithComponents / r.serverCount * 100) : 0;
    console.log(`  ${r.portfolio}: ${r.serversWithComponents}/${r.serverCount} servers have components (${r.totalComponents} total) [${pct}%]`);
  }
  console.log();

  return {
    loadedPortfolios,
    allPortfolios,
    portfolioResults,
  };
}

// ─────────────────────────────────────────────────────────────
// PART 2: Find known components, trace back to servers & portfolios
// ─────────────────────────────────────────────────────────────

async function part2_traceComponentsBackToPortfolios(loadedPortfolios, allPortfolios) {
  console.log('='.repeat(80));
  console.log('PART 2: Finding components with @ in name, tracing to portfolios');
  console.log('='.repeat(80));
  console.log();

  // Step 7: Get 20 known components with @ in their name
  console.log('Querying cmdb_ci for items with @ in name (operational_status=1)...');
  const components = await request(
    'cmdb_ci',
    'sysparm_query=nameLIKE@^operational_status=1',
    20
  );

  console.log(`Found ${components.length} components with @ in name:`);
  console.log();

  const loadedPortfolioNames = new Set(loadedPortfolios.map(p => p.name));
  const loadedPortfolioSysIds = new Set(loadedPortfolios.map(p => p.sysId));

  const results = [];

  for (const comp of components) {
    const compName = comp.name;
    const compClass = comp.sys_class_name;

    // Step 8: Extract hostname after @
    const atIndex = compName.indexOf('@');
    if (atIndex === -1) {
      console.log(`  ${compName} (${compClass}) — no @ found, skipping`);
      continue;
    }
    const hostname = compName.substring(atIndex + 1);

    console.log(`  Component: ${compName} (${compClass})`);
    console.log(`    Hostname: ${hostname}`);

    // Skip infrastructure classes
    if (INFRA_CLASSES.includes(compClass)) {
      console.log(`    ** INFRASTRUCTURE CLASS — would be filtered out by extension **`);
      continue;
    }

    // Step 9: Check if hostname exists as a server
    const serverResults = await request(
      'cmdb_ci_server',
      `sysparm_query=name=${encodeURIComponent(hostname)}`,
      1
    );

    let serverExists = false;
    let serverSysId = null;

    if (serverResults.length > 0) {
      serverExists = true;
      serverSysId = serverResults[0].sys_id;
      console.log(`    Server exists: YES (sys_id: ${serverSysId}, class: ${serverResults[0].sys_class_name})`);
    } else {
      // Try broader search on cmdb_ci
      const ciResults = await request(
        'cmdb_ci',
        `sysparm_query=name=${encodeURIComponent(hostname)}^sys_class_nameLIKEserver`,
        1
      );
      if (ciResults.length > 0) {
        serverExists = true;
        serverSysId = ciResults[0].sys_id;
        console.log(`    Server exists: YES (found via cmdb_ci, sys_id: ${serverSysId}, class: ${ciResults[0].sys_class_name})`);
      } else {
        console.log(`    Server exists: NO — no server record for "${hostname}"`);
      }
    }

    if (!serverExists || !serverSysId) {
      results.push({
        component: compName,
        className: compClass,
        hostname,
        serverExists: false,
        services: [],
        portfolios: [],
        inLoadedPortfolios: false,
      });
      console.log();
      continue;
    }

    // Step 9 continued: Check if the server belongs to any services/portfolios
    // Use same logic as extension: get parent relationships -> resolve -> filter for services
    const rels = await request('cmdb_rel_ci', `sysparm_query=child=${serverSysId}`);
    const parentIds = rels.map(r => r.parent?.value).filter(Boolean);

    let services = [];
    let portfolios = [];
    let inLoadedPortfolio = false;

    if (parentIds.length > 0) {
      const parents = await request('cmdb_ci', `sysparm_query=sys_idIN${parentIds.join(',')}`);
      services = parents
        .filter(p => p.sys_class_name?.includes('cmdb_ci_service'))
        .map(p => ({ sysId: p.sys_id, name: p.name, type: p.sys_class_name }));

      console.log(`    Services: ${services.length > 0 ? services.map(s => s.name).join(', ') : 'NONE'}`);

      // For each service, look up which portfolio it belongs to
      const portfolioIds = new Set();
      for (const svc of services) {
        // Look up the service in cmdb_ci_service to get portfolio
        const svcResults = await request(
          'cmdb_ci_service',
          `sysparm_query=name=${encodeURIComponent(svc.name)}^operational_status=1`,
          1
        );
        if (svcResults.length > 0 && svcResults[0].u_product_portfolio?.value) {
          portfolioIds.add(svcResults[0].u_product_portfolio.value);
        }
      }

      if (portfolioIds.size > 0) {
        const pfResults = await request(
          'pm_portfolio',
          `sysparm_query=sys_idIN${[...portfolioIds].join(',')}`
        );
        portfolios = pfResults.map(p => ({ sysId: p.sys_id, name: p.name }));

        for (const pf of portfolios) {
          if (loadedPortfolioSysIds.has(pf.sysId)) {
            inLoadedPortfolio = true;
          }
        }

        console.log(`    Portfolios: ${portfolios.map(p => p.name).join(', ')}`);
        console.log(`    In loaded (first 10) portfolios: ${inLoadedPortfolio ? 'YES' : 'NO'}`);

        if (!inLoadedPortfolio) {
          // Find where in the full list these portfolios appear
          for (const pf of portfolios) {
            const idx = allPortfolios.findIndex(ap => ap.sysId === pf.sysId);
            console.log(`      "${pf.name}" is at position ${idx + 1} of ${allPortfolios.length} total portfolios${idx >= 10 ? ' (BEYOND the first 10 loaded)' : ''}`);
          }
        }
      } else {
        console.log(`    Portfolios: NONE (services have no portfolio assignment)`);
      }
    } else {
      console.log(`    Relationships: NONE (server has no parent relationships)`);
    }

    results.push({
      component: compName,
      className: compClass,
      hostname,
      serverExists: true,
      services: services.map(s => s.name),
      portfolios: portfolios.map(p => p.name),
      inLoadedPortfolios: inLoadedPortfolio,
    });

    console.log();
  }

  // Step 10: Summary
  console.log('='.repeat(80));
  console.log('PART 2 SUMMARY');
  console.log('='.repeat(80));

  const withServer = results.filter(r => r.serverExists);
  const withServices = results.filter(r => r.services.length > 0);
  const withPortfolios = results.filter(r => r.portfolios.length > 0);
  const inLoaded = results.filter(r => r.inLoadedPortfolios);
  const notInLoaded = withPortfolios.filter(r => !r.inLoadedPortfolios);

  console.log(`Components examined: ${results.length}`);
  console.log(`  Have a matching server record: ${withServer.length}`);
  console.log(`  Server belongs to services: ${withServices.length}`);
  console.log(`  Server's services belong to portfolios: ${withPortfolios.length}`);
  console.log(`  In one of the first 10 loaded portfolios: ${inLoaded.length}`);
  console.log(`  In portfolios BEYOND the first 10: ${notInLoaded.length}`);
  console.log();

  if (notInLoaded.length > 0) {
    console.log('** Components in portfolios that are NOT loaded (root cause candidates): **');
    for (const r of notInLoaded) {
      console.log(`  ${r.component} -> server "${r.hostname}" -> portfolios: ${r.portfolios.join(', ')}`);
    }
    console.log();
  }

  // Group by portfolio to see which unloaded portfolios have components
  const unloadedPortfolioComponents = new Map();
  for (const r of notInLoaded) {
    for (const pf of r.portfolios) {
      if (!loadedPortfolioNames.has(pf)) {
        if (!unloadedPortfolioComponents.has(pf)) {
          unloadedPortfolioComponents.set(pf, []);
        }
        unloadedPortfolioComponents.get(pf).push(r.component);
      }
    }
  }

  if (unloadedPortfolioComponents.size > 0) {
    console.log('Portfolios NOT in the first 10 that contain component-hosting servers:');
    for (const [pf, comps] of unloadedPortfolioComponents) {
      console.log(`  "${pf}": ${comps.length} components`);
      comps.forEach(c => console.log(`    - ${c}`));
    }
    console.log();
  }

  // Also check: do any of the components belong to servers that have NO services at all?
  const orphanServers = results.filter(r => r.serverExists && r.services.length === 0);
  if (orphanServers.length > 0) {
    console.log('Components whose servers have NO service relationships (orphan servers):');
    for (const r of orphanServers) {
      console.log(`  ${r.component} -> server "${r.hostname}" (no services, no portfolios)`);
    }
    console.log();
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log('Illumio Reconciler: Component Discovery Diagnostic');
  console.log(`Instance: ${INSTANCE}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log();

  try {
    // Part 1
    const { loadedPortfolios, allPortfolios, portfolioResults } = await part1_simulateExtensionLoad();

    // Part 2
    await part2_traceComponentsBackToPortfolios(loadedPortfolios, allPortfolios);

    // Final diagnosis
    console.log('='.repeat(80));
    console.log('DIAGNOSIS');
    console.log('='.repeat(80));

    const hasComponents = portfolioResults.some(r => r.serversWithComponents > 0);
    const totalWithComponents = portfolioResults.reduce((sum, r) => sum + r.serversWithComponents, 0);
    const totalServers = portfolioResults.reduce((sum, r) => sum + r.serverCount, 0);

    if (totalWithComponents === 0) {
      console.log('FINDING: Zero servers in the first 10 portfolios have components.');
      console.log('This means the graph will show NO component nodes for any server.');
      console.log();
      console.log('Possible reasons:');
      console.log('  1. The servers in these portfolios genuinely have no components');
      console.log('     (no "Type@hostname" records in cmdb_ci)');
      console.log('  2. Component-hosting servers belong to portfolios beyond the first 10');
      console.log('  3. The component naming convention (@hostname) does not match');
      console.log('     the server names in these portfolios');
    } else {
      console.log(`FINDING: ${totalWithComponents} of ${totalServers} servers have components.`);
      console.log('The graph should display component nodes for these servers.');
    }

    console.log();
    console.log(`Total API calls: ${apiCallCount}`);
    console.log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.error('FATAL ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();

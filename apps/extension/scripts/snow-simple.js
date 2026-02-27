// snow-simple.js
// Run with: node snow-simple.js

const https = require('https');

// ============================================
// CONFIGURE THESE
// ============================================
const INSTANCE = 'digitalaviation.service-now.com';
const USERNAME = 'jason.ihaia@subjectdata.com';  // Replace with your username
const PASSWORD = '4ki8qm7@BTQPhqez';  // Replace with your password
// ============================================

const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

function request(table, queryString = '') {
  const url = `/api/now/table/${table}?sysparm_limit=10${queryString ? '&' + queryString : ''}`;
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: INSTANCE,
      path: encodeURI(url),
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data).result || []);
        } else {
          resolve([]);
        }
      });
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('🔍 Simple ServiceNow Test\n');

  // 1. Portfolios - use the exact field names we saw in raw output
  console.log('📁 PORTFOLIOS');
  const portfolios = await request('pm_portfolio');
  portfolios.slice(0, 5).forEach(p => {
    console.log(`  • ${p.name} (state: ${p.state})`);
  });

  // 2. Products - field is "product_name" not "name"
  console.log('\n📦 PRODUCTS');
  const products = await request('x_jepp2_aviation_s_aviation_product');
  products.forEach(p => {
    console.log(`  • ${p.product_name} (active: ${p.active})`);
  });

  // 3. Services - use exact field names from raw output
  console.log('\n🔧 SERVICES');
  const services = await request('cmdb_ci_service', 'sysparm_query=operational_status=1');
  services.slice(0, 5).forEach(s => {
    console.log(`  • ${s.name}`);
    console.log(`      Criticality: ${s.busines_criticality || 'none'}`);
    console.log(`      Environment: ${s.used_for || 'none'}`);
    console.log(`      Portfolio ID: ${s.u_product_portfolio?.value || 'none'}`);
  });

  // 4. Find NMT and get its related servers
  console.log('\n🔗 NMT SERVICE → SERVERS');
  const nmtServices = await request('cmdb_ci_service', 'sysparm_query=nameLIKENMT');
  
  if (nmtServices.length > 0) {
    const nmt = nmtServices[0];
    console.log(`  Service: ${nmt.name} (sys_id: ${nmt.sys_id})`);
    
    // Get relationships
    const rels = await request('cmdb_rel_ci', `sysparm_query=parent=${nmt.sys_id}`);
    console.log(`  Found ${rels.length} child relationships`);
    
    if (rels.length > 0) {
      // Get the child CIs
      const childIds = rels.map(r => r.child?.value).filter(Boolean);
      console.log(`  Child IDs: ${childIds.slice(0, 3).join(', ')}...`);
      
      // Query each child (simplified - just first 5)
      for (const childId of childIds.slice(0, 5)) {
        const children = await request('cmdb_ci', `sysparm_query=sys_id=${childId}`);
        if (children.length > 0) {
          const child = children[0];
          console.log(`    → ${child.name} (${child.sys_class_name}) IP: ${child.ip_address || 'none'}`);
        }
      }
    }
  }

  // 5. Get server by IP and find its services
  console.log('\n🖥️ SERVER → SERVICES (for 10.1.88.156)');
  const servers = await request('cmdb_ci_server', 'sysparm_query=ip_address=10.1.88.156');
  
  if (servers.length > 0) {
    const server = servers[0];
    console.log(`  Server: ${server.name} (${server.ip_address})`);
    console.log(`  sys_id: ${server.sys_id}`);
    
    // Get relationships where this server is a child
    const rels = await request('cmdb_rel_ci', `sysparm_query=child=${server.sys_id}`);
    console.log(`  Found ${rels.length} parent relationships`);
    
    for (const rel of rels.slice(0, 5)) {
      const parentId = rel.parent?.value;
      if (parentId) {
        const parents = await request('cmdb_ci', `sysparm_query=sys_id=${parentId}`);
        if (parents.length > 0) {
          const parent = parents[0];
          if (parent.sys_class_name === 'cmdb_ci_service') {
            console.log(`    ← ${parent.name} [${parent.sys_class_name}]`);
          }
        }
      }
    }
  }

  // 6. Get services in a specific portfolio
  console.log('\n🎯 SERVICES IN "SDA | Flight Planning & Dispatch" PORTFOLIO');
  const fpPortfolios = await request('pm_portfolio', 'sysparm_query=nameLIKEFlight Planning');
  
  if (fpPortfolios.length > 0) {
    const portfolio = fpPortfolios[0];
    console.log(`  Portfolio: ${portfolio.name}`);
    console.log(`  sys_id: ${portfolio.sys_id}`);
    
    // Find services with this portfolio
    const portfolioServices = await request(
      'cmdb_ci_service', 
      `sysparm_query=u_product_portfolio=${portfolio.sys_id}^operational_status=1`
    );
    
    console.log(`  Found ${portfolioServices.length} services:`);
    portfolioServices.slice(0, 10).forEach(s => {
      console.log(`    • ${s.name}`);
    });
  } else {
    console.log('  Portfolio not found');
  }

  console.log('\n✅ Done!');
}

main().catch(err => console.error('Error:', err.message));
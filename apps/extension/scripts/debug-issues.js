// debug-issues.js

const { ServiceNowClient } = require('./snow-client');

// ============================================
// CONFIGURE THESE
// ============================================
const INSTANCE = 'digitalaviation.service-now.com';
const USERNAME = 'jason.ihaia@subjectdata.com';  // Replace with your username
const PASSWORD = '4ki8qm7@BTQPhqez';  // Replace with your password
// ============================================

const client = new ServiceNowClient(INSTANCE, USERNAME, PASSWORD);

async function debug() {
  console.log('🔍 Debugging Issues\n');

  // 1. Debug: Server context - why no services?
  console.log('═'.repeat(60));
  console.log('ISSUE 1: Server 10.1.88.156 shows no services\n');
  
  const server = await client.getServerByIP('10.1.88.156');
  console.log('Server found:', server);
  
  if (server) {
    // Get raw relationships
    const rels = await client._request('cmdb_rel_ci', `sysparm_query=child=${server.sysId}`);
    console.log(`\nRelationships where server is child: ${rels.length}`);
    
    if (rels.length > 0) {
      // Get parent details
      const parentIds = rels.map(r => r.parent?.value).filter(Boolean);
      console.log('Parent IDs:', parentIds.slice(0, 5));
      
      const parents = await client._request('cmdb_ci', `sysparm_query=sys_idIN${parentIds.join(',')}`);
      console.log('\nParent CIs:');
      parents.forEach(p => {
        console.log(`  • ${p.name} [${p.sys_class_name}]`);
      });
      
      // Filter to services only
      const services = parents.filter(p => p.sys_class_name === 'cmdb_ci_service');
      console.log(`\nServices only: ${services.length}`);
      services.forEach(s => console.log(`  • ${s.name}`));
    }
  }

  // 2. Debug: Portfolio names - find the right one
  console.log('\n' + '═'.repeat(60));
  console.log('ISSUE 2: Portfolio "Mission Products" not found\n');
  
  const allPortfolios = await client._request('pm_portfolio', 'sysparm_query=active=true', 50);
  console.log('All portfolio names:');
  allPortfolios.forEach(p => {
    console.log(`  • "${p.name}"`);
  });

  // Try to find one with "Mission"
  const missionPortfolios = allPortfolios.filter(p => 
    p.name.toLowerCase().includes('mission')
  );
  console.log('\nPortfolios containing "mission":');
  missionPortfolios.forEach(p => console.log(`  • "${p.name}"`));

  // 3. Debug: Services in Flight Planning portfolio
  console.log('\n' + '═'.repeat(60));
  console.log('ISSUE 3: Flight Planning services\n');
  
  const fpPortfolio = allPortfolios.find(p => 
    p.name.toLowerCase().includes('flight planning')
  );
  
  if (fpPortfolio) {
    console.log(`Portfolio: ${fpPortfolio.name} (${fpPortfolio.sys_id})`);
    
    const services = await client._request(
      'cmdb_ci_service',
      `sysparm_query=u_product_portfolio=${fpPortfolio.sys_id}^operational_status=1`
    );
    
    console.log(`Services in portfolio: ${services.length}`);
    services.forEach(s => {
      console.log(`  • ${s.name} (criticality: ${s.busines_criticality})`);
    });
  }

  // 4. Let's find a portfolio that HAS servers
  console.log('\n' + '═'.repeat(60));
  console.log('FINDING A PORTFOLIO WITH SERVERS\n');

  // Get NMT service and trace back to its portfolio
  const nmtService = await client.getServiceByName('NMT [M-T #4] (P)');
  console.log('NMT Service:', nmtService);
  
  if (nmtService?.portfolioId) {
    const portfolio = await client._request('pm_portfolio', `sysparm_query=sys_id=${nmtService.portfolioId}`, 1);
    if (portfolio[0]) {
      console.log(`\nNMT belongs to portfolio: "${portfolio[0].name}"`);
      
      // Now get all services in that portfolio
      const portfolioServices = await client._request(
        'cmdb_ci_service',
        `sysparm_query=u_product_portfolio=${portfolio[0].sys_id}^operational_status=1`
      );
      console.log(`\nServices in "${portfolio[0].name}":`);
      portfolioServices.forEach(s => console.log(`  • ${s.name}`));
    }
  }

  console.log('\n✅ Debug complete');
}

debug().catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
});
// test-full.js

const { ServiceNowClient } = require('./snow-client');

// ============================================
// CONFIGURE THESE
// ============================================
const INSTANCE = 'digitalaviation.service-now.com';
const USERNAME = 'jason.ihaia@subjectdata.com';  // Replace with your username
const PASSWORD = '4ki8qm7@BTQPhqez';  // Replace with your password
// ============================================

const client = new ServiceNowClient(INSTANCE, USERNAME, PASSWORD);

async function test() {
  console.log('🔍 Full ServiceNow Client Test (Fixed)\n');
  console.log('═'.repeat(70));

  // 1. List some portfolios
  console.log('\n📁 PORTFOLIOS (first 10)\n');
  const portfolios = await client.getPortfolios();
  portfolios.slice(0, 10).forEach(p => {
    console.log(`  • ${p.name}`);
  });

  // 2. Get services for Flight Deck portfolio (where NMT lives)
  console.log('\n🎯 SERVICES IN "Flight Deck" PORTFOLIO (first 10)\n');
  const flightDeck = await client.getPortfolioByName('Flight Deck');
  
  if (flightDeck) {
    console.log(`  Portfolio: ${flightDeck.name} (${flightDeck.sysId})`);
    const services = await client.getServicesByPortfolio(flightDeck.sysId);
    console.log(`  Total services: ${services.length}`);
    console.log(`  First 10:`);
    services.slice(0, 10).forEach(s => {
      console.log(`    • ${s.name} (${s.criticality || 'no criticality'})`);
    });
  }

  // 3. Get servers for NMT service
  console.log('\n🖥️ SERVERS FOR "NMT [M-T #4] (P)"\n');
  const nmtService = await client.getServiceByName('NMT [M-T #4] (P)');
  
  if (nmtService) {
    console.log(`  Service: ${nmtService.name}`);
    console.log(`  Portfolio ID: ${nmtService.portfolioId}`);
    const servers = await client.getServersForService(nmtService.sysId);
    console.log(`  Servers (${servers.length}):`);
    servers.forEach(s => {
      console.log(`    • ${s.name} - ${s.ip || 'no IP'} [${s.type}]`);
    });
  }

  // 4. Get server context with FIXED service detection
  console.log('\n🔗 SERVER CONTEXT FOR 10.1.88.156 (denmntdb01p)\n');
  const context = await client.getServerContext('10.1.88.156');
  
  if (context) {
    console.log(`  Server: ${context.server.name} (${context.server.ip})`);
    console.log(`  OS: ${context.server.os}`);
    console.log(`  Environment: ${context.server.environment}`);
    console.log(`  Services (${context.services.length}):`);
    context.services.forEach(s => console.log(`    • ${s}`));
    console.log(`  Portfolios: ${context.portfolios.join(', ') || 'Unknown'}`);
    console.log(`  Multi-use: ${context.isMultiUse ? 'YES ⚠️' : 'No'}`);
  }

  // 5. Generate IP List for Flight Deck portfolio
  console.log('\n📋 IP LIST FOR "Flight Deck" (first 10 servers)\n');
  const ipListData = await client.getIPListForPortfolio('Flight Deck');
  
  if (ipListData) {
    console.log(`  Portfolio: ${ipListData.portfolio}`);
    console.log(`  Total Servers: ${ipListData.serverCount}`);
    console.log(`\n  Servers with IPs:`);
    ipListData.servers
      .filter(s => s.ip)
      .slice(0, 10)
      .forEach(s => {
        console.log(`    • ${s.ip.padEnd(15)} ${s.name}`);
        console.log(`        Services: ${s.services.join(', ')}`);
      });
    
    console.log(`\n  Illumio IP List ready: ${ipListData.ipRanges.length} IP ranges`);
  }

  // 6. Test Mission Products portfolio
  console.log('\n📋 IP LIST FOR "Mission Products"\n');
  const missionData = await client.getIPListForPortfolio('Mission Products');
  
  if (missionData) {
    console.log(`  Portfolio: ${missionData.portfolio}`);
    console.log(`  Total Servers: ${missionData.serverCount}`);
    missionData.servers.slice(0, 5).forEach(s => {
      console.log(`    • ${s.ip || 'no IP'} - ${s.name}`);
    });
  } else {
    console.log('  No servers found (or no services with relationships)');
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ Done!');
}

test().catch(err => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
});
// test-servicenow.js

const https = require('https');
const { ServiceNowClient } = require('./snow-client');

// ============================================
// CONFIGURE THESE
// ============================================
const INSTANCE = 'digitalaviation.service-now.com';
const USERNAME = 'jason.ihaia@subjectdata.com';  // Replace with your username
const PASSWORD = '4ki8qm7@BTQPhqez';  // Replace with your password
// ============================================

const client = new ServiceNowClient(
  INSTANCE,
  USERNAME,
  PASSWORD
);

async function test() {
  console.log('🔍 Testing ServiceNow Client\n');

  // 1. Get portfolios
  console.log('📁 PORTFOLIOS\n');
  const portfolios = await client.getPortfolios();
  portfolios.slice(0, 5).forEach(p => {
    console.log(`  • ${p.name} (${p.state})`);
  });

  // 2. Get products
  console.log('\n📦 PRODUCTS\n');
  const products = await client.getProducts();
  products.forEach(p => {
    console.log(`  • ${p.name}`);
  });

  // 3. Get services
  console.log('\n🔧 SERVICES (first 5)\n');
  const services = await client.getServices();
  for (const s of services.slice(0, 5)) {
    console.log(`  • ${s.name}`);
    console.log(`      Portfolio: ${s.portfolioId || 'none'}`);
    console.log(`      Environment: ${s.environment}`);
    console.log(`      Criticality: ${s.criticality}`);
  }

  // 4. Get servers for NMT service
  console.log('\n🖥️ SERVERS FOR NMT SERVICE\n');
  const nmtService = await client.getServiceByName('NMT [M-T #4] (P)');
  
  if (nmtService) {
    console.log(`  Service: ${nmtService.name} (${nmtService.sys_id})`);
    
    const servers = await client.getServersForService(nmtService.sys_id);
    console.log(`  Found ${servers.length} servers:\n`);
    
    servers.forEach(s => {
      console.log(`    • ${s.name} (${s.ip || 'no IP'}) [${s.type}]`);
    });
  }

  // 5. Get services for a specific server
  console.log('\n🔗 SERVICES FOR SERVER 10.1.88.156\n');
  const server = await client.getServerByIP('10.1.88.156');
  
  if (server) {
    console.log(`  Server: ${server.name}`);
    
    const serverServices = await client.getServicesForServer(server.sys_id);
    console.log(`  Supports ${serverServices.length} services:\n`);
    
    serverServices.forEach(s => {
      console.log(`    • ${s.name}`);
    });
  }

  // 6. Find a portfolio and get all its servers
  console.log('\n🎯 SERVERS FOR "SDA | Flight Planning & Dispatch" PORTFOLIO\n');
  const portfolio = await client.getPortfolioByName('SDA | Flight Planning & Dispatch');
  
  if (portfolio) {
    console.log(`  Portfolio: ${portfolio.name} (${portfolio.sys_id})`);
    
    const portfolioServers = await client.getServersForPortfolio(portfolio.sys_id);
    console.log(`  Found ${portfolioServers.length} servers:\n`);
    
    portfolioServers.slice(0, 10).forEach(s => {
      console.log(`    • ${s.name} (${s.ip || 'no IP'})`);
      console.log(`        Services: ${s.services.join(', ')}`);
    });
  } else {
    console.log('  Portfolio not found');
  }

  console.log('\n✅ Done!');
}

test().catch(err => {
  console.error('Error:', err.message);
});
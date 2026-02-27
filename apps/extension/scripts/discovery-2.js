// discovery.js
// Run with: node discovery.js

const https = require('https');

// ============================================
// CONFIGURE THESE
// ============================================
const INSTANCE = 'digitalaviation.service-now.com';
const USERNAME = 'jason.ihaia@subjectdata.com';  // Replace with your username
const PASSWORD = '4ki8qm7@BTQPhqez';  // Replace with your password
// ============================================

const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

function query(table, params = 'sysparm_limit=10') {
  return new Promise((resolve, reject) => {
    const url = `/api/now/table/${table}?${params}`;
    
    const options = {
      hostname: INSTANCE,
      path: url,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data).result);
          } catch (e) {
            reject(new Error('Invalid JSON'));
          }
        } else {
          console.log(`   ❌ ${res.statusCode} for ${table}`);
          resolve(null);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function discoverPart2() {
  console.log('🔍 ServiceNow CMDB Discovery - Part 2');
  console.log('='.repeat(60));

  // 1. Get ALL relationship types (not just 5)
  console.log('\n📋 ALL RELATIONSHIP TYPES\n');
  const relTypes = await query('cmdb_rel_type', 'sysparm_limit=100&sysparm_fields=name,parent_descriptor,child_descriptor');
  
  if (relTypes) {
    // Filter out empty ones and sort
    const validTypes = relTypes.filter(rt => rt.name && rt.name.trim());
    console.log(`  Found ${validTypes.length} relationship types:\n`);
    
    validTypes.forEach(rt => {
      console.log(`  • ${rt.name}`);
      if (rt.parent_descriptor || rt.child_descriptor) {
        console.log(`      "${rt.parent_descriptor}" ←→ "${rt.child_descriptor}"`);
      }
    });
  }

  // 2. Explore Jeppesen Aviation Product table
  console.log('\n📋 AVIATION PRODUCTS (x_jepp2_aviation_s_aviation_product)\n');
  const aviationProducts = await query(
    'x_jepp2_aviation_s_aviation_product',
    'sysparm_limit=20&sysparm_fields=sys_id,name,number,short_description,active'
  );
  
  if (aviationProducts) {
    console.log(`  Found ${aviationProducts.length} products:\n`);
    aviationProducts.forEach(p => {
      console.log(`  • ${p.name || p.number || 'unnamed'}`);
      if (p.short_description) console.log(`      ${p.short_description}`);
    });
  } else {
    console.log('  ❌ No access to this table');
  }

  // 3. Explore Portfolio table
  console.log('\n📋 PORTFOLIOS (pm_portfolio)\n');
  const portfolios = await query(
    'pm_portfolio',
    'sysparm_limit=20&sysparm_fields=sys_id,name,short_description,state'
  );
  
  if (portfolios) {
    console.log(`  Found ${portfolios.length} portfolios:\n`);
    portfolios.forEach(p => {
      console.log(`  • ${p.name || 'unnamed'} (${p.state || 'no state'})`);
    });
  } else {
    console.log('  ❌ No access to this table');
  }

  // 4. Explore Product Family
  console.log('\n📋 PRODUCT FAMILIES (u_product_family)\n');
  const productFamilies = await query(
    'u_product_family',
    'sysparm_limit=20&sysparm_fields=sys_id,name,u_name,short_description'
  );
  
  if (productFamilies) {
    console.log(`  Found ${productFamilies.length} product families:\n`);
    productFamilies.forEach(p => {
      console.log(`  • ${p.name || p.u_name || 'unnamed'}`);
    });
  } else {
    console.log('  ❌ No access to this table');
  }

  // 5. Explore Business Service to Product mapping
  console.log('\n📋 BUSINESS SERVICE TO PRODUCT MAPPING (u_m2m_business_ser_products)\n');
  const bsProducts = await query(
    'u_m2m_business_ser_products',
    'sysparm_limit=10'
  );
  
  if (bsProducts) {
    console.log(`  Found ${bsProducts.length} mappings. Sample fields:`);
    if (bsProducts[0]) {
      console.log(`  Fields available: ${Object.keys(bsProducts[0]).join(', ')}`);
    }
  } else {
    console.log('  ❌ No access to this table');
  }

  // 6. Explore Server to Business Service mapping
  console.log('\n📋 SERVER TO BUSINESS SERVICE MAPPING (u_cmdb_ci_server_to_bs_m2m_2)\n');
  const serverBS = await query(
    'u_cmdb_ci_server_to_bs_m2m_2',
    'sysparm_limit=10'
  );
  
  if (serverBS) {
    console.log(`  Found ${serverBS.length} mappings. Sample fields:`);
    if (serverBS[0]) {
      console.log(`  Fields available: ${Object.keys(serverBS[0]).join(', ')}`);
    }
  } else {
    console.log('  ❌ No access to this table');
  }

  // 7. Check Business Services structure
  console.log('\n📋 BUSINESS SERVICES DETAIL (cmdb_ci_service)\n');
  const services = await query(
    'cmdb_ci_service',
    'sysparm_limit=10&sysparm_fields=sys_id,name,short_description,owned_by,support_group,operational_status'
  );
  
  if (services) {
    console.log(`  Found ${services.length} services:\n`);
    services.forEach(s => {
      console.log(`  • ${s.name || 'unnamed'}`);
      if (s.short_description) console.log(`      ${s.short_description}`);
    });
  }

  // 8. Sample relationship to understand structure
  console.log('\n📋 SAMPLE RELATIONSHIPS (cmdb_rel_ci)\n');
  const rels = await query(
    'cmdb_rel_ci',
    'sysparm_limit=10&sysparm_fields=sys_id,parent,child,type'
  );
  
  if (rels) {
    console.log('  Sample relationship structure:');
    if (rels[0]) {
      console.log(`  ${JSON.stringify(rels[0], null, 2)}`);
    }
  }

  // 9. Get schema for a server to see all available fields
  console.log('\n📋 SERVER FIELDS (cmdb_ci_server schema)\n');
  const serverSchema = await query(
    'sys_dictionary',
    'sysparm_query=name=cmdb_ci_server&sysparm_fields=element,column_label&sysparm_limit=50'
  );
  
  if (serverSchema) {
    console.log('  Available fields on cmdb_ci_server:');
    const interestingFields = serverSchema.filter(f => 
      f.element && (
        f.element.includes('ip') ||
        f.element.includes('location') ||
        f.element.includes('environment') ||
        f.element.includes('dr') ||
        f.element.includes('tier') ||
        f.element.includes('owner') ||
        f.element.includes('support') ||
        f.element.includes('business')
      )
    );
    interestingFields.forEach(f => {
      console.log(`    • ${f.element} (${f.column_label})`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done! Review the output to understand the data model.');
}

discoverPart2().catch(console.error);
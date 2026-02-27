// discovery-part3.js
// Run with: node discovery-part3.js

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
      path: encodeURI(url),
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

async function discoverPart3() {
  console.log('🔍 ServiceNow CMDB Discovery - Part 3');
  console.log('='.repeat(70));

  // 1. Get Aviation Product table structure (find actual field names)
  console.log('\n📋 AVIATION PRODUCT TABLE STRUCTURE\n');
  const productSchema = await query(
    'sys_dictionary',
    'sysparm_query=name=x_jepp2_aviation_s_aviation_product^elementISNOTEMPTY&sysparm_fields=element,column_label,internal_type&sysparm_limit=50'
  );
  
  if (productSchema && productSchema.length > 0) {
    console.log('  Fields on x_jepp2_aviation_s_aviation_product:');
    productSchema.forEach(f => {
      console.log(`    • ${f.element.padEnd(30)} (${f.column_label})`);
    });
    
    // Now query with discovered fields
    const fieldList = productSchema.map(f => f.element).join(',');
    console.log('\n  Querying with all fields...\n');
    
    const products = await query(
      'x_jepp2_aviation_s_aviation_product',
      `sysparm_limit=10&sysparm_fields=${fieldList}`
    );
    
    if (products && products.length > 0) {
      console.log('  Sample Aviation Product:');
      console.log(JSON.stringify(products[0], null, 2));
    }
  } else {
    console.log('  Could not get schema, trying raw query...');
    const rawProducts = await query(
      'x_jepp2_aviation_s_aviation_product',
      'sysparm_limit=1'
    );
    if (rawProducts && rawProducts.length > 0) {
      console.log('  Fields found:', Object.keys(rawProducts[0]).join(', '));
      console.log('\n  Sample record:');
      console.log(JSON.stringify(rawProducts[0], null, 2));
    }
  }

  // 2. Get relationship types that actually have names
  console.log('\n📋 RELATIONSHIP TYPES (non-empty only)\n');
  const relTypes = await query(
    'cmdb_rel_type',
    'sysparm_query=nameISNOTEMPTY^nameLIKErun^ORnameLIKEdepend^ORnameLIKEhost^ORnameLIKEcontain^ORnameLIKEuses^ORnameLIKEmember&sysparm_fields=sys_id,name,parent_descriptor,child_descriptor&sysparm_limit=50'
  );
  
  if (relTypes && relTypes.length > 0) {
    console.log(`  Found ${relTypes.length} relevant relationship types:\n`);
    relTypes.forEach(rt => {
      console.log(`  • ${rt.name} (sys_id: ${rt.sys_id})`);
      console.log(`      Parent: "${rt.parent_descriptor}" → Child: "${rt.child_descriptor}"`);
    });
  }

  // Also get all non-empty ones
  console.log('\n  All non-empty relationship types:');
  const allRelTypes = await query(
    'cmdb_rel_type',
    'sysparm_query=nameISNOTEMPTY^nameNOT LIKE::&sysparm_fields=sys_id,name&sysparm_limit=100'
  );
  
  if (allRelTypes) {
    allRelTypes.forEach(rt => {
      if (rt.name && !rt.name.startsWith('::')) {
        console.log(`    • ${rt.name}`);
      }
    });
  }

  // 3. Get server fields properly
  console.log('\n📋 SERVER TABLE FIELDS\n');
  const serverFields = await query(
    'sys_dictionary',
    'sysparm_query=name=cmdb_ci_server^elementISNOTEMPTY^internal_type!=collection&sysparm_fields=element,column_label&sysparm_limit=100'
  );
  
  if (serverFields && serverFields.length > 0) {
    // Look for interesting fields
    const keywords = ['ip', 'location', 'environment', 'env', 'dr', 'tier', 
                      'owner', 'support', 'business', 'product', 'portfolio',
                      'status', 'classification', 'criticality'];
    
    console.log('  Interesting fields on cmdb_ci_server:');
    serverFields.forEach(f => {
      const lower = (f.element + f.column_label).toLowerCase();
      if (keywords.some(kw => lower.includes(kw))) {
        console.log(`    • ${f.element.padEnd(35)} (${f.column_label})`);
      }
    });

    console.log('\n  All fields:');
    serverFields.forEach(f => {
      console.log(`    • ${f.element}`);
    });
  }

  // 4. Get a sample server with ALL fields to see what's populated
  console.log('\n📋 SAMPLE SERVER (ALL FIELDS)\n');
  const sampleServer = await query(
    'cmdb_ci_server',
    'sysparm_query=ip_addressISNOTEMPTY&sysparm_limit=1'
  );
  
  if (sampleServer && sampleServer.length > 0) {
    const server = sampleServer[0];
    console.log('  Sample server with IP:');
    
    // Show non-empty fields
    const populated = Object.entries(server).filter(([k, v]) => {
      if (!v) return false;
      if (typeof v === 'object' && Object.keys(v).length === 0) return false;
      if (v === '') return false;
      return true;
    });
    
    populated.forEach(([key, value]) => {
      const display = typeof value === 'object' ? JSON.stringify(value) : value;
      console.log(`    ${key.padEnd(35)}: ${display.toString().substring(0, 50)}`);
    });
  }

  // 5. Find relationships FOR a specific server
  console.log('\n📋 TRACING A SERVER\'s RELATIONSHIPS\n');
  const servers = await query(
    'cmdb_ci_server',
    'sysparm_query=ip_addressISNOTEMPTY^operational_status=1&sysparm_fields=sys_id,name,ip_address&sysparm_limit=5'
  );
  
  if (servers && servers.length > 0) {
    const testServer = servers[0];
    console.log(`  Testing server: ${testServer.name} (${testServer.ip_address})`);
    console.log(`  sys_id: ${testServer.sys_id}\n`);
    
    // Find all relationships where this server is parent or child
    const serverRels = await query(
      'cmdb_rel_ci',
      `sysparm_query=parent=${testServer.sys_id}^ORchild=${testServer.sys_id}&sysparm_limit=20`
    );
    
    if (serverRels && serverRels.length > 0) {
      console.log(`  Found ${serverRels.length} relationships:\n`);
      
      for (const rel of serverRels) {
        // Get the relationship type name
        const relTypeId = rel.type?.value;
        let relTypeName = 'unknown';
        
        if (relTypeId) {
          const relType = await query(
            'cmdb_rel_type',
            `sysparm_query=sys_id=${relTypeId}&sysparm_fields=name`
          );
          if (relType && relType[0]) {
            relTypeName = relType[0].name || 'unnamed';
          }
        }
        
        // Get the other CI's name
        const otherId = rel.parent?.value === testServer.sys_id 
          ? rel.child?.value 
          : rel.parent?.value;
        
        const direction = rel.parent?.value === testServer.sys_id ? '→' : '←';
        
        if (otherId) {
          const otherCI = await query(
            'cmdb_ci',
            `sysparm_query=sys_id=${otherId}&sysparm_fields=name,sys_class_name`
          );
          
          if (otherCI && otherCI[0]) {
            console.log(`    ${direction} [${relTypeName}] ${otherCI[0].name} (${otherCI[0].sys_class_name})`);
          }
        }
      }
    } else {
      console.log('  No relationships found for this server');
    }
  }

  // 6. Find relationships between services and servers
  console.log('\n📋 SERVICE TO SERVER RELATIONSHIPS\n');
  
  // Get a business service
  const services = await query(
    'cmdb_ci_service',
    'sysparm_query=operational_status=1&sysparm_fields=sys_id,name&sysparm_limit=3'
  );
  
  if (services && services.length > 0) {
    for (const service of services) {
      console.log(`  Service: ${service.name}`);
      
      const serviceRels = await query(
        'cmdb_rel_ci',
        `sysparm_query=parent=${service.sys_id}^ORchild=${service.sys_id}&sysparm_limit=10`
      );
      
      if (serviceRels && serviceRels.length > 0) {
        for (const rel of serviceRels.slice(0, 5)) {
          const otherId = rel.parent?.value === service.sys_id 
            ? rel.child?.value 
            : rel.parent?.value;
          
          const direction = rel.parent?.value === service.sys_id ? '→' : '←';
          
          if (otherId) {
            const otherCI = await query(
              'cmdb_ci',
              `sysparm_query=sys_id=${otherId}&sysparm_fields=name,sys_class_name,ip_address`
            );
            
            if (otherCI && otherCI[0]) {
              const ip = otherCI[0].ip_address ? ` (${otherCI[0].ip_address})` : '';
              console.log(`      ${direction} ${otherCI[0].name}${ip} [${otherCI[0].sys_class_name}]`);
            }
          }
        }
      } else {
        console.log('      No relationships found');
      }
      console.log('');
    }
  }

  // 7. Check if services have a product/portfolio reference field
  console.log('\n📋 SERVICE TABLE FIELDS (looking for product/portfolio)\n');
  const serviceFields = await query(
    'sys_dictionary',
    'sysparm_query=name=cmdb_ci_service^elementISNOTEMPTY&sysparm_fields=element,column_label,reference&sysparm_limit=100'
  );
  
  if (serviceFields) {
    const interesting = serviceFields.filter(f => {
      const lower = (f.element + f.column_label).toLowerCase();
      return lower.includes('product') || lower.includes('portfolio') || 
             lower.includes('business') || lower.includes('owner') ||
             lower.includes('application');
    });
    
    if (interesting.length > 0) {
      console.log('  Product/Portfolio related fields on cmdb_ci_service:');
      interesting.forEach(f => {
        console.log(`    • ${f.element.padEnd(35)} (${f.column_label})`);
        if (f.reference) console.log(`        References: ${f.reference}`);
      });
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Done!');
}

discoverPart3().catch(console.error);
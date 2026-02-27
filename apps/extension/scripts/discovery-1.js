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
            const json = JSON.parse(data);
            resolve(json.result);
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          resolve(null); // Table not accessible
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function discover() {
  console.log('🔍 ServiceNow CMDB Discovery');
  console.log(`Instance: ${INSTANCE}`);
  console.log('='.repeat(60));

  // Test each table
  const tables = [
    { name: 'cmdb_ci', desc: 'Base CI table', fields: 'sys_id,name,sys_class_name' },
    { name: 'cmdb_rel_ci', desc: 'Relationships (CRITICAL)', fields: 'sys_id,parent,child,type' },
    { name: 'cmdb_rel_type', desc: 'Relationship types', fields: 'name,parent_descriptor,child_descriptor' },
    { name: 'cmdb_ci_server', desc: 'Servers', fields: 'sys_id,name,ip_address,os' },
    { name: 'cmdb_ci_vm_instance', desc: 'Virtual Machines', fields: 'sys_id,name,ip_address' },
    { name: 'cmdb_ci_appl', desc: 'Applications', fields: 'sys_id,name,version' },
    { name: 'cmdb_ci_service', desc: 'Business Services', fields: 'sys_id,name' },
    { name: 'cmdb_ci_db_instance', desc: 'Databases', fields: 'sys_id,name,type' },
    { name: 'alm_asset', desc: 'Assets', fields: 'sys_id,display_name,asset_tag' },
  ];

  console.log('\n📋 TABLE ACCESS CHECK\n');

  const results = {};

  for (const table of tables) {
    process.stdout.write(`  ${table.name.padEnd(25)}`);
    
    try {
      const data = await query(table.name, `sysparm_limit=5&sysparm_fields=${table.fields}`);
      
      if (data) {
        console.log(`✅ ${data.length} records`);
        results[table.name] = data;
      } else {
        console.log('❌ No access');
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
  }

  // Check for custom/product tables
  console.log('\n📋 LOOKING FOR PRODUCT/PORTFOLIO TABLES\n');

  const customTableQuery = await query(
    'sys_db_object',
    'sysparm_query=nameLIKEproduct^ORnameLIKEportfolio^ORnameSTARTSWITHu_cmdb^ORnameSTARTSWITHu_app&sysparm_fields=name,label&sysparm_limit=50'
  );

  if (customTableQuery && customTableQuery.length > 0) {
    console.log('  Found these potentially relevant tables:');
    customTableQuery.forEach(t => {
      console.log(`    • ${t.name} (${t.label})`);
    });
  } else {
    console.log('  No custom product/portfolio tables found (or no access to sys_db_object)');
  }

  // Show relationship types
  console.log('\n📋 RELATIONSHIP TYPES\n');

  if (results['cmdb_rel_type']) {
    results['cmdb_rel_type'].forEach(rt => {
      console.log(`  • ${rt.name}`);
      console.log(`      Parent: "${rt.parent_descriptor}" → Child: "${rt.child_descriptor}"`);
    });
  } else {
    console.log('  Could not retrieve relationship types');
  }

  // Show sample data
  console.log('\n📋 SAMPLE DATA\n');

  if (results['cmdb_ci_server'] && results['cmdb_ci_server'].length > 0) {
    console.log('  Servers:');
    results['cmdb_ci_server'].forEach(s => {
      console.log(`    • ${s.name || 'unnamed'} - IP: ${s.ip_address || 'none'} - OS: ${s.os || 'unknown'}`);
    });
  }

  if (results['cmdb_ci_appl'] && results['cmdb_ci_appl'].length > 0) {
    console.log('\n  Applications:');
    results['cmdb_ci_appl'].forEach(a => {
      console.log(`    • ${a.name || 'unnamed'}`);
    });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY\n');
  
  const hasRelationships = !!results['cmdb_rel_ci'];
  const hasServers = !!results['cmdb_ci_server'] || !!results['cmdb_ci_vm_instance'];
  const hasApps = !!results['cmdb_ci_appl'];

  console.log(`  Relationships (cmdb_rel_ci):  ${hasRelationships ? '✅ Have access' : '❌ NEED ACCESS - Critical!'}`);
  console.log(`  Servers/VMs:                  ${hasServers ? '✅ Have access' : '❌ Need access'}`);
  console.log(`  Applications:                 ${hasApps ? '✅ Have access' : '❌ Need access'}`);

  if (!hasRelationships) {
    console.log('\n  ⚠️  You need to request access to cmdb_rel_ci to map dependencies!');
  }

  console.log('\n  Done! Review the output above to understand your CMDB structure.');
}

discover().catch(err => {
  console.error('Error:', err.message);
});
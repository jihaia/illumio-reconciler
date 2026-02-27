import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { ComponentNodeData } from '../../types';

type ComponentNodeType = Node<ComponentNodeData, 'component'>;

const CLASS_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  // App servers
  cmdb_ci_app_server_tomcat:          { label: 'Tomcat',      color: '#dc2626' },
  cmdb_ci_app_server_weblogic:        { label: 'WebLogic',    color: '#7c3aed' },
  cmdb_ci_app_server_jboss:           { label: 'JBoss',       color: '#059669' },
  cmdb_ci_app_server:                 { label: 'App Server',  color: '#8b5cf6' },
  // Web servers
  cmdb_ci_apache_web_server:          { label: 'Apache',      color: '#d97706' },
  cmdb_ci_microsoft_iis_web_server:   { label: 'IIS',         color: '#2563eb' },
  cmdb_ci_nginx_web_server:           { label: 'NGINX',       color: '#16a34a' },
  cmdb_ci_web_server:                 { label: 'Web Server',  color: '#6366f1' },
  // Databases
  cmdb_ci_db_mssql_instance:          { label: 'MSSQL',       color: '#dc2626' },
  cmdb_ci_db_ora_instance:            { label: 'Oracle DB',   color: '#ea580c' },
  cmdb_ci_db_ora_listener:            { label: 'Oracle Listener', color: '#c2410c' },
  cmdb_ci_db_postgresql_instance:     { label: 'PostgreSQL',  color: '#0284c7' },
  cmdb_ci_db_mysql_instance:          { label: 'MySQL',       color: '#0d9488' },
  cmdb_ci_db_mongodb_instance:        { label: 'MongoDB',     color: '#15803d' },
  cmdb_ci_db_syb_instance:            { label: 'Sybase',      color: '#9333ea' },
  cmdb_ci_db_instance:                { label: 'Database',    color: '#b91c1c' },
  // Containers & runtime
  cmdb_ci_docker_engine:              { label: 'Docker',      color: '#0ea5e9' },
  // Load balancers
  cmdb_ci_lb_service:                 { label: 'Load Balancer', color: '#f59e0b' },
  // Applications
  cmdb_ci_appl:                       { label: 'Application', color: '#6d28d9' },
  cmdb_ci_appl_license_server:        { label: 'License Server', color: '#78716c' },
};

function getComponentInfo(className: string): { label: string; color: string } {
  // Check exact match first, then prefix match
  if (CLASS_TYPE_LABELS[className]) return CLASS_TYPE_LABELS[className];
  for (const [prefix, info] of Object.entries(CLASS_TYPE_LABELS)) {
    if (className.startsWith(prefix)) return info;
  }
  return { label: className.replace(/^cmdb_ci_/, '').replace(/_/g, ' '), color: '#6b7280' };
}

export function ComponentNode({ data, selected }: NodeProps<ComponentNodeType>) {
  const info = getComponentInfo(data.className);

  return (
    <div
      className={`rounded-xl bg-white shadow-sm border transition-shadow min-w-[160px] max-w-[200px] ${
        selected ? 'shadow-lg' : ''
      }`}
      style={{ borderColor: selected ? info.color : '#e5e7eb' }}
    >
      {/* Type header */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl border-b"
        style={{
          backgroundColor: `${info.color}10`,
          borderBottomColor: `${info.color}25`,
        }}
      >
        <svg
          className="w-3 h-3 flex-shrink-0"
          style={{ color: info.color }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: info.color }}
        >
          {info.label}
        </span>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        <div className="text-xs font-medium text-gray-900 truncate max-w-[170px]" title={data.name}>
          {data.label}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5 truncate" title={data.serverName}>
          on {data.serverName}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!bg-gray-300 !border-gray-400 !w-2.5 !h-2.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-300 !border-gray-400 !w-2.5 !h-2.5"
      />
    </div>
  );
}

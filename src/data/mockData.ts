import { Service, ApplicationStack, Team, Contact } from '../types';

// Teams
const platformTeam: Team = {
  id: 'team-platform',
  name: 'Platform Engineering',
  slackChannel: '#platform-team',
  emailGroup: 'platform@company.com',
  oncallRotation: 'platform-oncall',
  contacts: [
    { id: 'c1', name: 'Alice Chen', email: 'alice.chen@company.com', phone: '+1-555-0101', role: 'primary', team: 'Platform Engineering' },
    { id: 'c2', name: 'Bob Martinez', email: 'bob.martinez@company.com', phone: '+1-555-0102', role: 'secondary', team: 'Platform Engineering' },
    { id: 'c3', name: 'Carol Williams', email: 'carol.williams@company.com', phone: '+1-555-0103', role: 'escalation', team: 'Platform Engineering' },
  ]
};

const apiTeam: Team = {
  id: 'team-api',
  name: 'API Services',
  slackChannel: '#api-team',
  emailGroup: 'api-team@company.com',
  oncallRotation: 'api-oncall',
  contacts: [
    { id: 'c4', name: 'David Lee', email: 'david.lee@company.com', phone: '+1-555-0201', role: 'primary', team: 'API Services' },
    { id: 'c5', name: 'Eva Johnson', email: 'eva.johnson@company.com', phone: '+1-555-0202', role: 'secondary', team: 'API Services' },
  ]
};

const dataTeam: Team = {
  id: 'team-data',
  name: 'Data Engineering',
  slackChannel: '#data-team',
  emailGroup: 'data@company.com',
  oncallRotation: 'data-oncall',
  contacts: [
    { id: 'c6', name: 'Frank Garcia', email: 'frank.garcia@company.com', phone: '+1-555-0301', role: 'primary', team: 'Data Engineering' },
    { id: 'c7', name: 'Grace Kim', email: 'grace.kim@company.com', phone: '+1-555-0302', role: 'secondary', team: 'Data Engineering' },
  ]
};

const frontendTeam: Team = {
  id: 'team-frontend',
  name: 'Frontend Engineering',
  slackChannel: '#frontend-team',
  emailGroup: 'frontend@company.com',
  oncallRotation: 'frontend-oncall',
  contacts: [
    { id: 'c8', name: 'Henry Brown', email: 'henry.brown@company.com', phone: '+1-555-0401', role: 'primary', team: 'Frontend Engineering' },
    { id: 'c9', name: 'Iris Davis', email: 'iris.davis@company.com', phone: '+1-555-0402', role: 'secondary', team: 'Frontend Engineering' },
  ]
};

// Services
export const mockServices: Service[] = [
  {
    id: 'svc-user-api',
    name: 'user-api',
    displayName: 'User API Service',
    description: 'Core user management API handling authentication, authorization, and user profile operations.',
    type: 'api',
    tier: 'tier-1',
    status: 'healthy',
    ownerTeam: apiTeam,
    repository: 'https://github.com/company/user-api',
    documentationUrl: 'https://docs.company.com/user-api',
    architecture: 'Microservice with REST API',
    techStack: ['Node.js', 'Express', 'PostgreSQL', 'Redis'],
    language: 'TypeScript',
    framework: 'Express.js',
    servers: [
      { id: 's1', hostname: 'user-api-prod-1', ipAddress: '10.0.1.10', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '4 vCPU', memory: '8GB', storage: '100GB SSD' } },
      { id: 's2', hostname: 'user-api-prod-2', ipAddress: '10.0.1.11', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '4 vCPU', memory: '8GB', storage: '100GB SSD' } },
      { id: 's3', hostname: 'user-api-prod-3', ipAddress: '10.0.2.10', environment: 'production', datacenter: 'us-west-2', specs: { cpu: '4 vCPU', memory: '8GB', storage: '100GB SSD' } },
    ],
    endpoints: [
      { id: 'e1', url: 'https://api.company.com/v1/users', method: 'GET', description: 'List all users', healthCheckPath: '/health', expectedResponseTime: 100 },
      { id: 'e2', url: 'https://api.company.com/v1/users/:id', method: 'GET', description: 'Get user by ID', expectedResponseTime: 50 },
      { id: 'e3', url: 'https://api.company.com/v1/auth/login', method: 'POST', description: 'User authentication', expectedResponseTime: 200 },
    ],
    upstreamDependencies: [
      { serviceId: 'svc-postgres', serviceName: 'PostgreSQL Database', type: 'hard', description: 'Primary data store', dataFlow: 'bidirectional' },
      { serviceId: 'svc-redis', serviceName: 'Redis Cache', type: 'soft', description: 'Session and cache storage', dataFlow: 'bidirectional' },
    ],
    downstreamDependencies: [
      { serviceId: 'svc-web-app', serviceName: 'Web Application', type: 'hard', description: 'Frontend application', dataFlow: 'inbound' },
      { serviceId: 'svc-mobile-api', serviceName: 'Mobile API Gateway', type: 'hard', description: 'Mobile app backend', dataFlow: 'inbound' },
      { serviceId: 'svc-order-api', serviceName: 'Order API', type: 'soft', description: 'Order processing', dataFlow: 'inbound' },
    ],
    runbooks: [
      {
        id: 'rb1',
        title: 'User API Service Recovery',
        description: 'Steps to recover the User API service when it becomes unresponsive',
        triggerConditions: ['Service returns 5xx errors', 'Health check failures > 3', 'Response time > 5s'],
        steps: [
          { order: 1, title: 'Check Service Status', description: 'Verify the current state of all instances', commands: ['kubectl get pods -n user-api', 'kubectl describe pods -n user-api'], expectedOutcome: 'Identify which pods are failing' },
          { order: 2, title: 'Check Dependencies', description: 'Verify PostgreSQL and Redis connectivity', commands: ['pg_isready -h postgres.internal', 'redis-cli -h redis.internal ping'], expectedOutcome: 'Dependencies should be accessible' },
          { order: 3, title: 'Restart Unhealthy Pods', description: 'Rolling restart of failing pods', commands: ['kubectl rollout restart deployment/user-api -n user-api'], expectedOutcome: 'New pods should come up healthy', rollbackSteps: ['kubectl rollout undo deployment/user-api -n user-api'] },
          { order: 4, title: 'Scale Up if Needed', description: 'Increase replicas if load is high', commands: ['kubectl scale deployment/user-api --replicas=5 -n user-api'], expectedOutcome: 'Additional capacity available' },
        ],
        estimatedDuration: '15-30 minutes',
        lastUpdated: '2024-01-15',
        author: 'David Lee'
      }
    ],
    healthChecks: [
      { id: 'hc1', name: 'API Health', endpoint: 'https://api.company.com/v1/health', interval: 30, timeout: 5, expectedStatus: 200, lastChecked: '2024-01-20T10:30:00Z', lastStatus: 'healthy' },
      { id: 'hc2', name: 'Database Connection', endpoint: 'https://api.company.com/v1/health/db', interval: 60, timeout: 10, expectedStatus: 200, lastChecked: '2024-01-20T10:30:00Z', lastStatus: 'healthy' },
    ],
    alerts: [
      { id: 'a1', name: 'High Error Rate', condition: 'error_rate > 1%', severity: 'critical', notificationChannels: ['pagerduty', 'slack'], escalationPolicy: 'api-critical' },
      { id: 'a2', name: 'High Latency', condition: 'p99_latency > 500ms', severity: 'warning', notificationChannels: ['slack'], escalationPolicy: 'api-warning' },
    ],
    metrics: [
      { id: 'm1', name: 'Request Rate', description: 'Requests per second', unit: 'req/s', dashboardUrl: 'https://grafana.company.com/d/user-api' },
      { id: 'm2', name: 'Error Rate', description: 'Percentage of 5xx responses', unit: '%', dashboardUrl: 'https://grafana.company.com/d/user-api' },
      { id: 'm3', name: 'Response Time', description: 'P50/P95/P99 latency', unit: 'ms', dashboardUrl: 'https://grafana.company.com/d/user-api' },
    ],
    sla: {
      id: 'sla1',
      name: 'User API SLA',
      targetUptime: 99.95,
      responseTimeP50: 50,
      responseTimeP95: 150,
      responseTimeP99: 300,
      errorRateThreshold: 0.1,
      currentUptime: 99.98,
      currentResponseTime: 45
    },
    configItems: [
      { key: 'DATABASE_URL', description: 'PostgreSQL connection string', location: 'Kubernetes Secret: user-api-secrets', isSecret: true, lastRotated: '2024-01-01' },
      { key: 'REDIS_URL', description: 'Redis connection string', location: 'Kubernetes ConfigMap: user-api-config', isSecret: false },
      { key: 'JWT_SECRET', description: 'JWT signing key', location: 'Kubernetes Secret: user-api-secrets', isSecret: true, lastRotated: '2024-01-01' },
    ],
    tags: ['core', 'authentication', 'user-management', 'tier-1'],
    createdAt: '2022-01-15T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z',
    version: '3.2.1'
  },
  {
    id: 'svc-postgres',
    name: 'postgres-primary',
    displayName: 'PostgreSQL Database',
    description: 'Primary PostgreSQL database cluster for core application data storage.',
    type: 'database',
    tier: 'tier-1',
    status: 'healthy',
    ownerTeam: dataTeam,
    repository: 'https://github.com/company/infra-postgres',
    documentationUrl: 'https://docs.company.com/postgres',
    architecture: 'Primary-Replica with automated failover',
    techStack: ['PostgreSQL 15', 'Patroni', 'PgBouncer', 'WAL-G'],
    language: 'SQL',
    servers: [
      { id: 's4', hostname: 'postgres-primary-1', ipAddress: '10.0.10.10', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '16 vCPU', memory: '64GB', storage: '2TB NVMe' } },
      { id: 's5', hostname: 'postgres-replica-1', ipAddress: '10.0.10.11', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '16 vCPU', memory: '64GB', storage: '2TB NVMe' } },
      { id: 's6', hostname: 'postgres-replica-2', ipAddress: '10.0.11.10', environment: 'production', datacenter: 'us-west-2', specs: { cpu: '16 vCPU', memory: '64GB', storage: '2TB NVMe' } },
    ],
    endpoints: [
      { id: 'e4', url: 'postgres://postgres-primary.internal:5432', method: 'GET', description: 'Primary database endpoint', healthCheckPath: '/health' },
      { id: 'e5', url: 'postgres://postgres-replica.internal:5432', method: 'GET', description: 'Read replica endpoint' },
    ],
    upstreamDependencies: [],
    downstreamDependencies: [
      { serviceId: 'svc-user-api', serviceName: 'User API Service', type: 'hard', description: 'User data storage', dataFlow: 'outbound' },
      { serviceId: 'svc-order-api', serviceName: 'Order API', type: 'hard', description: 'Order data storage', dataFlow: 'outbound' },
      { serviceId: 'svc-inventory-api', serviceName: 'Inventory API', type: 'hard', description: 'Inventory data storage', dataFlow: 'outbound' },
    ],
    runbooks: [
      {
        id: 'rb2',
        title: 'PostgreSQL Failover Procedure',
        description: 'Manual failover procedure when automatic failover fails',
        triggerConditions: ['Primary node unresponsive', 'Replication lag > 30s', 'Disk space critical'],
        steps: [
          { order: 1, title: 'Assess Situation', description: 'Determine the cause of the issue', commands: ['patronictl list', 'pg_isready -h postgres-primary.internal'], expectedOutcome: 'Identify which node is having issues' },
          { order: 2, title: 'Initiate Failover', description: 'Promote replica to primary', commands: ['patronictl failover --master postgres-primary-1 --candidate postgres-replica-1'], expectedOutcome: 'New primary elected', rollbackSteps: ['patronictl reinit postgres-primary-1'] },
          { order: 3, title: 'Update DNS', description: 'Ensure DNS points to new primary', commands: ['kubectl patch service postgres-primary -p \'{"spec":{"selector":{"role":"master"}}}\''], expectedOutcome: 'Traffic routed to new primary' },
        ],
        estimatedDuration: '10-20 minutes',
        lastUpdated: '2024-01-10',
        author: 'Frank Garcia'
      }
    ],
    healthChecks: [
      { id: 'hc3', name: 'Database Health', endpoint: 'postgres://postgres-primary.internal:5432', interval: 10, timeout: 5, expectedStatus: 200, lastChecked: '2024-01-20T10:30:00Z', lastStatus: 'healthy' },
      { id: 'hc4', name: 'Replication Lag', endpoint: 'postgres://postgres-replica.internal:5432', interval: 30, timeout: 10, expectedStatus: 200, lastChecked: '2024-01-20T10:30:00Z', lastStatus: 'healthy' },
    ],
    alerts: [
      { id: 'a3', name: 'Database Down', condition: 'pg_isready fails', severity: 'critical', notificationChannels: ['pagerduty', 'slack', 'email'], escalationPolicy: 'database-critical' },
      { id: 'a4', name: 'High Replication Lag', condition: 'replication_lag > 10s', severity: 'warning', notificationChannels: ['slack'], escalationPolicy: 'database-warning' },
      { id: 'a5', name: 'Disk Space Critical', condition: 'disk_usage > 85%', severity: 'critical', notificationChannels: ['pagerduty', 'slack'], escalationPolicy: 'database-critical' },
    ],
    metrics: [
      { id: 'm4', name: 'Connections', description: 'Active database connections', unit: 'count', dashboardUrl: 'https://grafana.company.com/d/postgres' },
      { id: 'm5', name: 'Query Performance', description: 'Query execution time', unit: 'ms', dashboardUrl: 'https://grafana.company.com/d/postgres' },
      { id: 'm6', name: 'Replication Lag', description: 'Time behind primary', unit: 's', dashboardUrl: 'https://grafana.company.com/d/postgres' },
    ],
    sla: {
      id: 'sla2',
      name: 'PostgreSQL SLA',
      targetUptime: 99.99,
      currentUptime: 99.995
    },
    configItems: [
      { key: 'POSTGRES_PASSWORD', description: 'PostgreSQL superuser password', location: 'Kubernetes Secret: postgres-secrets', isSecret: true, lastRotated: '2024-01-01' },
      { key: 'max_connections', description: 'Maximum concurrent connections', location: 'postgresql.conf', isSecret: false },
      { key: 'shared_buffers', description: 'Shared memory buffers', location: 'postgresql.conf', isSecret: false },
    ],
    tags: ['database', 'core', 'tier-1', 'postgresql'],
    createdAt: '2021-06-01T00:00:00Z',
    updatedAt: '2024-01-18T00:00:00Z',
    version: '15.4'
  },
  {
    id: 'svc-redis',
    name: 'redis-cluster',
    displayName: 'Redis Cache',
    description: 'Distributed Redis cluster for caching, session storage, and real-time features.',
    type: 'cache',
    tier: 'tier-2',
    status: 'healthy',
    ownerTeam: dataTeam,
    repository: 'https://github.com/company/infra-redis',
    documentationUrl: 'https://docs.company.com/redis',
    architecture: 'Redis Cluster with 6 nodes (3 masters, 3 replicas)',
    techStack: ['Redis 7', 'Redis Sentinel'],
    servers: [
      { id: 's7', hostname: 'redis-master-1', ipAddress: '10.0.20.10', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '4 vCPU', memory: '32GB', storage: '100GB SSD' } },
      { id: 's8', hostname: 'redis-master-2', ipAddress: '10.0.20.11', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '4 vCPU', memory: '32GB', storage: '100GB SSD' } },
      { id: 's9', hostname: 'redis-master-3', ipAddress: '10.0.21.10', environment: 'production', datacenter: 'us-west-2', specs: { cpu: '4 vCPU', memory: '32GB', storage: '100GB SSD' } },
    ],
    endpoints: [
      { id: 'e6', url: 'redis://redis-cluster.internal:6379', method: 'GET', description: 'Redis cluster endpoint', healthCheckPath: '/health' },
    ],
    upstreamDependencies: [],
    downstreamDependencies: [
      { serviceId: 'svc-user-api', serviceName: 'User API Service', type: 'soft', description: 'Session cache', dataFlow: 'outbound' },
      { serviceId: 'svc-web-app', serviceName: 'Web Application', type: 'soft', description: 'Page cache', dataFlow: 'outbound' },
    ],
    runbooks: [
      {
        id: 'rb3',
        title: 'Redis Cluster Recovery',
        description: 'Recovery procedure for Redis cluster issues',
        triggerConditions: ['Node failure', 'Memory exhaustion', 'Cluster split'],
        steps: [
          { order: 1, title: 'Check Cluster Status', description: 'Verify cluster health', commands: ['redis-cli cluster info', 'redis-cli cluster nodes'], expectedOutcome: 'Identify failing nodes' },
          { order: 2, title: 'Fix Node Issues', description: 'Restart or replace failing nodes', commands: ['kubectl delete pod redis-master-1 -n redis'], expectedOutcome: 'Node rejoins cluster' },
        ],
        estimatedDuration: '10-15 minutes',
        lastUpdated: '2024-01-12',
        author: 'Grace Kim'
      }
    ],
    healthChecks: [
      { id: 'hc5', name: 'Redis Ping', endpoint: 'redis://redis-cluster.internal:6379', interval: 10, timeout: 2, expectedStatus: 200, lastChecked: '2024-01-20T10:30:00Z', lastStatus: 'healthy' },
    ],
    alerts: [
      { id: 'a6', name: 'Redis Node Down', condition: 'node_down', severity: 'critical', notificationChannels: ['pagerduty', 'slack'], escalationPolicy: 'cache-critical' },
      { id: 'a7', name: 'High Memory Usage', condition: 'memory_usage > 80%', severity: 'warning', notificationChannels: ['slack'], escalationPolicy: 'cache-warning' },
    ],
    metrics: [
      { id: 'm7', name: 'Hit Rate', description: 'Cache hit percentage', unit: '%', dashboardUrl: 'https://grafana.company.com/d/redis' },
      { id: 'm8', name: 'Memory Usage', description: 'Memory consumption', unit: 'GB', dashboardUrl: 'https://grafana.company.com/d/redis' },
    ],
    sla: {
      id: 'sla3',
      name: 'Redis SLA',
      targetUptime: 99.9,
      currentUptime: 99.95
    },
    configItems: [
      { key: 'REDIS_PASSWORD', description: 'Redis authentication password', location: 'Kubernetes Secret: redis-secrets', isSecret: true, lastRotated: '2024-01-01' },
      { key: 'maxmemory', description: 'Maximum memory limit', location: 'redis.conf', isSecret: false },
    ],
    tags: ['cache', 'redis', 'tier-2', 'session'],
    createdAt: '2022-03-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    version: '7.2.3'
  },
  {
    id: 'svc-web-app',
    name: 'web-application',
    displayName: 'Web Application',
    description: 'Main customer-facing web application with React frontend and Next.js server.',
    type: 'web',
    tier: 'tier-1',
    status: 'healthy',
    ownerTeam: frontendTeam,
    repository: 'https://github.com/company/web-app',
    documentationUrl: 'https://docs.company.com/web-app',
    architecture: 'Next.js with SSR, deployed on Vercel Edge',
    techStack: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'],
    language: 'TypeScript',
    framework: 'Next.js',
    servers: [
      { id: 's10', hostname: 'web-edge-us-east', ipAddress: '10.0.30.10', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '2 vCPU', memory: '4GB', storage: '20GB SSD' } },
      { id: 's11', hostname: 'web-edge-us-west', ipAddress: '10.0.31.10', environment: 'production', datacenter: 'us-west-2', specs: { cpu: '2 vCPU', memory: '4GB', storage: '20GB SSD' } },
      { id: 's12', hostname: 'web-edge-eu-west', ipAddress: '10.0.32.10', environment: 'production', datacenter: 'eu-west-1', specs: { cpu: '2 vCPU', memory: '4GB', storage: '20GB SSD' } },
    ],
    endpoints: [
      { id: 'e7', url: 'https://www.company.com', method: 'GET', description: 'Main website', healthCheckPath: '/api/health', expectedResponseTime: 200 },
      { id: 'e8', url: 'https://www.company.com/api', method: 'GET', description: 'API routes', expectedResponseTime: 100 },
    ],
    upstreamDependencies: [
      { serviceId: 'svc-user-api', serviceName: 'User API Service', type: 'hard', description: 'User authentication and data', dataFlow: 'outbound' },
      { serviceId: 'svc-order-api', serviceName: 'Order API', type: 'hard', description: 'Order management', dataFlow: 'outbound' },
      { serviceId: 'svc-redis', serviceName: 'Redis Cache', type: 'soft', description: 'Page caching', dataFlow: 'outbound' },
      { serviceId: 'svc-cdn', serviceName: 'CDN', type: 'soft', description: 'Static assets', dataFlow: 'outbound' },
    ],
    downstreamDependencies: [],
    runbooks: [
      {
        id: 'rb4',
        title: 'Web App Deployment Rollback',
        description: 'Roll back to previous version if issues detected',
        triggerConditions: ['Error rate spike after deploy', 'Performance degradation', 'User complaints'],
        steps: [
          { order: 1, title: 'Identify Issue', description: 'Confirm the issue is related to recent deployment', commands: ['vercel list --prod'], expectedOutcome: 'Identify current and previous deployments' },
          { order: 2, title: 'Rollback', description: 'Roll back to previous version', commands: ['vercel rollback'], expectedOutcome: 'Previous version is now live' },
        ],
        estimatedDuration: '5 minutes',
        lastUpdated: '2024-01-18',
        author: 'Henry Brown'
      }
    ],
    healthChecks: [
      { id: 'hc6', name: 'Website Health', endpoint: 'https://www.company.com/api/health', interval: 30, timeout: 5, expectedStatus: 200, lastChecked: '2024-01-20T10:30:00Z', lastStatus: 'healthy' },
    ],
    alerts: [
      { id: 'a8', name: 'High Error Rate', condition: 'error_rate > 0.5%', severity: 'critical', notificationChannels: ['pagerduty', 'slack'], escalationPolicy: 'frontend-critical' },
      { id: 'a9', name: 'Slow Page Load', condition: 'lcp > 2500ms', severity: 'warning', notificationChannels: ['slack'], escalationPolicy: 'frontend-warning' },
    ],
    metrics: [
      { id: 'm9', name: 'Page Views', description: 'Total page views', unit: 'count', dashboardUrl: 'https://grafana.company.com/d/web-app' },
      { id: 'm10', name: 'Core Web Vitals', description: 'LCP, FID, CLS metrics', unit: 'various', dashboardUrl: 'https://grafana.company.com/d/web-app' },
    ],
    sla: {
      id: 'sla4',
      name: 'Web App SLA',
      targetUptime: 99.9,
      responseTimeP50: 200,
      responseTimeP95: 500,
      currentUptime: 99.92
    },
    configItems: [
      { key: 'API_URL', description: 'Backend API URL', location: 'Environment Variables', isSecret: false },
      { key: 'ANALYTICS_KEY', description: 'Analytics tracking key', location: 'Environment Variables', isSecret: true },
    ],
    tags: ['frontend', 'web', 'tier-1', 'customer-facing'],
    createdAt: '2021-01-01T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z',
    version: '4.5.2'
  },
  {
    id: 'svc-order-api',
    name: 'order-api',
    displayName: 'Order API',
    description: 'Order processing service handling cart, checkout, and order management.',
    type: 'api',
    tier: 'tier-1',
    status: 'degraded',
    ownerTeam: apiTeam,
    repository: 'https://github.com/company/order-api',
    documentationUrl: 'https://docs.company.com/order-api',
    architecture: 'Event-driven microservice with RabbitMQ',
    techStack: ['Java', 'Spring Boot', 'PostgreSQL', 'RabbitMQ'],
    language: 'Java',
    framework: 'Spring Boot',
    servers: [
      { id: 's13', hostname: 'order-api-prod-1', ipAddress: '10.0.40.10', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '8 vCPU', memory: '16GB', storage: '200GB SSD' } },
      { id: 's14', hostname: 'order-api-prod-2', ipAddress: '10.0.40.11', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '8 vCPU', memory: '16GB', storage: '200GB SSD' } },
    ],
    endpoints: [
      { id: 'e9', url: 'https://api.company.com/v1/orders', method: 'GET', description: 'List orders', healthCheckPath: '/actuator/health', expectedResponseTime: 150 },
      { id: 'e10', url: 'https://api.company.com/v1/orders', method: 'POST', description: 'Create order', expectedResponseTime: 300 },
      { id: 'e11', url: 'https://api.company.com/v1/checkout', method: 'POST', description: 'Process checkout', expectedResponseTime: 500 },
    ],
    upstreamDependencies: [
      { serviceId: 'svc-postgres', serviceName: 'PostgreSQL Database', type: 'hard', description: 'Order data storage', dataFlow: 'bidirectional' },
      { serviceId: 'svc-user-api', serviceName: 'User API Service', type: 'soft', description: 'User verification', dataFlow: 'outbound' },
      { serviceId: 'svc-inventory-api', serviceName: 'Inventory API', type: 'hard', description: 'Stock verification', dataFlow: 'outbound' },
      { serviceId: 'svc-payment-gateway', serviceName: 'Payment Gateway', type: 'hard', description: 'Payment processing', dataFlow: 'outbound' },
      { serviceId: 'svc-rabbitmq', serviceName: 'RabbitMQ', type: 'hard', description: 'Event messaging', dataFlow: 'bidirectional' },
    ],
    downstreamDependencies: [
      { serviceId: 'svc-web-app', serviceName: 'Web Application', type: 'hard', description: 'Customer orders', dataFlow: 'inbound' },
      { serviceId: 'svc-mobile-api', serviceName: 'Mobile API Gateway', type: 'hard', description: 'Mobile orders', dataFlow: 'inbound' },
    ],
    runbooks: [
      {
        id: 'rb5',
        title: 'Order Processing Recovery',
        description: 'Recovery steps for order processing failures',
        triggerConditions: ['Checkout failures > 1%', 'Order queue backup', 'Payment timeouts'],
        steps: [
          { order: 1, title: 'Check Order Queue', description: 'Verify RabbitMQ queue status', commands: ['rabbitmqctl list_queues', 'rabbitmqctl list_connections'], expectedOutcome: 'Identify queue backlog' },
          { order: 2, title: 'Check Payment Gateway', description: 'Verify payment service connectivity', commands: ['curl -X GET https://payment-gateway.internal/health'], expectedOutcome: 'Payment gateway responsive' },
          { order: 3, title: 'Restart Order Workers', description: 'Restart order processing workers', commands: ['kubectl rollout restart deployment/order-workers -n order-api'], expectedOutcome: 'Workers processing orders again' },
        ],
        estimatedDuration: '15-30 minutes',
        lastUpdated: '2024-01-14',
        author: 'Eva Johnson'
      }
    ],
    healthChecks: [
      { id: 'hc7', name: 'API Health', endpoint: 'https://api.company.com/v1/orders/actuator/health', interval: 30, timeout: 5, expectedStatus: 200, lastChecked: '2024-01-20T10:30:00Z', lastStatus: 'degraded' },
    ],
    alerts: [
      { id: 'a10', name: 'Checkout Failures', condition: 'checkout_error_rate > 1%', severity: 'critical', notificationChannels: ['pagerduty', 'slack'], escalationPolicy: 'order-critical' },
      { id: 'a11', name: 'Order Queue Backup', condition: 'queue_depth > 1000', severity: 'warning', notificationChannels: ['slack'], escalationPolicy: 'order-warning' },
    ],
    metrics: [
      { id: 'm11', name: 'Orders Per Minute', description: 'Order creation rate', unit: 'orders/min', dashboardUrl: 'https://grafana.company.com/d/order-api' },
      { id: 'm12', name: 'Checkout Success Rate', description: 'Successful checkouts', unit: '%', dashboardUrl: 'https://grafana.company.com/d/order-api' },
    ],
    sla: {
      id: 'sla5',
      name: 'Order API SLA',
      targetUptime: 99.95,
      responseTimeP99: 1000,
      errorRateThreshold: 0.5,
      currentUptime: 99.85,
      currentResponseTime: 450
    },
    configItems: [
      { key: 'DATABASE_URL', description: 'PostgreSQL connection', location: 'Kubernetes Secret: order-api-secrets', isSecret: true },
      { key: 'RABBITMQ_URL', description: 'RabbitMQ connection', location: 'Kubernetes Secret: order-api-secrets', isSecret: true },
      { key: 'PAYMENT_API_KEY', description: 'Payment gateway API key', location: 'Kubernetes Secret: order-api-secrets', isSecret: true, lastRotated: '2024-01-01' },
    ],
    tags: ['orders', 'checkout', 'tier-1', 'revenue-critical'],
    createdAt: '2021-06-15T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z',
    version: '2.8.0'
  },
  {
    id: 'svc-inventory-api',
    name: 'inventory-api',
    displayName: 'Inventory API',
    description: 'Inventory management service for stock levels, warehouses, and product availability.',
    type: 'api',
    tier: 'tier-2',
    status: 'healthy',
    ownerTeam: apiTeam,
    repository: 'https://github.com/company/inventory-api',
    documentationUrl: 'https://docs.company.com/inventory-api',
    architecture: 'Microservice with event sourcing',
    techStack: ['Go', 'PostgreSQL', 'Kafka'],
    language: 'Go',
    servers: [
      { id: 's15', hostname: 'inventory-api-prod-1', ipAddress: '10.0.50.10', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '4 vCPU', memory: '8GB', storage: '100GB SSD' } },
      { id: 's16', hostname: 'inventory-api-prod-2', ipAddress: '10.0.50.11', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '4 vCPU', memory: '8GB', storage: '100GB SSD' } },
    ],
    endpoints: [
      { id: 'e12', url: 'https://api.company.com/v1/inventory', method: 'GET', description: 'Get inventory levels', healthCheckPath: '/health', expectedResponseTime: 50 },
      { id: 'e13', url: 'https://api.company.com/v1/inventory/:sku', method: 'GET', description: 'Get item stock', expectedResponseTime: 30 },
    ],
    upstreamDependencies: [
      { serviceId: 'svc-postgres', serviceName: 'PostgreSQL Database', type: 'hard', description: 'Inventory data', dataFlow: 'bidirectional' },
      { serviceId: 'svc-kafka', serviceName: 'Kafka', type: 'hard', description: 'Event streaming', dataFlow: 'bidirectional' },
    ],
    downstreamDependencies: [
      { serviceId: 'svc-order-api', serviceName: 'Order API', type: 'hard', description: 'Stock verification', dataFlow: 'inbound' },
      { serviceId: 'svc-web-app', serviceName: 'Web Application', type: 'soft', description: 'Availability display', dataFlow: 'inbound' },
    ],
    runbooks: [],
    healthChecks: [
      { id: 'hc8', name: 'Inventory API Health', endpoint: 'https://api.company.com/v1/inventory/health', interval: 30, timeout: 5, expectedStatus: 200, lastChecked: '2024-01-20T10:30:00Z', lastStatus: 'healthy' },
    ],
    alerts: [
      { id: 'a12', name: 'Inventory Sync Failed', condition: 'sync_failures > 0', severity: 'warning', notificationChannels: ['slack'], escalationPolicy: 'inventory-warning' },
    ],
    metrics: [
      { id: 'm13', name: 'Stock Updates', description: 'Inventory updates per minute', unit: 'updates/min', dashboardUrl: 'https://grafana.company.com/d/inventory-api' },
    ],
    sla: {
      id: 'sla6',
      name: 'Inventory API SLA',
      targetUptime: 99.9,
      currentUptime: 99.95
    },
    configItems: [
      { key: 'DATABASE_URL', description: 'PostgreSQL connection', location: 'Kubernetes Secret: inventory-api-secrets', isSecret: true },
      { key: 'KAFKA_BROKERS', description: 'Kafka broker addresses', location: 'Kubernetes ConfigMap: inventory-api-config', isSecret: false },
    ],
    tags: ['inventory', 'stock', 'tier-2'],
    createdAt: '2022-02-01T00:00:00Z',
    updatedAt: '2024-01-19T00:00:00Z',
    version: '1.5.0'
  },
  {
    id: 'svc-payment-gateway',
    name: 'payment-gateway',
    displayName: 'Payment Gateway',
    description: 'Payment processing integration with multiple payment providers (Stripe, PayPal, etc.).',
    type: 'api',
    tier: 'tier-1',
    status: 'healthy',
    ownerTeam: platformTeam,
    repository: 'https://github.com/company/payment-gateway',
    documentationUrl: 'https://docs.company.com/payment-gateway',
    architecture: 'Microservice with circuit breaker pattern',
    techStack: ['Python', 'FastAPI', 'Redis', 'PostgreSQL'],
    language: 'Python',
    framework: 'FastAPI',
    servers: [
      { id: 's17', hostname: 'payment-prod-1', ipAddress: '10.0.60.10', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '4 vCPU', memory: '8GB', storage: '50GB SSD' } },
      { id: 's18', hostname: 'payment-prod-2', ipAddress: '10.0.61.10', environment: 'production', datacenter: 'us-west-2', specs: { cpu: '4 vCPU', memory: '8GB', storage: '50GB SSD' } },
    ],
    endpoints: [
      { id: 'e14', url: 'https://payment.company.com/v1/charge', method: 'POST', description: 'Process payment', healthCheckPath: '/health', expectedResponseTime: 2000 },
      { id: 'e15', url: 'https://payment.company.com/v1/refund', method: 'POST', description: 'Process refund', expectedResponseTime: 1000 },
    ],
    upstreamDependencies: [
      { serviceId: 'svc-postgres', serviceName: 'PostgreSQL Database', type: 'hard', description: 'Transaction records', dataFlow: 'bidirectional' },
      { serviceId: 'svc-redis', serviceName: 'Redis Cache', type: 'soft', description: 'Rate limiting', dataFlow: 'bidirectional' },
    ],
    downstreamDependencies: [
      { serviceId: 'svc-order-api', serviceName: 'Order API', type: 'hard', description: 'Payment processing', dataFlow: 'inbound' },
    ],
    runbooks: [
      {
        id: 'rb6',
        title: 'Payment Gateway Failover',
        description: 'Switch to backup payment provider',
        triggerConditions: ['Primary provider timeout', 'Error rate > 5%'],
        steps: [
          { order: 1, title: 'Enable Backup Provider', description: 'Switch to secondary payment provider', commands: ['kubectl set env deployment/payment-gateway PAYMENT_PROVIDER=backup -n payments'], expectedOutcome: 'Traffic routed to backup provider' },
        ],
        estimatedDuration: '5 minutes',
        lastUpdated: '2024-01-16',
        author: 'Alice Chen'
      }
    ],
    healthChecks: [
      { id: 'hc9', name: 'Payment Health', endpoint: 'https://payment.company.com/health', interval: 15, timeout: 5, expectedStatus: 200, lastChecked: '2024-01-20T10:30:00Z', lastStatus: 'healthy' },
    ],
    alerts: [
      { id: 'a13', name: 'Payment Failures', condition: 'failure_rate > 2%', severity: 'critical', notificationChannels: ['pagerduty', 'slack', 'sms'], escalationPolicy: 'payment-critical' },
    ],
    metrics: [
      { id: 'm14', name: 'Payment Success Rate', description: 'Successful payments', unit: '%', dashboardUrl: 'https://grafana.company.com/d/payment' },
      { id: 'm15', name: 'Payment Volume', description: 'Total payment amount', unit: 'USD', dashboardUrl: 'https://grafana.company.com/d/payment' },
    ],
    sla: {
      id: 'sla7',
      name: 'Payment Gateway SLA',
      targetUptime: 99.99,
      errorRateThreshold: 0.1,
      currentUptime: 99.995
    },
    configItems: [
      { key: 'STRIPE_API_KEY', description: 'Stripe API key', location: 'Kubernetes Secret: payment-secrets', isSecret: true, lastRotated: '2024-01-01' },
      { key: 'PAYPAL_CLIENT_ID', description: 'PayPal client ID', location: 'Kubernetes Secret: payment-secrets', isSecret: true },
    ],
    tags: ['payment', 'tier-1', 'pci-compliant', 'revenue-critical'],
    createdAt: '2021-03-01T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z',
    version: '3.1.0'
  },
  {
    id: 'svc-cdn',
    name: 'cdn',
    displayName: 'CDN',
    description: 'Content Delivery Network for static assets, images, and cached content.',
    type: 'network',
    tier: 'tier-2',
    status: 'healthy',
    ownerTeam: platformTeam,
    repository: 'https://github.com/company/cdn-config',
    documentationUrl: 'https://docs.company.com/cdn',
    architecture: 'CloudFlare CDN with edge caching',
    techStack: ['CloudFlare', 'S3'],
    servers: [],
    endpoints: [
      { id: 'e16', url: 'https://cdn.company.com', method: 'GET', description: 'CDN endpoint', expectedResponseTime: 50 },
    ],
    upstreamDependencies: [
      { serviceId: 'svc-s3', serviceName: 'S3 Storage', type: 'hard', description: 'Origin storage', dataFlow: 'outbound' },
    ],
    downstreamDependencies: [
      { serviceId: 'svc-web-app', serviceName: 'Web Application', type: 'soft', description: 'Static assets', dataFlow: 'inbound' },
    ],
    runbooks: [],
    healthChecks: [],
    alerts: [
      { id: 'a14', name: 'CDN Cache Miss Rate', condition: 'cache_miss > 30%', severity: 'warning', notificationChannels: ['slack'] },
    ],
    metrics: [
      { id: 'm16', name: 'Cache Hit Rate', description: 'CDN cache hit ratio', unit: '%', dashboardUrl: 'https://grafana.company.com/d/cdn' },
      { id: 'm17', name: 'Bandwidth', description: 'Total bandwidth served', unit: 'GB', dashboardUrl: 'https://grafana.company.com/d/cdn' },
    ],
    sla: { id: 'sla8', name: 'CDN SLA', targetUptime: 99.9, currentUptime: 99.99 },
    configItems: [],
    tags: ['cdn', 'network', 'tier-2', 'caching'],
    createdAt: '2021-01-01T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z'
  },
  {
    id: 'svc-rabbitmq',
    name: 'rabbitmq',
    displayName: 'RabbitMQ',
    description: 'Message broker for asynchronous communication between services.',
    type: 'queue',
    tier: 'tier-2',
    status: 'healthy',
    ownerTeam: platformTeam,
    repository: 'https://github.com/company/infra-rabbitmq',
    documentationUrl: 'https://docs.company.com/rabbitmq',
    architecture: 'RabbitMQ cluster with mirrored queues',
    techStack: ['RabbitMQ', 'Erlang'],
    servers: [
      { id: 's19', hostname: 'rabbitmq-1', ipAddress: '10.0.70.10', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '4 vCPU', memory: '16GB', storage: '200GB SSD' } },
      { id: 's20', hostname: 'rabbitmq-2', ipAddress: '10.0.70.11', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '4 vCPU', memory: '16GB', storage: '200GB SSD' } },
      { id: 's21', hostname: 'rabbitmq-3', ipAddress: '10.0.71.10', environment: 'production', datacenter: 'us-west-2', specs: { cpu: '4 vCPU', memory: '16GB', storage: '200GB SSD' } },
    ],
    endpoints: [
      { id: 'e17', url: 'amqp://rabbitmq.internal:5672', method: 'GET', description: 'AMQP endpoint' },
      { id: 'e18', url: 'https://rabbitmq.internal:15672', method: 'GET', description: 'Management UI' },
    ],
    upstreamDependencies: [],
    downstreamDependencies: [
      { serviceId: 'svc-order-api', serviceName: 'Order API', type: 'hard', description: 'Order events', dataFlow: 'outbound' },
    ],
    runbooks: [],
    healthChecks: [
      { id: 'hc10', name: 'RabbitMQ Health', endpoint: 'https://rabbitmq.internal:15672/api/health', interval: 30, timeout: 5, expectedStatus: 200 },
    ],
    alerts: [
      { id: 'a15', name: 'Queue Depth', condition: 'queue_depth > 10000', severity: 'warning', notificationChannels: ['slack'] },
    ],
    metrics: [
      { id: 'm18', name: 'Message Rate', description: 'Messages per second', unit: 'msg/s', dashboardUrl: 'https://grafana.company.com/d/rabbitmq' },
    ],
    sla: { id: 'sla9', name: 'RabbitMQ SLA', targetUptime: 99.9, currentUptime: 99.95 },
    configItems: [
      { key: 'RABBITMQ_DEFAULT_PASS', description: 'RabbitMQ admin password', location: 'Kubernetes Secret: rabbitmq-secrets', isSecret: true },
    ],
    tags: ['messaging', 'queue', 'tier-2', 'async'],
    createdAt: '2021-06-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    version: '3.12.0'
  },
  {
    id: 'svc-kafka',
    name: 'kafka',
    displayName: 'Kafka',
    description: 'Distributed event streaming platform for high-throughput data pipelines.',
    type: 'queue',
    tier: 'tier-1',
    status: 'healthy',
    ownerTeam: dataTeam,
    repository: 'https://github.com/company/infra-kafka',
    documentationUrl: 'https://docs.company.com/kafka',
    architecture: 'Kafka cluster with 5 brokers and ZooKeeper',
    techStack: ['Apache Kafka', 'ZooKeeper'],
    servers: [
      { id: 's22', hostname: 'kafka-broker-1', ipAddress: '10.0.80.10', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '8 vCPU', memory: '32GB', storage: '1TB NVMe' } },
      { id: 's23', hostname: 'kafka-broker-2', ipAddress: '10.0.80.11', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '8 vCPU', memory: '32GB', storage: '1TB NVMe' } },
      { id: 's24', hostname: 'kafka-broker-3', ipAddress: '10.0.81.10', environment: 'production', datacenter: 'us-west-2', specs: { cpu: '8 vCPU', memory: '32GB', storage: '1TB NVMe' } },
    ],
    endpoints: [
      { id: 'e19', url: 'kafka://kafka.internal:9092', method: 'GET', description: 'Kafka broker' },
    ],
    upstreamDependencies: [],
    downstreamDependencies: [
      { serviceId: 'svc-inventory-api', serviceName: 'Inventory API', type: 'hard', description: 'Event streaming', dataFlow: 'outbound' },
    ],
    runbooks: [],
    healthChecks: [],
    alerts: [
      { id: 'a16', name: 'Under Replicated Partitions', condition: 'under_replicated > 0', severity: 'critical', notificationChannels: ['pagerduty', 'slack'] },
    ],
    metrics: [
      { id: 'm19', name: 'Messages In', description: 'Messages ingested per second', unit: 'msg/s', dashboardUrl: 'https://grafana.company.com/d/kafka' },
    ],
    sla: { id: 'sla10', name: 'Kafka SLA', targetUptime: 99.99, currentUptime: 99.995 },
    configItems: [],
    tags: ['streaming', 'events', 'tier-1', 'data-pipeline'],
    createdAt: '2022-01-01T00:00:00Z',
    updatedAt: '2024-01-18T00:00:00Z',
    version: '3.6.0'
  },
  {
    id: 'svc-mobile-api',
    name: 'mobile-api-gateway',
    displayName: 'Mobile API Gateway',
    description: 'API gateway for mobile applications with rate limiting and authentication.',
    type: 'api',
    tier: 'tier-1',
    status: 'healthy',
    ownerTeam: apiTeam,
    repository: 'https://github.com/company/mobile-api-gateway',
    documentationUrl: 'https://docs.company.com/mobile-api',
    architecture: 'Kong API Gateway',
    techStack: ['Kong', 'Lua', 'PostgreSQL'],
    servers: [
      { id: 's25', hostname: 'mobile-gateway-1', ipAddress: '10.0.90.10', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '4 vCPU', memory: '8GB', storage: '50GB SSD' } },
      { id: 's26', hostname: 'mobile-gateway-2', ipAddress: '10.0.91.10', environment: 'production', datacenter: 'us-west-2', specs: { cpu: '4 vCPU', memory: '8GB', storage: '50GB SSD' } },
    ],
    endpoints: [
      { id: 'e20', url: 'https://mobile-api.company.com', method: 'GET', description: 'Mobile API gateway', healthCheckPath: '/health' },
    ],
    upstreamDependencies: [
      { serviceId: 'svc-user-api', serviceName: 'User API Service', type: 'hard', description: 'User authentication', dataFlow: 'outbound' },
      { serviceId: 'svc-order-api', serviceName: 'Order API', type: 'hard', description: 'Order management', dataFlow: 'outbound' },
    ],
    downstreamDependencies: [],
    runbooks: [],
    healthChecks: [
      { id: 'hc11', name: 'Gateway Health', endpoint: 'https://mobile-api.company.com/health', interval: 30, timeout: 5, expectedStatus: 200 },
    ],
    alerts: [
      { id: 'a17', name: 'Gateway Error Rate', condition: 'error_rate > 1%', severity: 'critical', notificationChannels: ['pagerduty', 'slack'] },
    ],
    metrics: [
      { id: 'm20', name: 'Request Rate', description: 'Requests per second', unit: 'req/s', dashboardUrl: 'https://grafana.company.com/d/mobile-api' },
    ],
    sla: { id: 'sla11', name: 'Mobile API SLA', targetUptime: 99.9, currentUptime: 99.92 },
    configItems: [],
    tags: ['mobile', 'gateway', 'tier-1', 'api'],
    createdAt: '2022-06-01T00:00:00Z',
    updatedAt: '2024-01-19T00:00:00Z',
    version: '3.4.0'
  },
  {
    id: 'svc-monitoring',
    name: 'monitoring-stack',
    displayName: 'Monitoring Stack',
    description: 'Centralized monitoring, metrics collection, and alerting infrastructure.',
    type: 'monitoring',
    tier: 'tier-2',
    status: 'healthy',
    ownerTeam: platformTeam,
    repository: 'https://github.com/company/monitoring-stack',
    documentationUrl: 'https://docs.company.com/monitoring',
    architecture: 'Prometheus + Grafana + Alertmanager',
    techStack: ['Prometheus', 'Grafana', 'Alertmanager', 'Loki'],
    servers: [
      { id: 's27', hostname: 'prometheus-1', ipAddress: '10.0.100.10', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '8 vCPU', memory: '32GB', storage: '500GB SSD' } },
      { id: 's28', hostname: 'grafana-1', ipAddress: '10.0.100.11', environment: 'production', datacenter: 'us-east-1', specs: { cpu: '4 vCPU', memory: '8GB', storage: '100GB SSD' } },
    ],
    endpoints: [
      { id: 'e21', url: 'https://grafana.company.com', method: 'GET', description: 'Grafana dashboards' },
      { id: 'e22', url: 'https://prometheus.company.com', method: 'GET', description: 'Prometheus UI' },
    ],
    upstreamDependencies: [],
    downstreamDependencies: [],
    runbooks: [],
    healthChecks: [],
    alerts: [],
    metrics: [],
    sla: { id: 'sla12', name: 'Monitoring SLA', targetUptime: 99.9, currentUptime: 99.95 },
    configItems: [],
    tags: ['monitoring', 'observability', 'tier-2', 'infrastructure'],
    createdAt: '2021-01-01T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z',
    version: '2.45.0'
  }
];

// Application Stacks
export const mockStacks: ApplicationStack[] = [
  {
    id: 'stack-ecommerce',
    name: 'ecommerce-platform',
    displayName: 'E-Commerce Platform',
    description: 'Complete e-commerce platform including web, mobile, orders, and payments.',
    environment: 'production',
    services: mockServices.filter(s => ['svc-web-app', 'svc-user-api', 'svc-order-api', 'svc-payment-gateway', 'svc-inventory-api', 'svc-mobile-api'].includes(s.id)),
    status: 'degraded',
    ownerTeam: apiTeam,
    businessCriticality: 'critical',
    tags: ['ecommerce', 'revenue', 'customer-facing'],
    createdAt: '2021-01-01T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z'
  },
  {
    id: 'stack-data-platform',
    name: 'data-platform',
    displayName: 'Data Platform',
    description: 'Data infrastructure including databases, caching, and event streaming.',
    environment: 'production',
    services: mockServices.filter(s => ['svc-postgres', 'svc-redis', 'svc-kafka', 'svc-rabbitmq'].includes(s.id)),
    status: 'healthy',
    ownerTeam: dataTeam,
    businessCriticality: 'critical',
    tags: ['data', 'infrastructure', 'persistence'],
    createdAt: '2021-06-01T00:00:00Z',
    updatedAt: '2024-01-18T00:00:00Z'
  },
  {
    id: 'stack-platform',
    name: 'platform-infrastructure',
    displayName: 'Platform Infrastructure',
    description: 'Core platform services including CDN, monitoring, and payment processing.',
    environment: 'production',
    services: mockServices.filter(s => ['svc-cdn', 'svc-monitoring', 'svc-payment-gateway'].includes(s.id)),
    status: 'healthy',
    ownerTeam: platformTeam,
    businessCriticality: 'high',
    tags: ['platform', 'infrastructure', 'core'],
    createdAt: '2021-01-01T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z'
  }
];

export const allTeams: Team[] = [platformTeam, apiTeam, dataTeam, frontendTeam];

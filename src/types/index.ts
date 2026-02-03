// Core Service Types
export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'maintenance' | 'unknown';
export type ServiceTier = 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4';
export type ServiceType = 'api' | 'web' | 'database' | 'cache' | 'queue' | 'storage' | 'compute' | 'network' | 'monitoring' | 'security' | 'other';
export type Environment = 'production' | 'staging' | 'development' | 'testing';

// Contact and Team Information
export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'primary' | 'secondary' | 'escalation';
  team: string;
}

export interface Team {
  id: string;
  name: string;
  slackChannel?: string;
  emailGroup?: string;
  oncallRotation?: string;
  contacts: Contact[];
}

// Infrastructure Components
export interface Server {
  id: string;
  hostname: string;
  ipAddress: string;
  environment: Environment;
  datacenter: string;
  specs?: {
    cpu: string;
    memory: string;
    storage: string;
  };
}

export interface Endpoint {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  healthCheckPath?: string;
  expectedResponseTime?: number; // in ms
}

// Dependency Types
export interface Dependency {
  serviceId: string;
  serviceName: string;
  type: 'hard' | 'soft'; // hard = critical, soft = degraded functionality
  description: string;
  dataFlow: 'inbound' | 'outbound' | 'bidirectional';
}

// Runbook and Documentation
export interface RunbookStep {
  order: number;
  title: string;
  description: string;
  commands?: string[];
  expectedOutcome?: string;
  rollbackSteps?: string[];
}

export interface Runbook {
  id: string;
  title: string;
  description: string;
  triggerConditions: string[];
  steps: RunbookStep[];
  estimatedDuration?: string;
  lastUpdated: string;
  author: string;
}

// Monitoring and Alerts
export interface HealthCheck {
  id: string;
  name: string;
  endpoint: string;
  interval: number; // in seconds
  timeout: number; // in seconds
  expectedStatus: number;
  lastChecked?: string;
  lastStatus?: ServiceStatus;
}

export interface Alert {
  id: string;
  name: string;
  condition: string;
  severity: 'critical' | 'warning' | 'info';
  notificationChannels: string[];
  escalationPolicy?: string;
}

export interface Metric {
  id: string;
  name: string;
  description: string;
  unit: string;
  dashboardUrl?: string;
}

// SLA and Performance
export interface SLA {
  id: string;
  name: string;
  targetUptime: number; // percentage, e.g., 99.9
  responseTimeP50?: number; // in ms
  responseTimeP95?: number;
  responseTimeP99?: number;
  errorRateThreshold?: number; // percentage
  currentUptime?: number;
  currentResponseTime?: number;
}

// Configuration and Secrets
export interface ConfigItem {
  key: string;
  description: string;
  location: string; // where to find/configure this
  isSecret: boolean;
  lastRotated?: string;
}

// Main Service Interface
export interface Service {
  id: string;
  name: string;
  displayName: string;
  description: string;
  type: ServiceType;
  tier: ServiceTier;
  status: ServiceStatus;

  // Ownership
  ownerTeam: Team;

  // Technical Details
  repository?: string;
  documentationUrl?: string;
  architecture?: string;
  techStack: string[];
  language?: string;
  framework?: string;

  // Infrastructure
  servers: Server[];
  endpoints: Endpoint[];

  // Dependencies
  upstreamDependencies: Dependency[]; // services this depends on
  downstreamDependencies: Dependency[]; // services that depend on this

  // Operations
  runbooks: Runbook[];
  healthChecks: HealthCheck[];
  alerts: Alert[];
  metrics: Metric[];

  // SLA and Performance
  sla?: SLA;

  // Configuration
  configItems: ConfigItem[];

  // Metadata
  tags: string[];
  createdAt: string;
  updatedAt: string;
  version?: string;
}

// Application Stack
export interface ApplicationStack {
  id: string;
  name: string;
  displayName: string;
  description: string;
  environment: Environment;
  services: Service[];
  status: ServiceStatus;
  ownerTeam: Team;
  businessCriticality: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Search Related Types
export interface SearchFilters {
  query?: string;
  type?: ServiceType[];
  tier?: ServiceTier[];
  status?: ServiceStatus[];
  team?: string[];
  tags?: string[];
  environment?: Environment[];
}

export interface SearchResult {
  services: Service[];
  stacks: ApplicationStack[];
  totalServices: number;
  totalStacks: number;
}

// Incident Impact Analysis
export interface ImpactedService {
  service: Service;
  impactType: 'direct' | 'upstream' | 'downstream';
  severity: 'critical' | 'high' | 'medium' | 'low';
  estimatedImpact: string;
}

export interface IncidentImpactAnalysis {
  affectedService: Service;
  impactedServices: ImpactedService[];
  totalUsersAffected?: number;
  businessImpact: string;
  suggestedActions: string[];
  relevantRunbooks: Runbook[];
  escalationContacts: Contact[];
}

// API Response Types (for future database integration)
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

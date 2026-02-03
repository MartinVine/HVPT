/**
 * Service Catalogue API Service
 *
 * This service layer provides an abstraction over the data source.
 * Currently uses mock data, but can be easily replaced with real API calls.
 *
 * For Agentic use: All functions return structured data that can be
 * consumed by AI agents for service management decisions.
 */

import {
  Service,
  ApplicationStack,
  SearchFilters,
  SearchResult,
  IncidentImpactAnalysis,
  ImpactedService,
  Contact,
  Runbook,
  ServiceStatus,
  Team
} from '../types';
import { mockServices, mockStacks, allTeams } from '../data/mockData';

// Simulated API delay (remove when using real API)
const simulateDelay = (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Search services and application stacks
 */
export async function searchCatalogue(filters: SearchFilters): Promise<SearchResult> {
  await simulateDelay();

  let filteredServices = [...mockServices];
  let filteredStacks = [...mockStacks];

  // Apply text search
  if (filters.query) {
    const query = filters.query.toLowerCase();
    filteredServices = filteredServices.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.displayName.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query) ||
      s.tags.some(t => t.toLowerCase().includes(query)) ||
      s.techStack.some(t => t.toLowerCase().includes(query)) ||
      s.ownerTeam.name.toLowerCase().includes(query)
    );
    filteredStacks = filteredStacks.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.displayName.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query) ||
      s.tags.some(t => t.toLowerCase().includes(query))
    );
  }

  // Apply type filter
  if (filters.type && filters.type.length > 0) {
    filteredServices = filteredServices.filter(s => filters.type!.includes(s.type));
  }

  // Apply tier filter
  if (filters.tier && filters.tier.length > 0) {
    filteredServices = filteredServices.filter(s => filters.tier!.includes(s.tier));
  }

  // Apply status filter
  if (filters.status && filters.status.length > 0) {
    filteredServices = filteredServices.filter(s => filters.status!.includes(s.status));
    filteredStacks = filteredStacks.filter(s => filters.status!.includes(s.status));
  }

  // Apply team filter
  if (filters.team && filters.team.length > 0) {
    filteredServices = filteredServices.filter(s => filters.team!.includes(s.ownerTeam.id));
    filteredStacks = filteredStacks.filter(s => filters.team!.includes(s.ownerTeam.id));
  }

  // Apply tags filter
  if (filters.tags && filters.tags.length > 0) {
    filteredServices = filteredServices.filter(s =>
      filters.tags!.some(tag => s.tags.includes(tag))
    );
    filteredStacks = filteredStacks.filter(s =>
      filters.tags!.some(tag => s.tags.includes(tag))
    );
  }

  return {
    services: filteredServices,
    stacks: filteredStacks,
    totalServices: filteredServices.length,
    totalStacks: filteredStacks.length
  };
}

/**
 * Get a single service by ID
 */
export async function getServiceById(id: string): Promise<Service | null> {
  await simulateDelay();
  return mockServices.find(s => s.id === id) || null;
}

/**
 * Get a single service by name
 */
export async function getServiceByName(name: string): Promise<Service | null> {
  await simulateDelay();
  return mockServices.find(s => s.name.toLowerCase() === name.toLowerCase()) || null;
}

/**
 * Get an application stack by ID
 */
export async function getStackById(id: string): Promise<ApplicationStack | null> {
  await simulateDelay();
  return mockStacks.find(s => s.id === id) || null;
}

/**
 * Get all services
 */
export async function getAllServices(): Promise<Service[]> {
  await simulateDelay();
  return mockServices;
}

/**
 * Get all application stacks
 */
export async function getAllStacks(): Promise<ApplicationStack[]> {
  await simulateDelay();
  return mockStacks;
}

/**
 * Get all teams
 */
export async function getAllTeams(): Promise<Team[]> {
  await simulateDelay();
  return allTeams;
}

/**
 * Get services by status
 */
export async function getServicesByStatus(status: ServiceStatus): Promise<Service[]> {
  await simulateDelay();
  return mockServices.filter(s => s.status === status);
}

/**
 * Get all unhealthy services
 */
export async function getUnhealthyServices(): Promise<Service[]> {
  await simulateDelay();
  return mockServices.filter(s => s.status !== 'healthy');
}

/**
 * Get service dependencies (both upstream and downstream)
 */
export async function getServiceDependencies(serviceId: string): Promise<{
  upstream: Service[];
  downstream: Service[];
}> {
  await simulateDelay();
  const service = mockServices.find(s => s.id === serviceId);
  if (!service) {
    return { upstream: [], downstream: [] };
  }

  const upstream = service.upstreamDependencies
    .map(dep => mockServices.find(s => s.id === dep.serviceId))
    .filter((s): s is Service => s !== undefined);

  const downstream = service.downstreamDependencies
    .map(dep => mockServices.find(s => s.id === dep.serviceId))
    .filter((s): s is Service => s !== undefined);

  return { upstream, downstream };
}

/**
 * Analyze incident impact for a service
 * This is key for agentic decision making
 */
export async function analyzeIncidentImpact(serviceId: string): Promise<IncidentImpactAnalysis | null> {
  await simulateDelay();

  const affectedService = mockServices.find(s => s.id === serviceId);
  if (!affectedService) {
    return null;
  }

  const impactedServices: ImpactedService[] = [];
  const processedIds = new Set<string>([serviceId]);

  // Find directly impacted downstream services
  for (const dep of affectedService.downstreamDependencies) {
    const service = mockServices.find(s => s.id === dep.serviceId);
    if (service && !processedIds.has(service.id)) {
      processedIds.add(service.id);
      impactedServices.push({
        service,
        impactType: 'downstream',
        severity: dep.type === 'hard' ? 'critical' : 'medium',
        estimatedImpact: dep.type === 'hard'
          ? `${service.displayName} will be completely unavailable`
          : `${service.displayName} may have degraded functionality`
      });

      // Find secondary impacts (services that depend on impacted services)
      for (const secondaryDep of service.downstreamDependencies) {
        const secondaryService = mockServices.find(s => s.id === secondaryDep.serviceId);
        if (secondaryService && !processedIds.has(secondaryService.id)) {
          processedIds.add(secondaryService.id);
          impactedServices.push({
            service: secondaryService,
            impactType: 'downstream',
            severity: 'low',
            estimatedImpact: `${secondaryService.displayName} may experience cascading effects`
          });
        }
      }
    }
  }

  // Find impacted upstream services (if this service is a dependency)
  for (const service of mockServices) {
    if (processedIds.has(service.id)) continue;

    const dependsOnAffected = service.upstreamDependencies.find(dep => dep.serviceId === serviceId);
    if (dependsOnAffected) {
      processedIds.add(service.id);
      impactedServices.push({
        service,
        impactType: 'upstream',
        severity: dependsOnAffected.type === 'hard' ? 'critical' : 'medium',
        estimatedImpact: dependsOnAffected.type === 'hard'
          ? `${service.displayName} depends critically on this service`
          : `${service.displayName} has soft dependency, may continue with degraded performance`
      });
    }
  }

  // Gather escalation contacts
  const escalationContacts: Contact[] = [
    ...affectedService.ownerTeam.contacts.filter(c => c.role === 'primary' || c.role === 'escalation'),
  ];

  // Add contacts from critically impacted services
  for (const impacted of impactedServices.filter(i => i.severity === 'critical')) {
    const primaryContact = impacted.service.ownerTeam.contacts.find(c => c.role === 'primary');
    if (primaryContact && !escalationContacts.find(c => c.id === primaryContact.id)) {
      escalationContacts.push(primaryContact);
    }
  }

  // Gather relevant runbooks
  const relevantRunbooks: Runbook[] = [
    ...affectedService.runbooks,
    ...impactedServices
      .filter(i => i.severity === 'critical')
      .flatMap(i => i.service.runbooks)
  ];

  // Generate suggested actions based on service type and tier
  const suggestedActions = generateSuggestedActions(affectedService, impactedServices);

  // Calculate business impact
  const businessImpact = calculateBusinessImpact(affectedService, impactedServices);

  return {
    affectedService,
    impactedServices,
    businessImpact,
    suggestedActions,
    relevantRunbooks,
    escalationContacts
  };
}

/**
 * Generate suggested actions for incident response
 */
function generateSuggestedActions(
  affectedService: Service,
  impactedServices: ImpactedService[]
): string[] {
  const actions: string[] = [];

  // Base actions
  actions.push(`1. Check ${affectedService.displayName} health endpoints and logs`);
  actions.push(`2. Verify upstream dependencies are healthy`);

  // Tier-specific actions
  if (affectedService.tier === 'tier-1') {
    actions.push(`3. PRIORITY: This is a Tier-1 service - immediate escalation required`);
    actions.push(`4. Enable incident bridge call if not already active`);
  }

  // Runbook actions
  if (affectedService.runbooks.length > 0) {
    actions.push(`5. Follow runbook: "${affectedService.runbooks[0].title}"`);
  }

  // Dependency-specific actions
  const criticalDownstream = impactedServices.filter(i => i.severity === 'critical' && i.impactType === 'downstream');
  if (criticalDownstream.length > 0) {
    actions.push(`6. Notify teams of ${criticalDownstream.length} critically affected downstream services`);
  }

  // Database-specific actions
  if (affectedService.type === 'database') {
    actions.push(`7. Check for database connectivity, replication lag, and disk space`);
    actions.push(`8. Consider read-only mode if writes are failing`);
  }

  // API-specific actions
  if (affectedService.type === 'api') {
    actions.push(`7. Consider enabling circuit breaker if downstream services are overwhelmed`);
    actions.push(`8. Check rate limiting and scale pods if needed`);
  }

  return actions;
}

/**
 * Calculate business impact description
 */
function calculateBusinessImpact(
  affectedService: Service,
  impactedServices: ImpactedService[]
): string {
  const criticalCount = impactedServices.filter(i => i.severity === 'critical').length;
  const tier = affectedService.tier;

  const impacts: string[] = [];

  if (tier === 'tier-1') {
    impacts.push('CRITICAL: Tier-1 service affecting core business functionality');
  }

  if (affectedService.tags.includes('revenue-critical')) {
    impacts.push('Direct revenue impact expected');
  }

  if (affectedService.tags.includes('customer-facing')) {
    impacts.push('Customer experience will be degraded');
  }

  if (criticalCount > 0) {
    impacts.push(`${criticalCount} dependent services critically affected`);
  }

  if (affectedService.sla) {
    impacts.push(`SLA target: ${affectedService.sla.targetUptime}% uptime at risk`);
  }

  return impacts.length > 0 ? impacts.join('. ') : 'Impact assessment in progress';
}

/**
 * Get full dependency graph for visualization
 */
export async function getDependencyGraph(): Promise<{
  nodes: Array<{ id: string; name: string; type: string; status: ServiceStatus; tier: string }>;
  edges: Array<{ source: string; target: string; type: 'hard' | 'soft' }>;
}> {
  await simulateDelay();

  const nodes = mockServices.map(s => ({
    id: s.id,
    name: s.displayName,
    type: s.type,
    status: s.status,
    tier: s.tier
  }));

  const edges: Array<{ source: string; target: string; type: 'hard' | 'soft' }> = [];

  for (const service of mockServices) {
    for (const dep of service.upstreamDependencies) {
      edges.push({
        source: service.id,
        target: dep.serviceId,
        type: dep.type
      });
    }
  }

  return { nodes, edges };
}

/**
 * Get unique tags from all services
 */
export async function getAllTags(): Promise<string[]> {
  await simulateDelay();
  const tags = new Set<string>();
  mockServices.forEach(s => s.tags.forEach(t => tags.add(t)));
  return Array.from(tags).sort();
}

/**
 * Get unique tech stack items
 */
export async function getAllTechStack(): Promise<string[]> {
  await simulateDelay();
  const tech = new Set<string>();
  mockServices.forEach(s => s.techStack.forEach(t => tech.add(t)));
  return Array.from(tech).sort();
}

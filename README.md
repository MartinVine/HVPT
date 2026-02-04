# HVPT Service Catalogue

A comprehensive front-end application for interrogating service catalogue and application stack information. Designed for agentic service management to help determine what actions to take when a service is down.

## Features

### Service Search & Discovery
- **Full-text search** across services, stacks, teams, and technologies
- **Advanced filtering** by status, tier, type, team, and tags
- **Real-time results** with debounced search

### Service Details
- Complete service information including:
  - Overview (description, type, tier, architecture)
  - Ownership & contacts with escalation paths
  - Infrastructure (servers, endpoints)
  - Dependencies (upstream & downstream with hard/soft classification)
  - Runbooks with step-by-step recovery procedures
  - SLA targets and current performance
  - Alerts and monitoring configuration

### Application Stacks
- View grouped services as application stacks
- Health summary across all stack services
- Internal and external dependency visualization
- Business criticality classification

### Incident Impact Analysis
- **Automated impact assessment** when a service goes down
- Cascading dependency analysis (direct, upstream, downstream)
- Severity classification (critical, high, medium, low)
- **Suggested actions** based on service type and tier
- Escalation contacts with contact information
- Relevant runbooks for incident response
- **Agent-ready JSON output** for automated consumption

### Dependency Graph
- Visual representation of service dependencies
- Filter by all services, tier-1 only, or unhealthy
- Interactive nodes with hover/click details
- Legend for status colors and dependency types

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Lucide React** for icons
- **CSS3** with CSS Variables for theming

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/          # React components
│   ├── SearchBar.tsx    # Main search input
│   ├── FilterPanel.tsx  # Filter sidebar
│   ├── ServiceList.tsx  # Service card grid
│   ├── StackList.tsx    # Stack card grid
│   ├── ServiceDetails.tsx   # Full service view
│   ├── StackDetails.tsx     # Full stack view
│   ├── IncidentAnalysis.tsx # Impact analysis view
│   ├── DependencyGraph.tsx  # Visual dependency graph
│   └── StatusBadge.tsx  # Status indicator component
├── data/
│   └── mockData.ts      # Sample service data
├── hooks/
│   └── useSearch.ts     # Search state management
├── services/
│   └── catalogueService.ts  # API abstraction layer
├── types/
│   └── index.ts         # TypeScript interfaces
├── App.tsx              # Main application
├── App.css              # Application styles
├── index.css            # Global styles
└── main.tsx             # Entry point
```

## Data Model

### Core Types

- **Service**: Full service definition with all metadata
- **ApplicationStack**: Group of related services
- **Team**: Team ownership with contacts
- **Dependency**: Service dependency with type (hard/soft)
- **Runbook**: Step-by-step operational procedures
- **SLA**: Service level agreements and targets

### For Agentic Use

The `catalogueService.ts` provides functions designed for AI agent consumption:

```typescript
// Search across all services and stacks
searchCatalogue(filters: SearchFilters): Promise<SearchResult>

// Get full impact analysis for incident response
analyzeIncidentImpact(serviceId: string): Promise<IncidentImpactAnalysis>

// Get dependency graph for visualization
getDependencyGraph(): Promise<{ nodes, edges }>

// Get services by health status
getUnhealthyServices(): Promise<Service[]>
```

The incident analysis returns structured data ready for automated decision-making:
- Impacted services with severity levels
- Suggested actions based on service type
- Escalation contacts
- Relevant runbooks

## Future Database Integration

The service layer (`src/services/catalogueService.ts`) is designed as an abstraction layer. Currently uses mock data but can be easily replaced with real API calls:

```typescript
// Replace mock data fetch with API call
export async function getServiceById(id: string): Promise<Service | null> {
  const response = await fetch(`/api/services/${id}`);
  return response.json();
}
```

## License

Reserved for HVPT Technical Development


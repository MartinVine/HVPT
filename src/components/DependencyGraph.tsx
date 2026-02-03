import { useState, useEffect, useCallback } from 'react';
import { Service, ServiceStatus } from '../types';
import { getDependencyGraph, getAllServices } from '../services/catalogueService';
import { StatusBadge } from './StatusBadge';

interface DependencyGraphProps {
  onServiceClick: (service: Service) => void;
  onBack: () => void;
}

interface GraphNode {
  id: string;
  name: string;
  type: string;
  status: ServiceStatus;
  tier: string;
  x: number;
  y: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: 'hard' | 'soft';
}

const STATUS_COLORS: Record<ServiceStatus, string> = {
  healthy: '#22c55e',
  degraded: '#f59e0b',
  down: '#ef4444',
  maintenance: '#6366f1',
  unknown: '#6b7280',
};

const TIER_SIZES: Record<string, number> = {
  'tier-1': 60,
  'tier-2': 50,
  'tier-3': 40,
  'tier-4': 35,
};

export function DependencyGraph({ onServiceClick, onBack }: DependencyGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'tier-1' | 'unhealthy'>('all');

  useEffect(() => {
    const loadGraph = async () => {
      setIsLoading(true);
      try {
        const [graphData, servicesData] = await Promise.all([
          getDependencyGraph(),
          getAllServices()
        ]);

        // Position nodes in a circle layout
        const positionedNodes = graphData.nodes.map((node, index) => {
          const angle = (2 * Math.PI * index) / graphData.nodes.length;
          const radius = 300;
          return {
            ...node,
            x: 400 + radius * Math.cos(angle),
            y: 350 + radius * Math.sin(angle),
          };
        });

        setNodes(positionedNodes);
        setEdges(graphData.edges);
        setServices(servicesData);
      } catch (error) {
        console.error('Failed to load dependency graph:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadGraph();
  }, []);

  const getFilteredNodes = useCallback(() => {
    switch (viewMode) {
      case 'tier-1':
        return nodes.filter(n => n.tier === 'tier-1');
      case 'unhealthy':
        return nodes.filter(n => n.status !== 'healthy');
      default:
        return nodes;
    }
  }, [nodes, viewMode]);

  const getFilteredEdges = useCallback(() => {
    const filteredNodes = getFilteredNodes();
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [edges, getFilteredNodes]);

  const handleNodeClick = (nodeId: string) => {
    const service = services.find(s => s.id === nodeId);
    if (service) {
      onServiceClick(service);
    }
  };

  const getConnectedNodes = (nodeId: string): Set<string> => {
    const connected = new Set<string>();
    edges.forEach(edge => {
      if (edge.source === nodeId) connected.add(edge.target);
      if (edge.target === nodeId) connected.add(edge.source);
    });
    return connected;
  };

  const filteredNodes = getFilteredNodes();
  const filteredEdges = getFilteredEdges();

  if (isLoading) {
    return (
      <div className="dependency-graph loading">
        <div className="loading-state">
          <div className="spinner large"></div>
          <h2>Loading Dependency Graph...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="dependency-graph">
      <div className="graph-header">
        <button className="back-button" onClick={onBack}>
          &#8592; Back to Search
        </button>
        <div className="graph-title-row">
          <h1 className="graph-title">Service Dependency Graph</h1>
          <div className="graph-controls">
            <div className="view-mode-buttons">
              <button
                className={`view-mode-button ${viewMode === 'all' ? 'active' : ''}`}
                onClick={() => setViewMode('all')}
              >
                All Services
              </button>
              <button
                className={`view-mode-button ${viewMode === 'tier-1' ? 'active' : ''}`}
                onClick={() => setViewMode('tier-1')}
              >
                Tier-1 Only
              </button>
              <button
                className={`view-mode-button ${viewMode === 'unhealthy' ? 'active' : ''}`}
                onClick={() => setViewMode('unhealthy')}
              >
                Unhealthy
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="graph-content">
        <div className="graph-container">
          <svg viewBox="0 0 800 700" className="graph-svg">
            <defs>
              <marker
                id="arrowhead-hard"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
              </marker>
              <marker
                id="arrowhead-soft"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
              </marker>
            </defs>

            {/* Edges */}
            {filteredEdges.map((edge, index) => {
              const sourceNode = filteredNodes.find(n => n.id === edge.source);
              const targetNode = filteredNodes.find(n => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const isHighlighted = selectedNode === edge.source || selectedNode === edge.target ||
                hoveredNode === edge.source || hoveredNode === edge.target;
              const isHardDep = edge.type === 'hard';

              return (
                <line
                  key={`edge-${index}`}
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={isHighlighted ? (isHardDep ? '#ef4444' : '#6b7280') : '#e5e7eb'}
                  strokeWidth={isHighlighted ? 3 : 1}
                  strokeDasharray={isHardDep ? 'none' : '5,5'}
                  opacity={selectedNode && !isHighlighted ? 0.2 : 1}
                  markerEnd={`url(#arrowhead-${edge.type})`}
                />
              );
            })}

            {/* Nodes */}
            {filteredNodes.map(node => {
              const size = TIER_SIZES[node.tier] || 40;
              const isSelected = selectedNode === node.id;
              const isHovered = hoveredNode === node.id;
              const isConnected = selectedNode ? getConnectedNodes(selectedNode).has(node.id) : false;
              const shouldFade = selectedNode && !isSelected && !isConnected;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => handleNodeClick(node.id)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{ cursor: 'pointer' }}
                  opacity={shouldFade ? 0.3 : 1}
                >
                  {/* Node circle */}
                  <circle
                    r={size / 2}
                    fill={STATUS_COLORS[node.status]}
                    stroke={isSelected || isHovered ? '#1f2937' : 'white'}
                    strokeWidth={isSelected || isHovered ? 4 : 2}
                  />
                  {/* Node label */}
                  <text
                    y={size / 2 + 15}
                    textAnchor="middle"
                    className="node-label"
                    fontSize="10"
                    fill="#374151"
                  >
                    {node.name.length > 15 ? node.name.substring(0, 12) + '...' : node.name}
                  </text>
                  {/* Tier indicator */}
                  <text
                    y={-size / 2 - 5}
                    textAnchor="middle"
                    className="tier-label"
                    fontSize="8"
                    fill="#6b7280"
                  >
                    {node.tier}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="graph-sidebar">
          <div className="graph-legend">
            <h3>Legend</h3>
            <div className="legend-section">
              <h4>Status</h4>
              <div className="legend-items">
                {Object.entries(STATUS_COLORS).map(([status, color]) => (
                  <div key={status} className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: color }}></span>
                    <span className="legend-label">{status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="legend-section">
              <h4>Dependencies</h4>
              <div className="legend-items">
                <div className="legend-item">
                  <span className="legend-line solid"></span>
                  <span className="legend-label">Hard (critical)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-line dashed"></span>
                  <span className="legend-label">Soft (degraded)</span>
                </div>
              </div>
            </div>
            <div className="legend-section">
              <h4>Node Size</h4>
              <div className="legend-items">
                <div className="legend-item">
                  <span className="legend-circle large"></span>
                  <span className="legend-label">Tier-1</span>
                </div>
                <div className="legend-item">
                  <span className="legend-circle medium"></span>
                  <span className="legend-label">Tier-2</span>
                </div>
                <div className="legend-item">
                  <span className="legend-circle small"></span>
                  <span className="legend-label">Tier-3/4</span>
                </div>
              </div>
            </div>
          </div>

          <div className="graph-stats">
            <h3>Statistics</h3>
            <div className="stat-item">
              <span className="stat-label">Total Services:</span>
              <span className="stat-value">{filteredNodes.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Dependencies:</span>
              <span className="stat-value">{filteredEdges.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Healthy:</span>
              <span className="stat-value healthy">
                {filteredNodes.filter(n => n.status === 'healthy').length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Unhealthy:</span>
              <span className="stat-value unhealthy">
                {filteredNodes.filter(n => n.status !== 'healthy').length}
              </span>
            </div>
          </div>

          {(selectedNode || hoveredNode) && (
            <div className="node-details">
              <h3>Service Details</h3>
              {(() => {
                const node = filteredNodes.find(n => n.id === (selectedNode || hoveredNode));
                if (!node) return null;
                const service = services.find(s => s.id === node.id);
                if (!service) return null;

                return (
                  <div className="node-detail-content">
                    <h4>{service.displayName}</h4>
                    <StatusBadge status={service.status} />
                    <p><strong>Type:</strong> {service.type}</p>
                    <p><strong>Tier:</strong> {service.tier}</p>
                    <p><strong>Team:</strong> {service.ownerTeam.name}</p>
                    <p><strong>Upstream:</strong> {service.upstreamDependencies.length}</p>
                    <p><strong>Downstream:</strong> {service.downstreamDependencies.length}</p>
                    <button
                      className="view-details-button"
                      onClick={() => onServiceClick(service)}
                    >
                      View Full Details
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

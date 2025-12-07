/**
 * Trust Graph Component
 *
 * Visualizes the Web of Trust network with all trust attestations.
 * Uses SVG with a simple force-directed layout simulation.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { UserDocument } from '../schema/userDocument';
import type { TrustAttestation } from '../schema/identity';

interface TrustNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isCurrentUser: boolean;
  trustLevel: 'self' | 'direct' | 'indirect';
}

interface TrustEdge {
  source: string;
  target: string;
  level: TrustAttestation['level'];
  bidirectional: boolean;
}

export interface TrustGraphProps {
  /** Current user's document */
  userDoc?: UserDocument;
  /** Map of external user documents by DID */
  externalDocs?: Map<string, UserDocument>;
  /** Width of the graph (default: 100%) */
  width?: number | string;
  /** Height of the graph (default: 400px) */
  height?: number;
  /** Callback when a node is clicked */
  onNodeClick?: (did: string) => void;
}

/**
 * Extract nodes and edges from user documents
 */
function buildGraph(
  userDoc: UserDocument | undefined,
  externalDocs: Map<string, UserDocument>
): { nodes: TrustNode[]; edges: TrustEdge[] } {
  if (!userDoc) {
    return { nodes: [], edges: [] };
  }

  const nodesMap = new Map<string, TrustNode>();
  const edgesMap = new Map<string, TrustEdge>();
  const centerX = 300;
  const centerY = 200;

  // Add current user as center node
  nodesMap.set(userDoc.did, {
    id: userDoc.did,
    label: userDoc.profile?.displayName || userDoc.did.substring(0, 16) + '...',
    x: centerX,
    y: centerY,
    vx: 0,
    vy: 0,
    isCurrentUser: true,
    trustLevel: 'self',
  });

  // Process trust given by current user
  for (const [trusteeDid, attestation] of Object.entries(userDoc.trustGiven || {})) {
    // Add trustee node if not exists
    if (!nodesMap.has(trusteeDid)) {
      const externalDoc = externalDocs.get(trusteeDid);
      nodesMap.set(trusteeDid, {
        id: trusteeDid,
        label: externalDoc?.profile?.displayName || trusteeDid.substring(0, 16) + '...',
        x: centerX + (Math.random() - 0.5) * 200,
        y: centerY + (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
        isCurrentUser: false,
        trustLevel: 'direct',
      });
    }

    // Add edge
    const edgeKey = [userDoc.did, trusteeDid].sort().join('->');
    const existing = edgesMap.get(edgeKey);
    if (existing) {
      existing.bidirectional = true;
    } else {
      edgesMap.set(edgeKey, {
        source: userDoc.did,
        target: trusteeDid,
        level: attestation.level,
        bidirectional: false,
      });
    }
  }

  // Process trust received by current user
  for (const [trusterDid, attestation] of Object.entries(userDoc.trustReceived || {})) {
    // Add truster node if not exists
    if (!nodesMap.has(trusterDid)) {
      const externalDoc = externalDocs.get(trusterDid);
      nodesMap.set(trusterDid, {
        id: trusterDid,
        label: externalDoc?.profile?.displayName || trusterDid.substring(0, 16) + '...',
        x: centerX + (Math.random() - 0.5) * 200,
        y: centerY + (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
        isCurrentUser: false,
        trustLevel: 'direct',
      });
    }

    // Add edge
    const edgeKey = [trusterDid, userDoc.did].sort().join('->');
    const existing = edgesMap.get(edgeKey);
    if (existing) {
      existing.bidirectional = true;
    } else {
      edgesMap.set(edgeKey, {
        source: trusterDid,
        target: userDoc.did,
        level: attestation.level,
        bidirectional: false,
      });
    }
  }

  // Process external documents for 2nd-degree connections
  for (const [did, extDoc] of externalDocs) {
    // Add edges from external users' trustGiven (outgoing trust)
    for (const [trusteeDid, attestation] of Object.entries(extDoc.trustGiven || {})) {
      // Skip if it's the current user (already handled above)
      if (trusteeDid === userDoc.did) continue;

      // Add node if it's a new 2nd-degree connection
      if (!nodesMap.has(trusteeDid)) {
        const targetDoc = externalDocs.get(trusteeDid);
        nodesMap.set(trusteeDid, {
          id: trusteeDid,
          label: targetDoc?.profile?.displayName || trusteeDid.substring(0, 16) + '...',
          x: centerX + (Math.random() - 0.5) * 300,
          y: centerY + (Math.random() - 0.5) * 300,
          vx: 0,
          vy: 0,
          isCurrentUser: false,
          trustLevel: 'indirect',
        });
      }

      // Add edge if both nodes exist
      if (nodesMap.has(did) && nodesMap.has(trusteeDid)) {
        const edgeKey = [did, trusteeDid].sort().join('->');
        const existing = edgesMap.get(edgeKey);
        if (existing) {
          // Check if this creates a bidirectional edge
          if (existing.source === trusteeDid && existing.target === did) {
            existing.bidirectional = true;
          }
        } else {
          edgesMap.set(edgeKey, {
            source: did,
            target: trusteeDid,
            level: attestation.level,
            bidirectional: false,
          });
        }
      }
    }

    // Add edges from external users' trustReceived (incoming trust)
    for (const [trusterDid, attestation] of Object.entries(extDoc.trustReceived || {})) {
      // Skip if it's the current user (already handled above)
      if (trusterDid === userDoc.did) continue;

      // Add node if it's a new 2nd-degree connection
      if (!nodesMap.has(trusterDid)) {
        const trusterDoc = externalDocs.get(trusterDid);
        nodesMap.set(trusterDid, {
          id: trusterDid,
          label: trusterDoc?.profile?.displayName || trusterDid.substring(0, 16) + '...',
          x: centerX + (Math.random() - 0.5) * 300,
          y: centerY + (Math.random() - 0.5) * 300,
          vx: 0,
          vy: 0,
          isCurrentUser: false,
          trustLevel: 'indirect',
        });
      }

      // Add edge if both nodes exist (direction: truster -> did)
      if (nodesMap.has(trusterDid) && nodesMap.has(did)) {
        const edgeKey = [trusterDid, did].sort().join('->');
        const existing = edgesMap.get(edgeKey);
        if (existing) {
          // Check if this creates a bidirectional edge
          if (existing.source === did && existing.target === trusterDid) {
            existing.bidirectional = true;
          }
        } else {
          edgesMap.set(edgeKey, {
            source: trusterDid,
            target: did,
            level: attestation.level,
            bidirectional: false,
          });
        }
      }
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
  };
}

/**
 * Simple force-directed layout simulation
 */
function simulateForces(
  nodes: TrustNode[],
  edges: TrustEdge[],
  width: number,
  height: number,
  iterations: number = 50
): TrustNode[] {
  const result = nodes.map(n => ({ ...n }));

  const centerX = width / 2;
  const centerY = height / 2;
  const repulsionStrength = 25000;      // Much stronger repulsion to push nodes apart
  const attractionStrength = 0.02;       // Weaker attraction along edges
  const centerPull = 0.005;              // Weaker center pull
  const damping = 0.85;
  const minDistance = 120;               // Minimum distance between nodes

  for (let i = 0; i < iterations; i++) {
    // Repulsion between all nodes (with minimum distance enforcement)
    for (let a = 0; a < result.length; a++) {
      for (let b = a + 1; b < result.length; b++) {
        let dx = result[b].x - result[a].x;
        let dy = result[b].y - result[a].y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        // If nodes are too close, add random jitter to separate them
        if (dist < 1) {
          dx = (Math.random() - 0.5) * 10;
          dy = (Math.random() - 0.5) * 10;
          dist = Math.sqrt(dx * dx + dy * dy);
        }

        // Stronger force when below minimum distance
        let force = repulsionStrength / (dist * dist);
        if (dist < minDistance) {
          force *= 3; // Triple the repulsion force when too close
        }

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        result[a].vx -= fx;
        result[a].vy -= fy;
        result[b].vx += fx;
        result[b].vy += fy;
      }
    }

    // Attraction along edges (only when distance > ideal distance)
    const idealEdgeLength = 180;
    for (const edge of edges) {
      const source = result.find(n => n.id === edge.source);
      const target = result.find(n => n.id === edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only attract if beyond ideal distance
      if (dist > idealEdgeLength) {
        const strength = (dist - idealEdgeLength) * attractionStrength;
        const fx = (dx / dist) * strength;
        const fy = (dy / dist) * strength;

        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // Pull towards center
    for (const node of result) {
      node.vx += (centerX - node.x) * centerPull;
      node.vy += (centerY - node.y) * centerPull;
    }

    // Apply velocities with damping
    for (const node of result) {
      // Keep current user at center
      if (node.isCurrentUser) {
        node.x = centerX;
        node.y = centerY;
        node.vx = 0;
        node.vy = 0;
        continue;
      }

      node.x += node.vx;
      node.y += node.vy;
      node.vx *= damping;
      node.vy *= damping;

      // Keep within bounds
      const padding = 50;
      node.x = Math.max(padding, Math.min(width - padding, node.x));
      node.y = Math.max(padding, Math.min(height - padding, node.y));
    }
  }

  return result;
}

export function TrustGraph({
  userDoc,
  externalDocs = new Map(),
  width = '100%',
  height = 400,
  onNodeClick,
}: TrustGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Measure SVG container
  useEffect(() => {
    if (typeof width === 'number') {
      setDimensions({ width, height });
      return;
    }

    const measure = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width || 600, height });
      }
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [width, height]);

  // Build and layout graph
  const { nodes, edges } = useMemo(() => {
    const graph = buildGraph(userDoc, externalDocs);
    const layoutedNodes = simulateForces(
      graph.nodes,
      graph.edges,
      dimensions.width,
      dimensions.height,
      200  // More iterations for better convergence
    );
    return { nodes: layoutedNodes, edges: graph.edges };
  }, [userDoc, externalDocs, dimensions.width, dimensions.height]);

  const handleNodeClick = useCallback((did: string) => {
    setSelectedNode(did);
    onNodeClick?.(did);
  }, [onNodeClick]);

  // Get node color based on trust level
  const getNodeColor = (node: TrustNode) => {
    if (node.isCurrentUser) return '#22c55e'; // green-500
    switch (node.trustLevel) {
      case 'direct': return '#3b82f6'; // blue-500
      case 'indirect': return '#a855f7'; // purple-500
      default: return '#6b7280'; // gray-500
    }
  };

  // Get edge color based on level
  const getEdgeColor = (edge: TrustEdge) => {
    return edge.level === 'verified' ? '#22c55e' : '#f59e0b'; // green vs amber
  };

  if (!userDoc) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Kein Benutzerdokument geladen
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Keine Trust-Verbindungen vorhanden
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Legend */}
      <div className="absolute top-2 right-2 bg-base-300/90 rounded-lg p-2 text-xs space-y-1 z-10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Du (Zentrum)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Direkte Verbindung</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span>2. Grad</span>
        </div>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-base-100">
          <div className="w-4 h-0.5 bg-green-500" />
          <span>Verified</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-amber-500" />
          <span>Endorsed</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="16" height="10" className="text-gray-400">
            <line x1="0" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="2" />
            <polygon points="16,5 10,2 10,8" fill="currentColor" />
          </svg>
          <span>Einseitig</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="16" height="10" className="text-gray-400">
            <line x1="4" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="2" />
            <polygon points="0,5 6,2 6,8" fill="currentColor" />
            <polygon points="16,5 10,2 10,8" fill="currentColor" />
          </svg>
          <span>Gegenseitig</span>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-2 left-2 bg-base-300/90 rounded-lg p-2 text-xs z-10">
        <div><span className="text-gray-500">Knoten:</span> {nodes.length}</div>
        <div><span className="text-gray-500">Verbindungen:</span> {edges.length}</div>
        <div>
          <span className="text-gray-500">Gegenseitig:</span>{' '}
          {edges.filter(e => e.bidirectional).length}
        </div>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-base-300 rounded-lg"
        style={{ minHeight: height }}
      >
        {/* Arrowhead markers */}
        <defs>
          <marker
            id="arrowhead-green"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
          </marker>
          <marker
            id="arrowhead-amber"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
          </marker>
          <marker
            id="arrowhead-green-reverse"
            markerWidth="10"
            markerHeight="7"
            refX="1"
            refY="3.5"
            orient="auto"
          >
            <polygon points="10 0, 0 3.5, 10 7" fill="#22c55e" />
          </marker>
          <marker
            id="arrowhead-amber-reverse"
            markerWidth="10"
            markerHeight="7"
            refX="1"
            refY="3.5"
            orient="auto"
          >
            <polygon points="10 0, 0 3.5, 10 7" fill="#f59e0b" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const source = nodes.find(n => n.id === edge.source);
          const target = nodes.find(n => n.id === edge.target);
          if (!source || !target) return null;

          const color = getEdgeColor(edge);
          const markerId = edge.level === 'verified' ? 'arrowhead-green' : 'arrowhead-amber';
          const markerIdReverse = edge.level === 'verified' ? 'arrowhead-green-reverse' : 'arrowhead-amber-reverse';

          // Calculate edge endpoint offset (don't overlap with node circle)
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const nodeRadius = 24;
          const offsetX = (dx / dist) * nodeRadius;
          const offsetY = (dy / dist) * nodeRadius;

          return (
            <g key={i}>
              <line
                x1={source.x + offsetX}
                y1={source.y + offsetY}
                x2={target.x - offsetX}
                y2={target.y - offsetY}
                stroke={color}
                strokeWidth={edge.bidirectional ? 3 : 2}
                strokeOpacity={0.7}
                markerEnd={`url(#${markerId})`}
                markerStart={edge.bidirectional ? `url(#${markerIdReverse})` : undefined}
              />
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isHovered = hoveredNode === node.id;
          const isSelected = selectedNode === node.id;
          const radius = node.isCurrentUser ? 28 : 24;

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => handleNodeClick(node.id)}
            >
              {/* Glow effect for selected/hovered */}
              {(isHovered || isSelected) && (
                <circle
                  r={radius + 6}
                  fill="none"
                  stroke={getNodeColor(node)}
                  strokeWidth={2}
                  strokeOpacity={0.5}
                />
              )}

              {/* Main circle */}
              <circle
                r={radius}
                fill={getNodeColor(node)}
                fillOpacity={0.9}
                stroke={isSelected ? '#fff' : 'transparent'}
                strokeWidth={2}
              />

              {/* Avatar initial */}
              <text
                textAnchor="middle"
                dy="0.35em"
                fill="white"
                fontSize={node.isCurrentUser ? 14 : 12}
                fontWeight="bold"
              >
                {node.label.charAt(0).toUpperCase()}
              </text>

              {/* Label (shown on hover) */}
              {isHovered && (
                <g>
                  <rect
                    x={-60}
                    y={radius + 8}
                    width={120}
                    height={24}
                    rx={4}
                    fill="rgba(0,0,0,0.8)"
                  />
                  <text
                    textAnchor="middle"
                    y={radius + 24}
                    fill="white"
                    fontSize={11}
                  >
                    {node.label.length > 18 ? node.label.substring(0, 18) + '...' : node.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Selected node details */}
      {selectedNode && (
        <div className="mt-2 bg-base-300 rounded-lg p-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="font-medium">
              {nodes.find(n => n.id === selectedNode)?.label}
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="btn btn-xs btn-ghost"
            >
              ✕
            </button>
          </div>
          <div className="text-xs text-gray-500 font-mono mt-1 truncate">
            {selectedNode}
          </div>

          {/* Trust details for selected node */}
          {selectedNode !== userDoc.did && (
            <div className="mt-2 space-y-1 text-xs">
              {userDoc.trustGiven?.[selectedNode] && (
                <div className="flex items-center gap-2">
                  <span className="badge badge-sm badge-success">Du vertraust</span>
                  <span className="text-gray-500">
                    ({userDoc.trustGiven[selectedNode].level})
                  </span>
                </div>
              )}
              {userDoc.trustReceived?.[selectedNode] && (
                <div className="flex items-center gap-2">
                  <span className="badge badge-sm badge-info">Vertraut dir</span>
                  <span className="text-gray-500">
                    ({userDoc.trustReceived[selectedNode].level})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TrustGraph;
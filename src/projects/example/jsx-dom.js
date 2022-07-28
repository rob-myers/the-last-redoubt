/** @jsx React.createElement */
import React from "jsx-dom-cjs";

/**
 * @param {SVGElement} root
 * @param {import('../graph/floor-graph').floorGraphClass} graph 
 */
export function svgNavGraph(root, graph) {
  
  const nodeMetas = graph.nodesArray.map((_, i) => graph.nodeToMeta[i]);

  root.append(
    // @ts-ignore
    ...graph.nodesArray.flatMap(({ id, centroid, neighbours }, _, nodes) =>
      neighbours.map(nid => (
        <path
          key={`${id}-${nid}`}
          className="edge"
          d={`M ${centroid.x}, ${centroid.y} L ${nodes[nid].centroid.x},${nodes[nid].centroid.y}`}
        />
        // https://github.com/proteriax/jsx-dom/issues/80
        // <line
        //   key={`${id}-${nid}`}
        //   className="edge"
        //   x1={centroid.x}
        //   y1={centroid.y}
        //   x2={nodes[nid].centroid.x}
        //   y2={nodes[nid].centroid.y}
        // />
      ))
    ),
    // @ts-ignore
    ...graph.nodesArray.map(({ vertexIds }, nodeId) =>
      <polygon
        key={nodeId}
        className="navtri"
        points={`${vertexIds.map(id => graph.vectors[id])}`}
        stroke="#00000044"
        strokeWidth={0.1}
        fill={
          graph.nodeToMeta[nodeId].doorId >= 0
            ? graph.nodeToMeta[nodeId].roomId >= 0 ? '#ffff0066' : '#ff000066'
            : graph.nodeToMeta[nodeId].roomId >= 0 ? '#00ff0066' : 'none'}
      />
    ),
    // @ts-ignore
    ...graph.nodesArray.map(({ id, centroid }, i) =>
      <circle
        key={id}
        className="node"
        cx={centroid.x}
        cy={centroid.y}
        r={2}
      >
        <title>
          {i}:{' '}
          {JSON.stringify(nodeMetas[i])}
        </title>
      </circle>
    )
  );

}

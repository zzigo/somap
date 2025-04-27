import { WebGLRenderer, Scene, PerspectiveCamera } from "three";
import ForceGraph3D from "3d-force-graph";
import SpriteText from "three-spritetext";

console.log("Initializing 3D Force Graph...");

let graph;

async function initGraph() {
  try {
    // Initialize the 3D force graph
    graph = ForceGraph3D()(document.getElementById("graph-container"))
      .backgroundColor("rgba(0,0,0,0)")
      .nodeLabel("id")
      .nodeAutoColorBy("group")
      .linkDirectionalParticles(3)
      .linkDirectionalParticleSpeed(0.01)
      .linkWidth(1.2)
      .nodeRelSize(6);

    // Set initial data
    const data = {
      nodes: [],
      links: [],
    };

    graph.graphData(data);
    console.log("Graph initialized successfully");

    return graph;
  } catch (error) {
    console.error("Error initializing graph:", error);
    throw error;
  }
}

async function updateGraphData(nodes, links) {
  if (!graph) {
    await initGraph();
  }
  graph.graphData({ nodes, links });
}

export async function fetchAndDisplayData() {
  try {
    // Initialize graph first
    if (!graph) {
      await initGraph();
    }

    // Your data fetching logic here
    // For now using empty data
    const data = {
      nodes: [],
      links: [],
    };

    graph.graphData(data);
  } catch (error) {
    console.error("Error fetching and displaying data:", error);
  }
}

// Initialize when document is ready
document.addEventListener("DOMContentLoaded", () => {
  fetchAndDisplayData().catch(console.error);
});

export { initGraph, updateGraphData };

<template>
  <div ref="containerRef" class="vis-container">
    <div
      v-for="label in nodeLabels"
      :key="label.id"
      class="node-label"
      :style="{
        left: label.x + 'px',
        top: label.y + 'px',
        display: showLabels ? 'block' : 'none',
      }"
    >
      {{ label.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, computed } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const props = defineProps({
  graphData: {
    type: Object,
    required: true
  },
  visControls: {
    type: Object,
    required: true
  }
});

const containerRef = ref(null);
const showLabels = computed(() => props.visControls.showLabels);
const showGrid = computed(() => props.visControls.showGrid);
const nodeSizeScale = computed(() => props.visControls.nodeSizeScale);
const layerSpacing = computed(() => props.visControls.layerSpacing);
const edgeOpacity = computed(() => props.visControls.edgeOpacity);
const neighborAttraction = computed(() => props.visControls.neighborAttraction);
const rotationSpeed = computed(() => props.visControls.rotationSpeed);

const nodeLabels = ref([]);

// Generate a color palette for root nodes
const generateColor = (index, total) => {
  return new THREE.Color().setHSL(index / total, 0.7, 0.5);
};

const threeObjects = ref({
  nodeGroup: null,
  nodeObjects: {},
  edgeObjects: [],
  scene: null,
  camera: null,
  renderer: null,
});

// Initialize the 3D visualization
const initializeNetwork = () => {
  if (!containerRef.value) return;
  const container = containerRef.value;

  // Find root nodes and assign colors
  const targets = new Set(props.graphData.edges.map(e => e.target));
  const rootNodes = props.graphData.nodes.filter(node => !targets.has(node.id));
  
  // Create color map starting from roots
  const nodeColors = new Map();
  rootNodes.forEach((node, index) => {
    nodeColors.set(node.id, generateColor(index, rootNodes.length));
  });
  
  // Propagate colors through edges
  props.graphData.edges.forEach(({ source, target }) => {
    const parentColor = nodeColors.get(source);
    if (parentColor) {
      const childColor = new THREE.Color(parentColor);
      childColor.offsetHSL(0.05 * Math.random() - 0.025, 0, 0);
      nodeColors.set(target, childColor);
    }
  });

  // Compute levels for nodes if not defined
  const levelMap = {};
  props.graphData.edges.forEach(({ source, target }) => {
    levelMap[target] = (levelMap[source] || 0) + 1;
  });
  
  // Apply levels to nodes that don't have them
  props.graphData.nodes.forEach((node) => {
    if (!node.level) {
      node.level = levelMap[node.id] || 0;
    }
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
  
  const camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, 0.1, 1000);
  camera.position.set(0, 10, 30);
  
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.offsetWidth, container.offsetHeight);
  container.appendChild(renderer.domElement);
  
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = rotationSpeed.value > 0;
  controls.autoRotateSpeed = rotationSpeed.value * 2;
  
  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // Add directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 10, 10);
  scene.add(directionalLight);
  
  // Add grid helper
  const gridHelper = new THREE.GridHelper(100, 20, 0x555555, 0x333333);
  gridHelper.position.y = -10;
  scene.add(gridHelper);
  gridHelper.visible = showGrid.value;
  
  watch(showGrid, (value) => {
    gridHelper.visible = value;
  });
  
  watch(rotationSpeed, (value) => {
    controls.autoRotate = value > 0;
    controls.autoRotateSpeed = value * 2;
  });
  
  const nodeGroup = new THREE.Group();
  scene.add(nodeGroup);
  
  // Create nodes
  const nodeObjects = {};
  
  props.graphData.nodes.forEach((node) => {
    // Use the color from nodeColors map or default to white
    const color = nodeColors.get(node.id) || new THREE.Color(node.color || 0xffffff);
    const size = (node.size || 5) / 10 * nodeSizeScale.value;
    
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color.clone().multiplyScalar(0.2),
      metalness: 0.8,
      roughness: 0.2
    });
    
    const sphere = new THREE.Mesh(geometry, material);
    
    // Position based on level in a spiral pattern
    const level = node.level || 0;
    const angle = level * 0.5 + Math.random() * Math.PI * 0.25;
    const radius = (level + 1) * 5;
    const height = level * layerSpacing.value;
    
    const x = Math.cos(angle) * radius;
    const y = height;
    const z = Math.sin(angle) * radius;
    
    sphere.position.set(x, y, z);
    sphere.userData = {
      id: node.id,
      label: node.label,
      level: level,
      velocity: new THREE.Vector3(0, 0, 0),
      force: new THREE.Vector3(0, 0, 0)
    };
    
    nodeGroup.add(sphere);
    nodeObjects[node.id] = sphere;
  });
  
  // Create edges
  const createEdges = () => {
    // Remove existing edges
    nodeGroup.children.forEach(child => {
      if (child.userData && child.userData.isEdge) {
        child.geometry.dispose();
        child.material.dispose();
        nodeGroup.remove(child);
      }
    });
    
    props.graphData.edges.forEach(({ source, target }) => {
      const sourceNode = nodeObjects[source];
      const targetNode = nodeObjects[target];
      
      if (!sourceNode || !targetNode) return;
      
      const sourcePos = sourceNode.position;
      const targetPos = targetNode.position;
      
      // Use source node's color for the edge
      const edgeColor = new THREE.Color().copy(sourceNode.material.color);
      
      const points = [sourcePos, targetPos];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      const material = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: edgeOpacity.value
      });
      
      const line = new THREE.Line(geometry, material);
      line.userData = { isEdge: true };
      
      nodeGroup.add(line);
    });
  };
  
  createEdges();
  
  // Update node labels
  const updateLabels = () => {
    nodeLabels.value = Object.values(nodeObjects).map(node => {
      const position = new THREE.Vector3();
      node.getWorldPosition(position);
      position.project(camera);
      
      const x = (position.x * 0.5 + 0.5) * container.offsetWidth;
      const y = (-position.y * 0.5 + 0.5) * container.offsetHeight;
      
      return {
        id: node.userData.id,
        text: node.userData.label,
        x,
        y
      };
    });
  };
  
  // Physics simulation
  const simulatePhysics = () => {
    Object.values(nodeObjects).forEach(node => {
      node.userData.force.set(0, 0, 0);
      
      // Repulsion from other nodes
      Object.values(nodeObjects).forEach(otherNode => {
        if (node !== otherNode) {
          const diff = node.position.clone().sub(otherNode.position);
          const dist = diff.length();
          if (dist < 10) {
            const force = diff.normalize().multiplyScalar(1 / (dist * dist));
            node.userData.force.add(force);
          }
        }
      });
      
      // Attraction to connected nodes
      props.graphData.edges.forEach(({ source, target }) => {
        if (source === node.userData.id || target === node.userData.id) {
          const otherNode = nodeObjects[source === node.userData.id ? target : source];
          if (otherNode) {
            const diff = otherNode.position.clone().sub(node.position);
            const dist = diff.length();
            // Use neighborAttraction parameter to control strength
            const attraction = diff.normalize().multiplyScalar(dist * neighborAttraction.value * 0.05);
            node.userData.force.add(attraction);
          }
        }
      });
      
      // Keep nodes at their level's height
      const targetY = node.userData.level * layerSpacing.value;
      const yDiff = targetY - node.position.y;
      node.userData.force.y += yDiff * 0.05;
      
      // Update velocity and position
      node.userData.velocity.add(node.userData.force.multiplyScalar(0.1));
      node.userData.velocity.multiplyScalar(0.9); // Damping
      node.position.add(node.userData.velocity);
    });
    
    // Recreate edges to match new positions
    createEdges();
  };
  
  // Animate and render
  let animationFrameId;
  const animate = () => {
    simulatePhysics();
    updateLabels();
    controls.update();
    renderer.render(scene, camera);
    animationFrameId = requestAnimationFrame(animate);
  };
  animate();
  
  // Window resize handler
  const handleResize = () => {
    if (!camera || !renderer || !container) return;
    
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.offsetWidth, container.offsetHeight);
  };
  
  window.addEventListener('resize', handleResize);
  
  // Store references for cleanup
  threeObjects.value = {
    nodeGroup,
    scene,
    camera,
    renderer,
    nodeObjects,
    handleResize, // Store the reference to handleResize function
    cleanup: () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (renderer) {
        try {
          container.removeChild(renderer.domElement);
        } catch (e) {
          console.warn("Error removing renderer element:", e);
        }
      }
      // Remove event listener
      window.removeEventListener('resize', handleResize);
      
      // Dispose of ThreeJS resources
      scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      
      renderer.dispose();
    }
  };
  
  // Watch for control changes
  watch(nodeSizeScale, (value) => {
    if (!nodeObjects) return;
    Object.values(nodeObjects).forEach(node => {
      node.scale.setScalar(value);
    });
  });
  
  watch(layerSpacing, (value) => {
    if (!nodeObjects) return;
    // Force update will handle adjusting heights
  });
};

// Initialize when component mounts
onMounted(() => {
  initializeNetwork();
});

// Clean up when component is unmounted
onBeforeUnmount(() => {
  console.log("[ColorNeighborsVis] Component unmounting, cleaning up resources");
  window.removeEventListener('keydown', handleKeyDown);
  
  // Safely clean up Three.js resources
  try {
    if (threeObjects.value && threeObjects.value.cleanup) {
      threeObjects.value.cleanup();
    }
  } catch (err) {
    console.error("[ColorNeighborsVis] Error during cleanup:", err);
  }
});
</script>

<style scoped>
.vis-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #111;
}

.node-label {
  position: absolute;
  color: white;
  pointer-events: none;
  font-size: 14px;
  font-family: "IBM Plex Mono", monospace;
}
</style> 
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
const nodeSizeScale = computed(() => props.visControls.nodeSizeScale);
const edgeOpacity = computed(() => props.visControls.edgeOpacity);
const neighborAttraction = computed(() => props.visControls.neighborAttraction);

const nodeLabels = ref([]);
const threeObjects = ref({
  nodeGroup: null,
  nodeObjects: {},
  scene: null,
  camera: null,
  renderer: null,
});

// Initialize the 2D visualization
const initializeNetwork = () => {
  if (!containerRef.value) return;
  const container = containerRef.value;
  
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x121212);
  
  // Use orthographic camera for 2D view
  const camera = new THREE.OrthographicCamera(
    container.offsetWidth / -2, container.offsetWidth / 2,
    container.offsetHeight / 2, container.offsetHeight / -2,
    0.1, 1000
  );
  camera.position.z = 10;
  
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.offsetWidth, container.offsetHeight);
  container.appendChild(renderer.domElement);
  
  // Basic controls, but disable rotation to maintain 2D feel
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false;
  controls.enableDamping = true;
  controls.screenSpacePanning = true;
  
  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);
  
  const nodeGroup = new THREE.Group();
  scene.add(nodeGroup);
  
  // Create nodes as flat circles
  const nodeObjects = {};
  
  // Calculate center of mass for nodes
  const centerX = props.graphData.nodes.reduce((sum, node) => sum + (node.x || 0), 0) / props.graphData.nodes.length;
  const centerY = props.graphData.nodes.reduce((sum, node) => sum + (node.y || 0), 0) / props.graphData.nodes.length;
  
  // Create flat disc material
  const discMaterial = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    transparent: true,
  });
  
  props.graphData.nodes.forEach((node) => {
    const color = new THREE.Color(node.color || 0xffffff);
    const radius = (node.size || 3) * nodeSizeScale.value / 10;
    
    // Clone the material for each node to have individual colors
    const material = discMaterial.clone();
    material.color = color;
    
    // Create a flat circle
    const geometry = new THREE.CircleGeometry(radius, 32);
    const disc = new THREE.Mesh(geometry, material);
    
    // Initial positions - either use existing or random placement
    let x = (node.x || (Math.random() * 100 - 50)) - centerX;
    let y = (node.y || (Math.random() * 100 - 50)) - centerY;
    
    disc.position.set(x, y, 0);
    disc.userData = {
      id: node.id,
      label: node.label,
      velocity: new THREE.Vector2(0, 0),
      force: new THREE.Vector2(0, 0)
    };
    
    nodeGroup.add(disc);
    nodeObjects[node.id] = disc;
  });
  
  // Create edges as flat lines
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
      
      const points = [
        new THREE.Vector3(sourceNode.position.x, sourceNode.position.y, 0),
        new THREE.Vector3(targetNode.position.x, targetNode.position.y, 0)
      ];
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      // Use a gradient color between source and target
      const sourceMaterial = sourceNode.material;
      const targetMaterial = targetNode.material;
      const edgeColor = new THREE.Color(sourceMaterial.color.getHex());
      
      const material = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: edgeOpacity.value,
        linewidth: 1,
      });
      
      const line = new THREE.Line(geometry, material);
      line.userData = { isEdge: true };
      
      nodeGroup.add(line);
    });
  };
  
  createEdges();
  
  // Force-directed layout simulation
  const simulateForces = () => {
    // Constants for the force simulation
    const repulsionStrength = 500;
    const attractionStrength = 0.05 * neighborAttraction.value;
    const centerAttraction = 0.01;
    const damping = 0.85;
    
    Object.values(nodeObjects).forEach(node => {
      node.userData.force = new THREE.Vector2(0, 0);
      
      // Repulsion between nodes
      Object.values(nodeObjects).forEach(otherNode => {
        if (node !== otherNode) {
          const dx = node.position.x - otherNode.position.x;
          const dy = node.position.y - otherNode.position.y;
          const distSq = dx * dx + dy * dy;
          const dist = Math.sqrt(distSq);
          
          if (dist > 0 && dist < 100) {
            const force = repulsionStrength / distSq;
            node.userData.force.x += dx / dist * force;
            node.userData.force.y += dy / dist * force;
          }
        }
      });
      
      // Attraction along edges
      props.graphData.edges.forEach(({ source, target }) => {
        if (source === node.userData.id || target === node.userData.id) {
          const otherNode = nodeObjects[source === node.userData.id ? target : source];
          if (otherNode) {
            const dx = otherNode.position.x - node.position.x;
            const dy = otherNode.position.y - node.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            node.userData.force.x += dx * attractionStrength;
            node.userData.force.y += dy * attractionStrength;
          }
        }
      });
      
      // Slight attraction to center to keep graph centered
      node.userData.force.x -= node.position.x * centerAttraction;
      node.userData.force.y -= node.position.y * centerAttraction;
      
      // Update velocity and position
      if (!node.userData.velocity) {
        node.userData.velocity = new THREE.Vector2(0, 0);
      }
      
      node.userData.velocity.x = (node.userData.velocity.x + node.userData.force.x) * damping;
      node.userData.velocity.y = (node.userData.velocity.y + node.userData.force.y) * damping;
      
      node.position.x += node.userData.velocity.x;
      node.position.y += node.userData.velocity.y;
    });
    
    createEdges();
  };
  
  // Update node labels for display
  const updateLabels = () => {
    nodeLabels.value = Object.values(nodeObjects).map(node => {
      const position = new THREE.Vector3(node.position.x, node.position.y, 0);
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
  
  // Animation loop
  let animationFrameId;
  const animate = () => {
    simulateForces();
    updateLabels();
    controls.update();
    renderer.render(scene, camera);
    animationFrameId = requestAnimationFrame(animate);
  };
  animate();
  
  // Resize handler
  const handleResize = () => {
    if (!camera || !renderer || !container) return;
    
    // Update camera frustum
    camera.left = container.offsetWidth / -2;
    camera.right = container.offsetWidth / 2;
    camera.top = container.offsetHeight / 2;
    camera.bottom = container.offsetHeight / -2;
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
    handleResize,
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
};

// Initialize when component mounts
onMounted(() => {
  initializeNetwork();
});

// Clean up when component is unmounted
onBeforeUnmount(() => {
  console.log("[FlatVis] Component unmounting, cleaning up resources");
  window.removeEventListener('keydown', handleKeyDown);
  
  // Safely clean up Three.js resources
  try {
    if (threeObjects.value && threeObjects.value.cleanup) {
      threeObjects.value.cleanup();
    }
  } catch (err) {
    console.error("[FlatVis] Error during cleanup:", err);
  }
});
</script>

<style scoped>
.vis-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #121212;
}

.node-label {
  position: absolute;
  color: white;
  pointer-events: none;
  font-size: 12px;
  font-family: "IBM Plex Mono", monospace;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 4px;
  border-radius: 2px;
}
</style> 
<template>
  <div ref="containerRef" class="vis-container">
    <div
      v-for="label in nodeLabels"
      :key="label.id"
      class="node-label"
      :style="{
        left: label.x + 'px',
        top: label.y + 'px',
        display: props.visControls.showLabels ? 'block' : 'none',
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
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

const props = defineProps({
  graphData: {
    type: Object,
    required: true
  },
  visControls: {
    type: Object,
    required: true,
    default: () => ({
      rotationSpeed: 0.5,
      nodeSizeScale: 1,
      neighborAttraction: 1,
      showLabels: true
    })
  }
});

const emit = defineEmits(['node-selected']);

const containerRef = ref(null);
const showLabels = computed(() => props.visControls.showLabels !== undefined ? props.visControls.showLabels : true);
const showGrid = computed(() => props.visControls.showGrid !== undefined ? props.visControls.showGrid : false);
const nodeSizeScale = computed(() => props.visControls.nodeSizeScale !== undefined ? props.visControls.nodeSizeScale : 1);
const layerSpacing = computed(() => props.visControls.layerSpacing !== undefined ? props.visControls.layerSpacing : 2);
const edgeOpacity = computed(() => props.visControls.edgeOpacity !== undefined ? props.visControls.edgeOpacity : 0.5);
const edgeThickness = computed(() => props.visControls.edgeThickness !== undefined ? props.visControls.edgeThickness : 1);
const neighborAttraction = computed(() => props.visControls.neighborAttraction !== undefined ? props.visControls.neighborAttraction : 1);
const rotationSpeed = computed(() => props.visControls.rotationSpeed !== undefined ? props.visControls.rotationSpeed : 0.5);

const nodeLabels = ref([]);
const selectedNodeId = ref(null);
const showNodeLabels = computed(() => props.visControls.showLabels);

const threeObjects = ref({
  nodeGroup: null,
  nodeObjects: {},
  edgeObjects: [],
  scene: null,
  camera: null,
  renderer: null,
  composer: null,
  raycaster: null,
  mouse: null,
  controls: null,
});

// Create edges function at component scope
const createEdges = () => {
  if (!threeObjects.value.nodeGroup) {
    console.warn("[DefaultVis] Cannot create edges, nodeGroup is null");
    return;
  }

  const nodeGroup = threeObjects.value.nodeGroup;
  const nodeObjects = threeObjects.value.nodeObjects;
  threeObjects.value.edgeObjects = [];

  // Draw edges from graphData.edges
  props.graphData.edges.forEach(({ source, target, weight }) => {
    const sourceNode = nodeObjects[source];
    const targetNode = nodeObjects[target];
    if (!sourceNode || !targetNode) {
      console.warn(`[DefaultVis] Cannot create edge ${source} -> ${target}, nodes not found`);
      return;
    }

    const points = new Float32Array([
      sourceNode.position.x, sourceNode.position.y, sourceNode.position.z,
      targetNode.position.x, targetNode.position.y, targetNode.position.z
    ]);
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));

    const edgeColor = new THREE.Color(sourceNode.material.color);
    const material = new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: edgeOpacity.value,
      linewidth: weight ? Math.min(weight * edgeThickness.value, 3) : edgeThickness.value,
    });

    const line = new THREE.Line(geometry, material);
    line.userData = { isEdge: true, source, target, weight: weight || 1, sourceNode, targetNode };
    nodeGroup.add(line);
    threeObjects.value.edgeObjects.push(line);
  });
};

const updateEdgePositions = () => {
  if (!threeObjects.value.edgeObjects) return;
  
  threeObjects.value.edgeObjects.forEach(edge => {
    const { sourceNode, targetNode } = edge.userData;
    const positions = edge.geometry.attributes.position.array;
    
    positions[0] = sourceNode.position.x;
    positions[1] = sourceNode.position.y;
    positions[2] = sourceNode.position.z;
    
    positions[3] = targetNode.position.x;
    positions[4] = targetNode.position.y;
    positions[5] = targetNode.position.z;
    
    edge.geometry.attributes.position.needsUpdate = true;
  });
};

// Initialize the 3D visualization
const initializeNetwork = () => {
  console.log("[DefaultVis] Initializing visualization");
  console.log("[DefaultVis] Graph data:", props.graphData.nodes.length, "nodes,", props.graphData.edges.length, "edges");
  
  if (!containerRef.value) {
    console.error("[DefaultVis] Container reference is null");
    return;
  }
  
  const container = containerRef.value;
  
  // Safety check for container dimensions
  if (container.offsetWidth === 0 || container.offsetHeight === 0) {
    console.error("[DefaultVis] Container has zero width or height, cannot initialize WebGL");
    setTimeout(() => {
      // Try again later when container might have dimensions
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        console.log("[DefaultVis] Container now has dimensions, retrying initialization");
        initializeNetwork();
      }
    }, 500);
    return;
  }
  
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Set up camera (zenithal view)
  const camera = new THREE.OrthographicCamera(
    container.offsetWidth / -20, container.offsetWidth / 20,
    container.offsetHeight / 20, container.offsetHeight / -20,
    1, 500
  );
  camera.position.set(0, 10, 0); // Top-down view
  camera.lookAt(0, 0, 0);

  console.log("[DefaultVis] Creating WebGLRenderer");
  const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(container.offsetWidth, container.offsetHeight);
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  
  console.log("[DefaultVis] Appending renderer to container");
  container.appendChild(renderer.domElement);

  // Make sure composer has valid dimensions
  if (container.offsetWidth === 0 || container.offsetHeight === 0) {
    console.error("[DefaultVis] Cannot create composer with zero dimensions");
    return;
  }
  
  console.log("[DefaultVis] Setting up post-processing with dimensions:", container.offsetWidth, "x", container.offsetHeight);
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(Math.max(1, container.offsetWidth), Math.max(1, container.offsetHeight)),
    0.1, // strength
    0.75, // radius
    0.4 // threshold
  );
  composer.addPass(bloomPass);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = props.visControls.rotationSpeed > 0;
  controls.autoRotateSpeed = props.visControls.rotationSpeed * 2;
  threeObjects.value.controls = controls;

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambientLight);

  // Add random point lights with high intensity
  for (let i = 0; i < 10; i++) {
    const pointLight = new THREE.PointLight(0xffffff, 2000, 100);
    pointLight.position.set(
      Math.random() * 40 - 20,
      Math.random() * 40 - 20,
      Math.random() * 40 - 20
    );
    scene.add(pointLight);
  }

  // Add grid helper
  const gridHelper = new THREE.GridHelper(100, 10);
  scene.add(gridHelper);
  watch(showGrid, (value) => {
    gridHelper.visible = value;
  });

  // Watch for control changes
  watch(() => props.visControls.rotationSpeed, (value) => {
    if (!threeObjects.value.controls) return;
    threeObjects.value.controls.autoRotate = value > 0;
    threeObjects.value.controls.autoRotateSpeed = value * 2;
  }, { immediate: true });

  const nodeGroup = new THREE.Group();
  scene.add(nodeGroup);

  // Create nodes
  const nodeObjects = {};
  
  console.log("[DefaultVis] Creating nodes:", props.graphData.nodes.length);

  props.graphData.nodes.forEach((node) => {
    try {
      const color = new THREE.Color(node.color);
      const baseSize = node.size / 8;
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(baseSize, 32, 32),
        new THREE.MeshPhysicalMaterial({ 
          color,
          metalness: 1.0,
          roughness: 1.0,
          envMapIntensity: 2.0,
          clearcoat: 1.0, 
          clearcoatRoughness: 1.0,
          reflectivity: 1.0
        })
      );

      // Position nodes in a more organized way based on level
      const angle = Math.random() * Math.PI * 2;
      const radius = (node.level + 1) * 12; // Increased radius
      const x = Math.cos(angle) * radius;
      const y = node.level * layerSpacing.value;
      const z = Math.sin(angle) * radius;

      sphere.position.set(x, y, z);
      sphere.userData = { 
        id: node.id, 
        label: node.label, 
        level: node.level,
        description: node.description,
        velocity: new THREE.Vector3(0, 0, 0),
        force: new THREE.Vector3(0, 0, 0),
        originalNode: node
      };
      nodeGroup.add(sphere);
      nodeObjects[node.id] = sphere;
    } catch (error) {
      console.error("[DefaultVis] Error creating node:", node.id, error);
    }
  });
  
  console.log("[DefaultVis] Nodes created:", Object.keys(nodeObjects).length);

  // Setup raycaster for node selection
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Handle mouse click for node selection
  const handleMouseClick = (event) => {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.offsetX / container.offsetWidth) * 2 - 1;
    mouse.y = -(event.offsetY / container.offsetHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray, limited to node group
    const intersects = raycaster.intersectObjects(nodeGroup.children);

    if (intersects.length > 0) {
      // Find first intersected object that is a node (not an edge)
      const intersectedNode = intersects.find(i => i.object.userData && i.object.userData.id && !i.object.userData.isEdge);
      
      if (intersectedNode) {
        const node = intersectedNode.object;
        
        // Highlight selected node
        Object.values(nodeObjects).forEach(n => {
          if (n === node) {
            n.material.emissive = new THREE.Color(0xffff00);
            n.material.emissiveIntensity = 0.5;
            selectedNodeId.value = n.userData.id;
            // Emit the selected node to parent
            emit('node-selected', n.userData.originalNode);
          } else {
            n.material.emissive = new THREE.Color(0x000000);
            n.material.emissiveIntensity = 0;
          }
        });
      }
    } else {
      // Deselect all nodes if clicking on empty space
      Object.values(nodeObjects).forEach(n => {
        n.material.emissive = new THREE.Color(0x000000);
        n.material.emissiveIntensity = 0;
      });
      selectedNodeId.value = null;
      emit('node-selected', null);
    }
  };

  container.addEventListener('click', handleMouseClick);

  // Handle mouse hover for node selection
  const handleMouseMove = (event) => {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.offsetX / container.offsetWidth) * 2 - 1;
    mouse.y = -(event.offsetY / container.offsetHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray, limited to node group
    const intersects = raycaster.intersectObjects(nodeGroup.children);

    if (intersects.length > 0) {
      // Find first intersected object that is a node (not an edge)
      const intersectedNode = intersects.find(i => i.object.userData && i.object.userData.id && !i.object.userData.isEdge);
      
      if (intersectedNode) {
        const node = intersectedNode.object;
        
        // Highlight hovered node
        Object.values(nodeObjects).forEach(n => {
          if (n === node) {
            n.material.emissive = new THREE.Color(0xffff00);
            n.material.emissiveIntensity = 0.5;
            selectedNodeId.value = n.userData.id;
            // Emit the selected node to parent
            emit('node-selected', n.userData.originalNode);
          } else {
            n.material.emissive = new THREE.Color(0x000000);
            n.material.emissiveIntensity = 0;
          }
        });
      }
    } else {
      // Deselect all nodes if not hovering over any
      Object.values(nodeObjects).forEach(n => {
        n.material.emissive = new THREE.Color(0x000000);
        n.material.emissiveIntensity = 0;
      });
      selectedNodeId.value = null;
      emit('node-selected', null);
    }
  };

  // Add mouse move handler for hover interaction
  container.addEventListener('mousemove', handleMouseMove);

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
      
      Object.values(nodeObjects).forEach(otherNode => {
        if (node !== otherNode) {
          const diff = node.position.clone().sub(otherNode.position);
          const dist = diff.length();
          if (dist < 5) {
            const force = diff.normalize().multiplyScalar(1 / (dist * dist));
            node.userData.force.add(force);
          }
        }
      });

      props.graphData.edges.forEach(({ source, target, weight }) => {
        if (source === node.userData.id || target === node.userData.id) {
          const otherNode = nodeObjects[source === node.userData.id ? target : source];
          if (otherNode) {
            const diff = otherNode.position.clone().sub(node.position);
            const dist = diff.length();
            const attractionFactor = neighborAttraction.value * 0.1 * (weight || 1);
            const attraction = diff.normalize().multiplyScalar(dist * attractionFactor);
            node.userData.force.add(attraction);
          }
        }
      });

      const targetY = node.userData.level * layerSpacing.value;
      const yDiff = targetY - node.position.y;
      node.userData.force.y += yDiff * 0.05;

      node.userData.velocity.add(node.userData.force.multiplyScalar(0.1));
      node.userData.velocity.multiplyScalar(0.95);
      node.position.add(node.userData.velocity);
    });

    updateEdgePositions();
  };

  // Window resize handler
  const handleResize = () => {
    if (!threeObjects.value || !threeObjects.value.camera || !threeObjects.value.renderer || !containerRef.value) return;
    
    const container = containerRef.value;
    const camera = threeObjects.value.camera;
    const renderer = threeObjects.value.renderer;
    const composer = threeObjects.value.composer;
    
    // Check for valid dimensions
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      console.warn("[DefaultVis] Cannot resize to zero dimensions");
      return;
    }
    
    console.log("[DefaultVis] Handling resize:", container.offsetWidth, "x", container.offsetHeight);
    
    camera.left = container.offsetWidth / -20;
    camera.right = container.offsetWidth / 20;
    camera.top = container.offsetHeight / 20;
    camera.bottom = container.offsetHeight / -20;
    camera.updateProjectionMatrix();
    
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    
    if (composer) {
      composer.setSize(container.offsetWidth, container.offsetHeight);
    }
  };
  
  window.addEventListener('resize', handleResize);
  
  // Animate and render
  let animationFrameId;
  const animate = () => {
    simulatePhysics();
    updateLabels();
    controls.update();
    composer.render();
    animationFrameId = requestAnimationFrame(animate);
  };
  
  console.log("[DefaultVis] Starting animation loop");
  animate();

  threeObjects.value = { 
    nodeGroup, 
    scene, 
    camera, 
    renderer, 
    composer, 
    nodeObjects,
    raycaster,
    mouse,
    controls,
    handleResize,
    cleanup: () => {
      console.log("[DefaultVis] Cleaning up resources");
      
      // Cancel animation frame
      if (animationFrameId) {
        console.log("[DefaultVis] Canceling animation frame");
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      
      // Clear references to avoid memory leaks
      raycaster = null;
      mouse = null;
      controls = null;
      
      // Safely remove event listeners first
      try {
        console.log("[DefaultVis] Removing event listeners");
        window.removeEventListener('resize', handleResize);
        if (container) {
          if (handleMouseClick) container.removeEventListener('click', handleMouseClick);
          if (handleMouseMove) container.removeEventListener('mousemove', handleMouseMove);
        }
      } catch (e) {
        console.warn("[DefaultVis] Error removing event listeners:", e);
      }
      
      // Dispose of ThreeJS resources
      try {
        console.log("[DefaultVis] Disposing ThreeJS resources");
        
        // Clean up edge objects
        if (threeObjects.value && threeObjects.value.edgeObjects) {
          threeObjects.value.edgeObjects.forEach(edge => {
            if (edge.geometry) {
              edge.geometry.dispose();
              edge.geometry = null;
            }
            if (edge.material) {
              edge.material.dispose();
              edge.material = null;
            }
          });
          threeObjects.value.edgeObjects = [];
        }
        
        // Clean up node objects
        if (threeObjects.value && threeObjects.value.nodeObjects) {
          Object.values(threeObjects.value.nodeObjects).forEach(node => {
            if (node.geometry) {
              node.geometry.dispose();
              node.geometry = null;
            }
            if (node.material) {
              node.material.dispose();
              node.material = null;
            }
          });
          threeObjects.value.nodeObjects = {};
        }
        
        // Clean up other scene objects
        if (scene) {
          scene.traverse((object) => {
            if (object.geometry) {
              object.geometry.dispose();
              object.geometry = null;
            }
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(material => {
                  material.dispose();
                });
              } else {
                object.material.dispose();
              }
              object.material = null;
            }
          });
          
          // Clear the scene
          while(scene.children.length > 0) { 
            scene.remove(scene.children[0]); 
          }
        }
        
        // Clear any passes from composer before disposing
        if (composer) {
          console.log("[DefaultVis] Disposing composer");
          if (composer.passes) {
            for (let i = composer.passes.length - 1; i >= 0; i--) {
              const pass = composer.passes[i];
              if (pass) {
                composer.removePass(pass);
              }
            }
          }
          
          if (composer.renderTarget1) {
            composer.renderTarget1.dispose();
            composer.renderTarget1 = null;
          }
          if (composer.renderTarget2) {
            composer.renderTarget2.dispose();
            composer.renderTarget2 = null;
          }
          
          composer = null;
        }
        
        // Remove renderer from DOM
        if (renderer && container) {
          try {
            console.log("[DefaultVis] Removing renderer from DOM");
            if (container.contains(renderer.domElement)) {
              container.removeChild(renderer.domElement);
            }
          } catch (e) {
            console.warn("[DefaultVis] Error removing renderer element:", e);
          }
        }
        
        if (renderer) {
          console.log("[DefaultVis] Disposing renderer");
          renderer.dispose();
          renderer.forceContextLoss();
        }
      } catch (e) {
        console.warn("[DefaultVis] Error disposing ThreeJS resources:", e);
      }
      
      console.log("[DefaultVis] Cleanup complete");
    }
  };

  // Update watchers for controls
  watch(() => props.visControls.nodeSizeScale, (value) => {
    if (!threeObjects.value.nodeObjects) return;
    Object.values(threeObjects.value.nodeObjects).forEach(node => {
      const baseSize = node.userData.originalNode.size / 8;
      node.scale.setScalar(value);
    });
  }, { immediate: true });

  watch(() => props.visControls.neighborAttraction, (value) => {
    // Update neighbor attraction in physics simulation
    props.graphData.edges.forEach(({ source, target, weight }) => {
      const sourceNode = threeObjects.value.nodeObjects[source];
      const targetNode = threeObjects.value.nodeObjects[target];
      if (sourceNode && targetNode) {
        const diff = targetNode.position.clone().sub(sourceNode.position);
        const dist = diff.length();
        const force = diff.normalize().multiplyScalar(dist * value * 0.1 * (weight || 1));
        sourceNode.userData.force.add(force);
        targetNode.userData.force.sub(force);
      }
    });
  }, { immediate: true });

  watch([edgeOpacity, edgeThickness], () => {
    createEdges();
  });
  
  // Watch for changes in graphData
  watch(() => props.graphData, (newData) => {
    console.log("[DefaultVis] Graph data changed:", newData.nodes.length, "nodes,", newData.edges.length, "edges");
    // We need to completely reinitialize when data changes
    if (threeObjects.value && threeObjects.value.cleanup) {
      threeObjects.value.cleanup();
    }
    initializeNetwork();
  }, { deep: true });
};

// Initialize when component mounts
onMounted(() => {
  console.log("[DefaultVis] Component mounted");
  initializeNetwork();

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      showNodeLabels.value = !showNodeLabels.value;
      console.log(`[DefaultVis] Node labels ${showNodeLabels.value ? 'shown' : 'hidden'}`);
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  
  // Clean up event listener on unmount
  onBeforeUnmount(() => {
    console.log("[DefaultVis] Component unmounting, cleaning up resources");
    window.removeEventListener('keydown', handleKeyDown);
    
    // Safely clean up Three.js resources
    try {
      if (threeObjects.value && threeObjects.value.cleanup) {
        threeObjects.value.cleanup();
      }
    } catch (err) {
      console.error("[DefaultVis] Error during cleanup:", err);
    }
  });
});
</script>

<style scoped>
.vis-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #000;
}

.node-label {
  position: absolute;
  color: white;
  pointer-events: none;
  font-size: 14px;
  font-family: "IBM Plex Mono", monospace;
}
</style> 
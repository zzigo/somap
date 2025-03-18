<template>
  <div class="somap-container">
    <!-- Control Sidebar -->
    <div class="control-sidebar">
      <h3>Controls</h3>
      <div class="control-group">
        <label>Rotation Speed</label>
        <input type="range" v-model.number="visControls.rotationSpeed" min="0" max="5" step="0.1">
      </div>
      <div class="control-group">
        <label>Node Size</label>
        <input type="range" v-model.number="visControls.nodeSizeScale" min="0.1" max="3" step="0.1">
      </div>
      <div class="control-group">
        <label>Neighbor Attraction</label>
        <input type="range" v-model.number="visControls.neighborAttraction" min="0" max="2" step="0.1">
      </div>
      <div class="control-group">
        <label>Show Names</label>
        <input type="checkbox" v-model="visControls.showLabels">
      </div>
    </div>

    <div class="top-menu">
      <h2>SOMAP Visualizer</h2>
      <div class="file-selector">
        <label>GEXF File:</label>
        <select v-model="selectedGexfFile" @change="loadSelectedFile">
          <option v-for="file in availableGexfFiles" :key="file.path" :value="file.path">
            {{ file.name }}
          </option>
        </select>
      </div>
      <div class="vis-mode-selector">
        <label>Visualization Mode:</label>
        <button 
          @click="changeVisMode('DEFAULT_3D')" 
          :class="{ active: currentVisMode === 'DEFAULT_3D' }"
        >3D</button>
        <button 
          @click="changeVisMode('COLOR_NEIGHBORS')" 
          :class="{ active: currentVisMode === 'COLOR_NEIGHBORS' }"
        >Neighbors</button>
        <button 
          @click="changeVisMode('FLAT_2D')" 
          :class="{ active: currentVisMode === 'FLAT_2D' }"
        >2D</button>
      </div>
    </div>
    
    <VisManager 
      :net-file="currentNet" 
      :vis-controls="visControls"
      :current-vis-mode="currentVisMode"
      @nodes-count-change="updateNodeCount"
      @edges-count-change="updateEdgeCount"
      @node-selected="handleNodeSelected"
      ref="visManagerRef"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, provide, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import VisManager from '../components/VisManager.vue';

const route = useRoute();
const router = useRouter();

// Available GEXF files
const availableGexfFiles = ref([
  { name: 'sh.gexf', path: '/nets/sh.gexf' },
  { name: 'ne.gexf', path: '/nets/ne.gexf' },
  { name: 'min.gexf', path: '/nets/min.gexf' },
  { name: 'shi.gexf', path: '/nets/shi.gexf' },
  { name: 'mat.gexf', path: '/nets/mat.gexf' },
  { name: 'so.gexf', path: '/nets/so.gexf' }
]);

// Reference to the VisManager component
const visManagerRef = ref(null);

// Current visualization mode
const currentVisMode = ref('DEFAULT_3D');

// Node and edge count for the current graph
const nodeCount = ref(0);
const edgeCount = ref(0);

// Update count functions
const updateNodeCount = (count) => {
  nodeCount.value = count;
};

const updateEdgeCount = (count) => {
  edgeCount.value = count;
};

// Selected GEXF file
const selectedGexfFile = ref('/nets/sh.gexf');

// Get net file from route or default
const currentNet = computed(() => {
  const netFromRoute = route.query.net;
  console.log(`[Index] Current net from route: ${netFromRoute}`);
  return netFromRoute || selectedGexfFile.value || '/nets/sh.gexf';
});

// Display name for the current net
const currentNetDisplay = computed(() => {
  return currentNet.value.split('/').pop();
});

// Load selected file
const loadSelectedFile = () => {
  console.log(`[Index] Loading selected file: ${selectedGexfFile.value}`);
  router.push({ query: { net: selectedGexfFile.value } });
};

// Change visualization mode
const changeVisMode = (mode) => {
  console.log(`[Index] Changing visualization mode to: ${mode}`);
  currentVisMode.value = mode;
};

// Handle keyboard events for visualization modes and navigation
const handleKeyDown = (event) => {
  // Simple number keys for visualization modes
  if (event.key === '1') {
    event.preventDefault();
    changeVisMode('DEFAULT_3D');
  } else if (event.key === '2') {
    event.preventDefault();
    changeVisMode('COLOR_NEIGHBORS');
  } else if (event.key === '3') {
    event.preventDefault();
    changeVisMode('FLAT_2D');
  }
  
  // Alt+Shift combinations for navigation
  if (event.altKey && event.shiftKey) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 'next' : 'prev';
      const currentIndex = availableGexfFiles.value.findIndex(file => file.path === selectedGexfFile.value);
      if (currentIndex === -1) return;
      
      const newIndex = direction === 'next'
        ? (currentIndex + 1) % availableGexfFiles.value.length
        : (currentIndex - 1 + availableGexfFiles.value.length) % availableGexfFiles.value.length;
      
      selectedGexfFile.value = availableGexfFiles.value[newIndex].path;
      loadSelectedFile();
    }
  }
};

// Load component
onMounted(() => {
  console.log('[Index] Component mounted');
  
  // Set the selected GEXF file based on the current route
  const netFromRoute = route.query.net;
  selectedGexfFile.value = netFromRoute || '/nets/sh.gexf';
  console.log(`[Index] Initially selected file: ${selectedGexfFile.value}`);
  
  // If there's no file in the route, push the default selected file
  if (!netFromRoute) {
    router.push({ query: { net: selectedGexfFile.value } });
    console.log(`[Index] Setting default file in route: ${selectedGexfFile.value}`);
  }
  
  // Add keyboard shortcut handler
  window.addEventListener('keydown', handleKeyDown);
  
  // Add fullscreen handler
  window.addEventListener('keydown', handleFullscreen);
});

// Clean up event listeners
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keydown', handleFullscreen);
});

// Watch for changes to the current net file
watch(currentNet, (newNet) => {
  console.log(`[Index] Net file changed: ${newNet}`);
  selectedGexfFile.value = newNet;
}, { immediate: true });

// Provide visualization mode to child components
provide('currentVisMode', currentVisMode);

// Add visControls state with proper reactivity
const visControls = ref({
  rotationSpeed: 0.5,
  nodeSizeScale: 1.0,
  neighborAttraction: 1.0,
  showLabels: true
});

// Watch for control changes
watch(() => visControls.value, (newControls) => {
  if (visManagerRef.value) {
    visManagerRef.value.updateControls(newControls);
  }
}, { deep: true });

// Add fullscreen handler
const handleFullscreen = (e) => {
  if (e.metaKey && e.shiftKey && e.key === 'f') {
    e.preventDefault();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }
};

// Handle node selection
const handleNodeSelected = (node) => {
  console.log('Node selected:', node);
};
</script>

<style scoped>
.somap-container {
  width: 100%;
  height: 100vh;
  position: relative;
  background: #000;
  color: white;
  overflow: hidden;
}

.top-menu {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  padding: 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 100;
}

.top-menu h2 {
  margin: 0;
  font-size: 18px;
  color: #1abc9c;
}

.file-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-selector label {
  font-size: 14px;
}

.file-selector select {
  background: #2c3e50;
  color: white;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  cursor: pointer;
}

.vis-mode-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.vis-mode-selector label {
  font-size: 14px;
}

.vis-mode-selector button {
  background: #34495e;
  color: white;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.vis-mode-selector button:hover {
  background-color: #4a6b8a;
}

.vis-mode-selector button.active {
  background-color: #1abc9c;
  font-weight: bold;
}

.debug-panel {
  position: absolute;
  top: 60px;
  right: 10px;
  background: rgba(0, 0, 0, 0.9) !important;
  color: #0f0;
  padding: 15px !important;
  border: 1px solid rgba(0, 255, 0, 0.3) !important;
  border-radius: 5px;
  font-family: monospace;
  z-index: 10;
  font-size: 11px !important;
  max-width: 300px;
}

.debug-panel h3 {
  margin-top: 0;
  margin-bottom: 8px !important;
  color: #0f0;
  font-size: 12px !important;
}

.close-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  background: transparent;
  color: #0f0;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
}

.debug-toggle {
  position: absolute;
  bottom: 10px;
  right: 10px;
  z-index: 10;
}

.debug-toggle button {
  background: rgba(0, 0, 0, 0.7);
  color: #0f0;
  border: 1px solid #0f0;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-family: monospace;
}

.control-sidebar {
  position: absolute;
  top: 60px;
  left: 10px;
  background: rgba(0, 0, 0, 0.8);
  padding: 15px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 12px;
  z-index: 100;
  width: 200px;
}

.control-sidebar h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #1abc9c;
}

.control-group {
  margin-bottom: 10px;
}

.control-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  color: #ccc;
}

.control-group input[type="range"] {
  width: 100%;
  margin: 2px 0;
  background: #2c3e50;
  border-radius: 2px;
  -webkit-appearance: none;
}

.control-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: #1abc9c;
  border-radius: 50%;
  cursor: pointer;
}

.control-group input[type="checkbox"] {
  margin: 0;
  accent-color: #1abc9c;
}
</style>

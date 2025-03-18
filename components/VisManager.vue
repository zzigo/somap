<template>
  <div class="vis-container" ref="containerRef">
    <div class="vis-stats-info">
      <div class="graph-stats">
        Nodes: {{ graphData.nodes.length }} | Edges: {{ graphData.edges.length }}
      </div>
      <div v-if="selectedNode" class="node-info">
        <strong>{{ selectedNode.label }}</strong>
        <p v-if="selectedNode.description">{{ selectedNode.description }}</p>
      </div>
    </div>
    
    <div v-if="isLoading" class="loading-indicator">
      Loading visualization...
    </div>
    
    <div class="vis-component-wrapper">
      <keep-alive>
        <transition name="fade" mode="out-in" @before-leave="handleBeforeLeave" @after-enter="handleAfterEnter">
          <component 
            v-show="!isLoading"
            :is="currentVisComponent" 
            :key="currentVisComponentKey"
            :graph-data="graphData"
            :vis-controls="localVisControls"
            class="vis-component"
            @node-selected="handleNodeSelected"
          />
        </transition>
      </keep-alive>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, inject, reactive, markRaw, nextTick } from 'vue';
import DefaultVis from './VisModes/DefaultVis.vue';
import FlatVis from './VisModes/FlatVis.vue';
import ColorNeighborsVis from './VisModes/ColorNeighborsVis.vue';
import * as gexf from '../utils/gexf';

// Mark raw the imported components to avoid reactivity issues
const DefaultVisComponent = markRaw(DefaultVis);
const FlatVisComponent = markRaw(FlatVis);
const ColorNeighborsVisComponent = markRaw(ColorNeighborsVis);

const emit = defineEmits(['nodes-count-change', 'edges-count-change', 'node-selected', 'update:currentVisMode']);

const props = defineProps({
  netFile: {
    type: String,
    required: true
  },
  visControls: {
    type: Object,
    required: false,
    default: () => ({
      rotationSpeed: 0.5,
      nodeSizeScale: 1,
      neighborAttraction: 1,
      showLabels: true
    })
  },
  currentVisMode: {
    type: String,
    required: false,
    default: 'DEFAULT_3D'
  }
});

// Create a local copy of controls to avoid reactivity issues
const localVisControls = reactive({
  rotationSpeed: props.visControls.rotationSpeed,
  nodeSizeScale: props.visControls.nodeSizeScale,
  neighborAttraction: props.visControls.neighborAttraction,
  showLabels: props.visControls.showLabels,
  edgeOpacity: props.visControls.edgeOpacity || 0.5,
  showGrid: props.visControls.showGrid || false,
  layerSpacing: props.visControls.layerSpacing || 2
});

// Watch for changes to the props.visControls and update local copy
watch(() => props.visControls, (newControls) => {
  if (newControls) {
    Object.keys(newControls).forEach(key => {
      if (key in localVisControls) {
        localVisControls[key] = newControls[key];
      }
    });
  }
}, { deep: true, immediate: true });

// Key for forcing component recreation on visualization mode change
const currentVisComponentKey = computed(() => `vis-${props.currentVisMode}`);

const graphData = ref({
  nodes: [],
  edges: []
});

const selectedNode = ref(null);

// Get connected edges for the selected node
const connectedEdges = computed(() => {
  if (!selectedNode.value || !graphData.value.edges) return [];
  
  return graphData.value.edges.filter(edge => 
    edge.source === selectedNode.value.id || 
    edge.target === selectedNode.value.id
  );
});

// Helper function to get node label by ID
const getNodeLabel = (nodeId) => {
  const node = graphData.value.nodes.find(n => n.id === nodeId);
  return node ? node.label : nodeId;
};

const handleNodeSelected = (node) => {
  selectedNode.value = node;
  emit('node-selected', node);
};

// Visualization modes
const visModes = {
  DEFAULT_3D: 'DEFAULT_3D',
  COLOR_NEIGHBORS: 'COLOR_NEIGHBORS',
  FLAT_2D: 'FLAT_2D'
};

// Track current mode
const currentMode = ref(props.currentVisMode);

// Track previous mode for cleanup
const previousMode = ref(null);

// Add loading state
const isLoading = ref(false);

// Watch for changes to currentVisMode prop
watch(() => props.currentVisMode, async (newMode, oldMode) => {
  console.log(`[VisManager] Visualization mode changed from ${oldMode} to ${newMode}`);
  
  // Set loading state to trigger transition
  isLoading.value = true;
  
  // Store the previous mode for reference
  previousMode.value = oldMode;
  
  // Wait for Vue to finish any current rendering operations
  await nextTick();
  
  // Update current mode to trigger transition
  currentMode.value = newMode;
  
  // Keep loading state true - will be set to false in handleAfterEnter
  // after the component is mounted and transition completes
  console.log(`[VisManager] Mode switched to ${newMode}, waiting for transition`);
}, { immediate: true });

// Function to change visualization mode
const changeVisMode = (mode) => {
  console.log(`[VisManager] Changing visualization mode from ${currentMode.value} to ${mode}`);
  if (Object.values(visModes).includes(mode)) {
    // Emit the event to the parent component
    emit('update:currentVisMode', mode);
    
    // Also update internal state for immediate feedback
    currentMode.value = mode;
    console.log(`[VisManager] Mode change event emitted for: ${mode}`);
  } else {
    console.warn(`[VisManager] Invalid visualization mode: ${mode}`);
  }
};

// Handle keyboard shortcuts for changing visualization mode
const handleKeyDown = (event) => {
  console.log(`[VisManager] Key pressed: ${event.key}, Alt: ${event.altKey}, Shift: ${event.shiftKey}, Ctrl: ${event.ctrlKey}`);
  
  if (event.altKey && event.shiftKey) {
    if (event.key === '1' || event.key === '!') {
      console.log('[VisManager] Keyboard shortcut detected: Alt+Shift+1 - Switching to DEFAULT_3D mode');
      changeVisMode(visModes.DEFAULT_3D);
      event.preventDefault();
    } else if (event.key === '2' || event.key === '@') {
      console.log('[VisManager] Keyboard shortcut detected: Alt+Shift+2 - Switching to COLOR_NEIGHBORS mode');
      changeVisMode(visModes.COLOR_NEIGHBORS);
      event.preventDefault();
    } else if (event.key === '3' || event.key === '#') {
      console.log('[VisManager] Keyboard shortcut detected: Alt+Shift+3 - Switching to FLAT_2D mode');
      changeVisMode(visModes.FLAT_2D);
      event.preventDefault();
    }
  }
};

// Parse network file
const parseNetFile = async (file) => {
  console.log(`[VisManager] Parsing network file: ${file}`);
  try {
    if (!file) {
      console.warn('[VisManager] No file provided');
      return;
    }
    
    if (!file.endsWith('.gexf')) {
      console.warn(`[VisManager] Unsupported file format: ${file}. Only .gexf files are supported.`);
      return;
    }
    
    // Format the file path correctly for Nuxt
    let filePath = file;
    
    // Remove any leading '/public' as Nuxt already serves from the public directory
    if (filePath.startsWith('/public/')) {
      filePath = filePath.substring(7); // Remove '/public'
    }
    
    // Ensure path starts with '/'
    if (!filePath.startsWith('/')) {
      filePath = '/' + filePath;
    }
    
    // Create a proper URL by combining with the origin
    const baseUrl = window.location.origin;
    const fileUrl = new URL(filePath, baseUrl).toString();
    
    console.log(`[VisManager] Fetching network file with properly formatted URL: ${fileUrl}`);
    
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        console.error(`[VisManager] Failed to fetch file: ${fileUrl}, status: ${response.status}`);
        throw new Error(`Failed to fetch with status: ${response.status}`);
      }
      
      const text = await response.text();
      console.log(`[VisManager] File fetched successfully, parsing GEXF`);
      
      const parsedData = gexf.parse(text);
      console.log(`[VisManager] GEXF parsed successfully: ${parsedData.nodes.length} nodes, ${parsedData.edges.length} edges`);
      
      graphData.value = parsedData;
      
      // Emit events for node and edge counts
      emit('nodes-count-change', parsedData.nodes.length);
      emit('edges-count-change', parsedData.edges.length);
      
      // Reset selection when loading a new graph
      selectedNode.value = null;
    } catch (fetchError) {
      console.error(`[VisManager] Error with primary fetch: ${fetchError.message}`);
      
      // Try alternative path - directly using the nets directory
      if (filePath.includes('/nets/')) {
        const alternativeFilePath = filePath.substring(filePath.indexOf('/nets/'));
        const alternativeUrl = new URL(alternativeFilePath, baseUrl).toString();
        
        console.log(`[VisManager] Trying alternative path: ${alternativeUrl}`);
        
        try {
          const response = await fetch(alternativeUrl);
          if (!response.ok) {
            console.error(`[VisManager] Failed with alternative path: ${alternativeUrl}, status: ${response.status}`);
            throw new Error(`Failed with alternative path, status: ${response.status}`);
          }
          
          const text = await response.text();
          console.log(`[VisManager] File fetched successfully with alternative path, parsing GEXF`);
          
          const parsedData = gexf.parse(text);
          console.log(`[VisManager] GEXF parsed successfully: ${parsedData.nodes.length} nodes, ${parsedData.edges.length} edges`);
          
          graphData.value = parsedData;
          
          // Emit events for node and edge counts
          emit('nodes-count-change', parsedData.nodes.length);
          emit('edges-count-change', parsedData.edges.length);
          
          // Reset selection when loading a new graph
          selectedNode.value = null;
        } catch (alternativeError) {
          console.error(`[VisManager] Alternative path failed: ${alternativeError.message}`);
          throw alternativeError; // Re-throw to be caught by outer catch
        }
      } else {
        throw fetchError; // Re-throw if we don't have an alternative to try
      }
    }
  } catch (error) {
    console.error(`[VisManager] Error parsing network file: ${error.message}`, error);
  }
};

// Handle custom visualization mode change events
const handleVisModeChange = (event) => {
  console.log(`[VisManager] Received vismode-change event with mode: ${event.detail.mode}`);
  changeVisMode(event.detail.mode);
};

onMounted(() => {
  console.log('[VisManager] Component mounted. Available modes:', Object.values(visModes));
  console.log(`[VisManager] Initial net file: ${props.netFile}`);
  
  // Parse the initial network file
  parseNetFile(props.netFile);
  
  // Add event listeners
  window.addEventListener('vismode-change', handleVisModeChange);
  window.addEventListener('keydown', handleKeyDown);
  
  // Log registered event listeners
  console.log('[VisManager] Keyboard and vismode-change event listeners registered');
});

// Call cleanup when component is unmounted
onBeforeUnmount(() => {
  console.log('[VisManager] Component unmounting, removing event listeners');
  window.removeEventListener('vismode-change', handleVisModeChange);
  window.removeEventListener('keydown', handleKeyDown);
  isLoading.value = true; // Prevent rendering during unmount
});

// Watch for changes to the netFile prop
watch(() => props.netFile, (newNetFile) => {
  console.log(`[VisManager] Net file changed to: ${newNetFile}`);
  parseNetFile(newNetFile);
}, { immediate: true });

// Dynamic component based on current visualization mode
const currentVisComponent = computed(() => {
  const mode = currentMode.value;
  switch (mode) {
    case 'DEFAULT_3D':
      return DefaultVisComponent;
    case 'COLOR_NEIGHBORS':
      return ColorNeighborsVisComponent;
    case 'FLAT_2D':
      return FlatVisComponent;
    default:
      return DefaultVisComponent;
  }
});

// Add method to handle control updates
const updateControls = (newControls) => {
  if (newControls) {
    Object.keys(newControls).forEach(key => {
      if (key in localVisControls) {
        localVisControls[key] = newControls[key];
      }
    });
    console.log('[VisManager] Controls updated:', localVisControls);
  }
};

// Define this method to make it accessible from the parent component
defineExpose({
  updateControls
});

// Reference to the container
const containerRef = ref(null);

// Add the transition lifecycle hooks
const handleBeforeLeave = (el) => {
  console.log('[VisManager] Component before-leave transition event');
};

const handleAfterEnter = (el) => {
  console.log('[VisManager] Component after-enter transition event');
  isLoading.value = false;
};
</script>

<style scoped>
.vis-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.vis-component {
  width: 100%;
  height: 100%;
}

.vis-stats-info {
  position: absolute;
  top: 60px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 15px;
  border-radius: 5px;
  z-index: 10;
  font-family: system-ui, -apple-system, sans-serif;
  border: 1px solid rgba(255, 255, 255, 0.2);
  max-width: 300px;
  pointer-events: none;
}

.graph-stats {
  font-size: 12px;
  color: #fff;
}

.node-info {
  margin-top: 10px;
  font-size: 12px;
}

.node-info strong {
  display: block;
  margin-bottom: 4px;
  color: #1abc9c;
}

.node-info p {
  margin: 0;
  line-height: 1.4;
  color: #ccc;
}

.loading-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 18px;
  color: #fff;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

.vis-component-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

/* Transition effects */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style> 
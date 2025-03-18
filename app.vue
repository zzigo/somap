<template>
  <div class="app-container">
    <main>
      <NuxtPage />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// List of available net files
const availableNets = ref([
  { id: 'random.gexf', name: 'Random' },
  { id: 'so.gexf', name: 'So Net' },
  { id: 'sh.gexf', name: 'Sh Net' },
  { id: 'shi.gexf', name: 'Shi Net' },
  { id: 'min.gexf', name: 'Min Net' },
  { id: 'mat.gexf', name: 'Mat Net' },
  { id: 'ne.gexf', name: 'Ne Net' }
]);

const route = useRoute();
const router = useRouter();

// Current selected network and visualization mode
const selectedNetId = ref('random.gexf');
const currentVisMode = ref('DEFAULT_3D');

// Get current net from route
const currentNet = computed(() => {
  return route.query.net || 'random.gexf';
});

// Watch for route changes to update the selected network
watch(currentNet, (newNet) => {
  console.log(`[App] Current net from route: ${newNet}`);
}, { immediate: true });

// Change net based on selection
const changeNet = () => {
  router.push({ 
    query: { 
      ...route.query,
      net: selectedNetId.value 
    }
  });
  console.log(`[App] Changed network to: ${selectedNetId.value}`);
};

// Set visualization mode
const setVisMode = (mode) => {
  currentVisMode.value = mode;
  console.log(`[App] Set visualization mode to: ${mode}`);
  
  // Create a custom event that VisManager can listen for
  const event = new CustomEvent('vismode-change', { 
    detail: { mode } 
  });
  window.dispatchEvent(event);
};

// Navigate to next or previous net
const navigateNet = (direction) => {
  const currentIndex = availableNets.value.findIndex(net => net.id === selectedNetId.value);
  if (currentIndex === -1) return;
  
  let newIndex;
  if (direction === 'next') {
    newIndex = (currentIndex + 1) % availableNets.value.length;
  } else {
    newIndex = (currentIndex - 1 + availableNets.value.length) % availableNets.value.length;
  }
  
  selectedNetId.value = availableNets.value[newIndex].id;
  changeNet();
  console.log(`[App] Navigated ${direction} to: ${selectedNetId.value}`);
};
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 
    'Open Sans', 'Helvetica Neue', sans-serif;
  background: #000;
  color: #fff;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
}

main {
  flex: 1;
  position: relative;
}
</style>
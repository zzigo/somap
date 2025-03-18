// Debug utility for SOMAP visualizations
console.log("SOMAP Debug Utilities Loaded");

// Add global debug object
window.SOMAP_DEBUG = {
  logEvent: function(category, action, details) {
    console.log(`[${category}] ${action}`, details || '');
  },
  
  // Track keyboard events
  trackKeyboard: function() {
    console.log("Keyboard tracking enabled");
    window.addEventListener('keydown', function(e) {
      // Log only keyboard shortcuts we care about
      if (e.altKey && e.shiftKey) {
        console.log(`Keyboard event: Alt+Shift+${e.key}`, { 
          key: e.key, 
          altKey: e.altKey, 
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey
        });
      }
    });
  },
  
  // Track component lifecycle
  trackComponent: function(name, component) {
    console.log(`Component tracked: ${name}`);
    return {
      ...component,
      mounted() {
        console.log(`Component mounted: ${name}`);
        if (component.mounted) component.mounted();
      },
      unmounted() {
        console.log(`Component unmounted: ${name}`);
        if (component.unmounted) component.unmounted();
      }
    };
  },
  
  // Track network requests
  trackNetwork: function() {
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
      console.log(`Fetch request: ${url}`, options);
      return originalFetch.apply(this, arguments)
        .then(response => {
          console.log(`Fetch response: ${url}`, { status: response.status, ok: response.ok });
          return response;
        })
        .catch(error => {
          console.error(`Fetch error: ${url}`, error);
          throw error;
        });
    };
    console.log("Network tracking enabled");
  },
  
  // Track ThreeJS WebGL context
  trackWebGL: function() {
    if (typeof THREE !== 'undefined') {
      const originalWebGLRenderer = THREE.WebGLRenderer;
      THREE.WebGLRenderer = function(parameters) {
        console.log("THREE.WebGLRenderer created", parameters);
        const renderer = new originalWebGLRenderer(parameters);
        
        const originalDispose = renderer.dispose;
        renderer.dispose = function() {
          console.log("THREE.WebGLRenderer disposed");
          return originalDispose.call(this);
        };
        
        return renderer;
      };
      console.log("WebGL tracking enabled");
    } else {
      console.warn("THREE.js not found, WebGL tracking not enabled");
    }
  },
  
  // Initialize all tracking
  init: function() {
    this.trackKeyboard();
    this.trackNetwork();
    this.trackWebGL();
    console.log("SOMAP Debug Utilities Initialized");
  }
};

// Auto-initialize
window.SOMAP_DEBUG.init(); 
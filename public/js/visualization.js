// 3D Visualization and Type Shape Handler

document.addEventListener('DOMContentLoaded', () => {
  // Initialize the 3D graph
  const graphContainer = document.getElementById('graph-container');
  
  if (!graphContainer) {
    console.error('Graph container not found');
    return;
  }
  
  console.log('Initializing 3D Force Graph...');
  
  // Try to access 3D-force-graph library
  if (!window.ForceGraph3D) {
    console.error('ForceGraph3D not found. Make sure 3d-force-graph library is loaded.');
    return;
  }
  
  // Initialize window.THREE from ForceGraph3D
  if (!window.THREE) {
    if (window.ForceGraph3D.THREE) {
      window.THREE = window.ForceGraph3D.THREE;
      console.log('THREE.js initialized from ForceGraph3D');
    } else {
      console.warn('THREE.js not found directly or in ForceGraph3D. Visual quality may be reduced.');
    }
  } else {
    console.log('THREE.js already initialized, using existing version');
  }
  
  // Initialize the 3D Force Graph
  const graph = ForceGraph3D({ 
    extraRenderers: [] 
  })(graphContainer);
  
  // Make sure THREE is available globally via the graph object
  if (!window.THREE && graph && graph.constructor && graph.constructor.THREE) {
    window.THREE = graph.constructor.THREE;
    console.log('THREE.js initialized from graph constructor');
  }
  
  if (!window.THREE) {
    console.error('Could not initialize THREE.js from any source');
    // Try to dynamically load THREE.js as a last resort
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.min.js';
    script.onload = () => {
      console.log('THREE.js loaded dynamically');
      window.THREE = window.THREE || {};
    };
    document.head.appendChild(script);
  }
  
  // Global variables
  let graphData = { nodes: [], links: [] };
  let types = {}; // Cache of types for shape creation
  
  // Initialize graph with empty data
  graph
    .graphData(graphData)
    .nodeColor(node => node.color || '#ffffff')
    .nodeLabel(node => `${node.label || node.name} (${node.kind})`)
    .linkDirectionalParticles(2)
    .linkDirectionalParticleWidth(2)
    .linkLabel(link => link.predicate || 'connects')
    .onNodeClick(node => {
      // Focus on node when clicked
      const distance = 40;
      const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
      graph.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
        node, // lookAt
        3000  // transition duration
      );
    });
  
  // Create a 3D shape based on Type.Shape value
  function createNodeGeometry(shape, size = 5) {
    // Make sure THREE is defined
    if (!window.THREE) {
      console.error('THREE.js not available for creating geometries');
      return null;
    }
    
    const THREE = window.THREE;
    let geometry;
    
    try {
      switch(shape?.toLowerCase()) {
        case 'sphere':
          geometry = new THREE.SphereGeometry(size, 16, 16);
          break;
        case 'cube':
        case 'box':
          geometry = new THREE.BoxGeometry(size, size, size);
          break;
        case 'cylinder':
          geometry = new THREE.CylinderGeometry(size/2, size/2, size, 16);
          break;
        case 'cone':
          geometry = new THREE.ConeGeometry(size/2, size, 16);
          break;
        case 'pyramid':
        case 'tetrahedron':
          geometry = new THREE.TetrahedronGeometry(size);
          break;
        case 'octahedron':
          geometry = new THREE.OctahedronGeometry(size);
          break;
        case 'dodecahedron':
          geometry = new THREE.DodecahedronGeometry(size);
          break;
        case 'icosahedron':
          geometry = new THREE.IcosahedronGeometry(size);
          break;
        case 'torus':
          geometry = new THREE.TorusGeometry(size/2, size/4, 16, 32);
          break;
        default:
          // Default to sphere
          geometry = new THREE.SphereGeometry(size, 16, 16);
      }
      return geometry;
    } catch (e) {
      console.error('Error creating geometry:', e);
      try {
        // Return a simple sphere as fallback
        return new THREE.SphereGeometry(size, 8, 8);
      } catch (fallbackError) {
        console.error('Failed to create fallback geometry:', fallbackError);
        return null;
      }
    }
  }
  
  // Apply 3D shape to node based on its type
  function applyTypeShapeToNode(node, typeData) {
    // Make sure THREE is defined
    if (!window.THREE) {
      console.log('Accessing THREE via ForceGraph3D...');
      if (window.ForceGraph3D && window.ForceGraph3D.THREE) {
        window.THREE = window.ForceGraph3D.THREE;
      }
    }
    
    // Fallback - try to get THREE from the graph object
    if (!window.THREE && graph && graph.constructor && graph.constructor.THREE) {
      console.log('Accessing THREE via graph constructor...');
      window.THREE = graph.constructor.THREE;
    }
    
    if (!window.THREE) {
      console.error('THREE.js not available for creating node objects, falling back to default rendering');
      return false; // Return false to use default sphere
    }
    
    const THREE = window.THREE;
    
    if (!typeData) {
      console.log('No type data available for node:', node);
      // Use default sphere with color based on kind
      const defaultColors = {
        object: 0x3498db,    // Blue
        agent: 0x2ecc71,     // Green
        material: 0xe67e22,  // Orange
        environment: 0x9b59b6, // Purple
        interaction: 0xe74c3c // Red
      };
      
      const colorValue = defaultColors[node.kind] || 0xff9500; // Default orange
      
      try {
        // Create default geometry based on kind
        const geometry = new THREE.SphereGeometry(1, 16, 16);
        
        // Create material
        const material = new THREE.MeshLambertMaterial({ 
          color: colorValue,
          transparent: true,
          opacity: 0.75
        });
        
        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        
        return mesh;
      } catch (e) {
        console.error('Error creating default node shape:', e);
        return null;
      }
    }
    
    try {
      // Extract shape and color from type
      const shape = typeData.symbol || 'sphere';
      let color = typeData.color || '0xffffff';
      
      // Color normalization process
      let colorValue;
      
      // Handle different color formats
      if (typeof color === 'string') {
        if (color.startsWith('0x')) {
          // 0xRRGGBB format -> parse as hex
          colorValue = parseInt(color.substring(2), 16);
        } else if (color.startsWith('#')) {
          // #RRGGBB format -> parse as hex without #
          colorValue = parseInt(color.substring(1), 16);
        } else if (/^[0-9A-Fa-f]{6}$/.test(color)) {
          // RRGGBB format without prefix
          colorValue = parseInt(color, 16);
        } else {
          // Default color for unrecognized format
          colorValue = 0xff9500; // Default orange
          console.warn('Unrecognized color format:', color);
        }
      } else if (typeof color === 'number') {
        // Already a number
        colorValue = color;
      } else {
        // Default for any other type
        colorValue = 0xff9500;
        console.warn('Unrecognized color type:', typeof color);
      }
      
      console.log(`Creating shape: ${shape} with color: ${color} (normalized to: 0x${colorValue.toString(16).padStart(6, '0')})`);
      
      // Create custom geometry
      const geometry = createNodeGeometry(shape);
      if (!geometry) {
        throw new Error('Failed to create geometry');
      }
      
      // Create material
      const material = new THREE.MeshLambertMaterial({ 
        color: colorValue,
        transparent: true,
        opacity: 0.75
      });
      
      // Create mesh
      const mesh = new THREE.Mesh(geometry, material);
      
      // Add outline
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide
      });
      
      const outlineMesh = new THREE.Mesh(geometry, outlineMaterial);
      outlineMesh.scale.multiplyScalar(1.1);
      
      // Add meshes to a group
      const group = new THREE.Group();
      group.add(mesh);
      group.add(outlineMesh);
      
      // Store original color for interactions
      mesh.userData.originalColor = colorValue;
      
      // Return the customized object
      return group;
    } catch (e) {
      console.error('Error creating 3D shape for node:', e);
      return null;
    }
  }
  
  // Apply custom 3D objects to each node
  function applyCustomObjectsToNodes() {
    if (!graph || !graphData || !graphData.nodes) return;

    try {
      graph.nodeThreeObject(node => {
        try {
          const typeId = node.typeId || node.type;
          if (typeId && types[typeId]) {
            const typeData = types[typeId];
            const object = applyTypeShapeToNode(node, typeData);
            if (object) return object;
          }
          
          // Default sphere if no type data found or error occurred
          if (window.THREE) {
            const geometry = new THREE.SphereGeometry(5);
            const material = new THREE.MeshLambertMaterial({ 
              color: node.color || 0xffffff,
              transparent: true,
              opacity: 0.75
            });
            return new THREE.Mesh(geometry, material);
          } else {
            return null; // Fall back to default rendering
          }
        } catch (e) {
          console.error('Error in nodeThreeObject:', e);
          return null; // Fall back to default rendering
        }
      });
    } catch (e) {
      console.error('Error applying custom objects to nodes:', e);
    }
  }
  
  // Custom link renderer for different link types
  function setupCustomLinks() {
    graph.linkCurvature(link => link.lineType === 'curved' ? 0.25 : 0)
      .linkWidth(link => link.lineType === 'thick' ? 2 : 1)
      .linkOpacity(0.8)
      .linkDirectionalParticles(link => {
        // Only add particles for interaction links
        console.log('Checking link predicate:', link.predicate);
        if (link.predicate === 'interactWith' || link.predicate === 'interaction' || link.predicate === 'connectsTo') {
          return 4;
        }
        return 0;
      })
      .linkDirectionalParticleWidth(2)
      .linkDirectionalParticleSpeed(0.006); // Slower particles for better visibility
  }
  
  // Load graph data from the server
  async function loadGraphData() {
    try {
      // Get current perspective
      const activePerspective = document.getElementById('active-perspective')?.textContent || 'default';
      
      console.log(`Loading graph data for perspective: ${activePerspective}`);
      
      // Fetch types first
      const typesResponse = await fetch('/api/types');
      if (typesResponse.ok) {
        const typesList = await typesResponse.json();
        
        // Convert to a map for faster lookup
        types = {};
        typesList.forEach(type => {
          const typeKey = type._id || (type._key ? `types/${type._key}` : null);
          if (typeKey) {
            types[typeKey] = type;
          }
        });
        
        console.log(`Loaded ${Object.keys(types).length} types for visualization`);
      } else {
        console.error('Failed to load types:', typesResponse.statusText);
      }
      
      // Fetch entities
      const entitiesResponse = await fetch(`/api/entities?perspective=${activePerspective}`);
      if (entitiesResponse.ok) {
        const entities = await entitiesResponse.json();
        console.log(`Loaded ${entities.length} entities for visualization`);
        
        // Create nodes from entities
        const nodes = entities.map(entity => {
          // Format entity data into node format
          const nodeId = entity._id || `entities/${entity._key}`;
          
          // Log entity info for debugging
          console.log(`Processing entity for visualization:`, {
            id: nodeId,
            label: entity.label,
            name: entity.name,
            kind: entity.kind,
            type: entity.type
          });
          
          return {
            id: nodeId,
            // Make sure we have a fallback label
            label: entity.label || entity.name || 'Unnamed Entity',
            kind: entity.kind || 'object',
            typeId: entity.type,
            color: (entity.type && types[entity.type]?.color) || '#ffffff',
            // Use props for additional data
            ...entity.props
          };
        });
        
        // Create a lookup map for entity IDs
        const nodeIds = new Set(nodes.map(n => n.id));
        
        // Fetch relations
        const relationsResponse = await fetch('/api/relations');
        if (relationsResponse.ok) {
          const relations = await relationsResponse.json();
          console.log(`Loaded ${relations.length} relations for visualization`);
          
          // Filter out relations with non-existent source or target
          const validRelations = relations.filter(relation => {
            const fromExists = relation._from && nodeIds.has(relation._from);
            const toExists = relation._to && nodeIds.has(relation._to);
            
            if (!fromExists || !toExists) {
              console.warn(`Skipping relation with missing endpoint: ${relation._from} -> ${relation._to}`);
              return false;
            }
            return true;
          });
          
          // Create links from relations
          const links = validRelations.map(relation => ({
            source: relation._from,
            target: relation._to,
            predicate: relation.predicate || relation.name,
            lineType: relation.lineType || 'solid'
          }));
          
          // Update graph data
          graphData = { nodes, links };
          graph.graphData(graphData);
          
          // Apply custom objects after data is loaded
          applyCustomObjectsToNodes();
          setupCustomLinks();
          
          console.log('Graph data loaded and visualization updated');
        } else {
          console.error('Failed to load relations:', relationsResponse.statusText);
        }
      } else {
        console.error('Failed to load entities:', entitiesResponse.statusText);
      }
    } catch (error) {
      console.error('Error loading graph data:', error);
    }
    
    return Promise.resolve(); // Always resolve so we can chain promises
  }
  
  // Listen for perspective changes
  document.addEventListener('perspectiveChanged', (event) => {
    console.log('Perspective changed, reloading graph data');
    loadGraphData();
  });
  
  // Listen for entity changes
  document.addEventListener('entityCreated', (event) => {
    console.log('Entity created, updating graph');
    loadGraphData(); // Reload all data for simplicity
  });
  
  document.addEventListener('entityUpdated', (event) => {
    console.log('Entity updated, updating graph');
    loadGraphData(); // Reload all data for simplicity
  });
  
  document.addEventListener('entityDeleted', (event) => {
    console.log('Entity deleted, updating graph');
    loadGraphData(); // Reload all data for simplicity
  });
  
  // Listen for relation changes
  document.addEventListener('relationCreated', (event) => {
    console.log('Relation created, updating graph');
    loadGraphData(); // Reload all data for simplicity
  });
  
  document.addEventListener('relationUpdated', (event) => {
    console.log('Relation updated, updating graph');
    loadGraphData(); // Reload all data for simplicity
  });
  
  document.addEventListener('relationDeleted', (event) => {
    console.log('Relation deleted, updating graph');
    loadGraphData(); // Reload all data for simplicity
  });
  
  // Listen for type changes
  document.addEventListener('typeCreated', (event) => {
    console.log('Type created, updating types cache');
    if (event.detail && event.detail.type) {
      const type = event.detail.type;
      const typeKey = type._id || (type._key ? `types/${type._key}` : null);
      if (typeKey) {
        types[typeKey] = type;
        applyCustomObjectsToNodes();
      }
    }
  });
  
  document.addEventListener('typeUpdated', (event) => {
    console.log('Type updated, updating graph');
    loadGraphData(); // Reload all data for simplicity
  });
  
  document.addEventListener('typeDeleted', (event) => {
    console.log('Type deleted, updating graph');
    loadGraphData(); // Reload all data for simplicity
  });
  
  // Make graph container visible when we're ready to show it
  function showGraphContainer() {
    if (graphContainer) {
      graphContainer.style.display = 'block';
    }
  }
  
  // Hide loader (if exists)
  function hideLoader() {
    const loader = document.getElementById('graph-loader');
    if (loader) {
      loader.style.display = 'none';
    }
  }
  
  // Initial load
  loadGraphData().then(() => {
    showGraphContainer();
    hideLoader();
  });
});
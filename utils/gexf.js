/**
 * GEXF Parser Utility
 * 
 * This module provides functions to parse GEXF (Graph Exchange XML Format) files
 * and convert them to a JavaScript object structure for visualization.
 */

/**
 * Parse a GEXF XML string into a JavaScript object
 * @param {string} xmlText - The GEXF file content as string
 * @returns {Object} - Object with nodes and edges arrays
 */
export function parse(xmlText) {
  console.log('[GEXF] Parsing GEXF XML string');
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error('[GEXF] XML parsing error:', parseError.textContent);
      throw new Error('XML parsing error: ' + parseError.textContent);
    }
    
    console.log('[GEXF] XML parsed successfully, extracting nodes and edges');
    
    // Parse nodes
    const nodes = parseNodes(xmlDoc);
    console.log(`[GEXF] Parsed ${nodes.length} nodes`);
    
    // Parse edges
    const edges = parseEdges(xmlDoc);
    console.log(`[GEXF] Parsed ${edges.length} edges`);
    
    return { nodes, edges };
  } catch (error) {
    console.error('[GEXF] Error parsing GEXF:', error);
    // Return empty data structure on error
    return { nodes: [], edges: [] };
  }
}

/**
 * Parse attribute definitions from GEXF XML document
 * @param {Document} xmlDoc - XML document
 * @returns {Object} - Map of attribute IDs to attribute definitions
 */
function parseAttributeDefinitions(xmlDoc) {
  const attrDefs = {};
  const attributes = xmlDoc.getElementsByTagName("attribute");
  
  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes[i];
    const id = attr.getAttribute("id");
    const title = attr.getAttribute("title");
    const type = attr.getAttribute("type");
    
    if (id && title) {
      attrDefs[id] = { id, title, type };
    }
  }
  
  return attrDefs;
}

/**
 * Parse nodes from GEXF XML document
 * @param {Document} xmlDoc - XML document
 * @returns {Array} - Array of node objects
 */
function parseNodes(xmlDoc) {
  console.log('[GEXF] Extracting nodes from XML');
  const nodeElements = xmlDoc.getElementsByTagName("node");
  const nodes = [];
  
  // Get attribute definitions to find attribute IDs
  const attrDefs = parseAttributeDefinitions(xmlDoc);
  
  for (let i = 0; i < nodeElements.length; i++) {
    const nodeEl = nodeElements[i];
    try {
      const id = nodeEl.getAttribute("id");
      const label = nodeEl.getAttribute("label") || id;
      
      // Initialize node with default values
      const node = {
        id,
        label,
        color: "#ffffff",
        level: 0,
        size: 5,
        description: ""
      };
      
      // Parse attribute values
      const attValues = nodeEl.getElementsByTagName("attvalue");
      for (let j = 0; j < attValues.length; j++) {
        const attValue = attValues[j];
        const attrId = attValue.getAttribute("for");
        const value = attValue.getAttribute("value");
        
        // Map attribute values to node properties based on attribute definitions
        if (attrDefs[attrId]) {
          const attrName = attrDefs[attrId].title.toLowerCase();
          
          if (attrName === 'color' || attrName.includes('color')) {
            node.color = value;
          } else if (attrName === 'level' || attrName.includes('level')) {
            node.level = parseInt(value) || 0;
          } else if (attrName === 'size' || attrName.includes('size')) {
            node.size = parseInt(value) || 5;
          } else if (attrName === 'description' || attrName.includes('desc')) {
            node.description = value;
          }
        }
      }
      
      // Also check for viz namespace elements for color and size
      const vizColor = nodeEl.getElementsByTagName("viz:color")[0];
      if (vizColor) {
        const r = vizColor.getAttribute("r") || "255";
        const g = vizColor.getAttribute("g") || "255";
        const b = vizColor.getAttribute("b") || "255";
        node.color = `rgb(${r},${g},${b})`;
      }
      
      const vizSize = nodeEl.getElementsByTagName("viz:size")[0];
      if (vizSize) {
        node.size = parseFloat(vizSize.getAttribute("value")) || 5;
      }
      
      nodes.push(node);
    } catch (e) {
      console.warn(`[GEXF] Error parsing node ${i}:`, e);
    }
  }
  
  return nodes;
}

/**
 * Parse edges from GEXF XML document
 * @param {Document} xmlDoc - XML document
 * @returns {Array} - Array of edge objects
 */
function parseEdges(xmlDoc) {
  console.log('[GEXF] Extracting edges from XML');
  const edgeElements = xmlDoc.getElementsByTagName("edge");
  const edges = [];
  
  for (let i = 0; i < edgeElements.length; i++) {
    const edgeEl = edgeElements[i];
    try {
      const id = edgeEl.getAttribute("id") || `e${i}`;
      const source = edgeEl.getAttribute("source");
      const target = edgeEl.getAttribute("target");
      const weight = parseFloat(edgeEl.getAttribute("weight") || "1.0");
      
      if (source && target) {
        const edge = { 
          id, 
          source, 
          target, 
          weight
        };
        
        // Check for additional edge attributes
        const attValues = edgeEl.getElementsByTagName("attvalue");
        for (let j = 0; j < attValues.length; j++) {
          const attValue = attValues[j];
          const attrId = attValue.getAttribute("for");
          const value = attValue.getAttribute("value");
          
          // Store any additional attributes
          edge[`attr_${attrId}`] = value;
        }
        
        edges.push(edge);
      } else {
        console.warn(`[GEXF] Edge missing source or target: ${id}`);
      }
    } catch (e) {
      console.warn(`[GEXF] Error parsing edge ${i}:`, e);
    }
  }
  
  return edges;
}

/**
 * Export graph data to GEXF format
 * @param {Object} graph - Graph data object with nodes and edges
 * @returns {string} - GEXF XML string
 */
export function exportToGexf(graph) {
  // Implementation for export if needed
  return '';
} 
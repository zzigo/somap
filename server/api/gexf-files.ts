import { defineEventHandler } from 'h3';
import { readdir } from 'fs/promises';
import { resolve } from 'path';

export default defineEventHandler(async (event) => {
  try {
    // Get the public directory path
    const publicDir = resolve(process.cwd(), 'public');
    console.log(`[Server] Scanning for GEXF files in ${publicDir}`);
    
    // Read the directory
    const files = await readdir(publicDir);
    
    // Filter for .gexf files
    const gexfFiles = files.filter(file => file.endsWith('.gexf'));
    
    console.log(`[Server] Found ${gexfFiles.length} GEXF files: ${gexfFiles.join(', ')}`);
    
    return gexfFiles;
  } catch (error) {
    console.error('[Server] Error scanning for GEXF files:', error);
    return [];
  }
}); 
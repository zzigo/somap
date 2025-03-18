# SOMAP Visualization

A network visualization tool for GEXF files.

## Features

- Multiple visualization modes (3D, Flat 2D, Color Neighbors)
- Keyboard shortcuts for quick navigation
- Interactive graph display with physics simulation
- File selection dropdown for quick switching between graphs
- Debug panel for development and troubleshooting

## Keyboard Shortcuts

- **Alt+Shift+1**: Switch to Default 3D visualization mode
- **Alt+Shift+2**: Switch to Color Neighbors visualization mode  
- **Alt+Shift+3**: Switch to Flat 2D visualization mode
- **Alt+Shift+Left**: Navigate to previous network file
- **Alt+Shift+Right**: Navigate to next network file

## Debugging Features

The application includes built-in debugging features to help identify and resolve issues:

- Console logging for key events (mode changes, file loading, etc.)
- Debug panel showing current state
- Network request tracking
- Keyboard event monitoring
- Component lifecycle tracking

## Running the Project

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Deploying

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## File Format Support

The application is designed to work with GEXF (Graph Exchange XML Format) files. Place your .gexf files in the `/public` directory to make them available for visualization.

Example GEXF structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.3" version="1.3">
  <graph mode="static" defaultedgetype="directed">
    <attributes class="node">
      <attribute id="0" title="color" type="string" />
      <attribute id="1" title="size" type="integer" />
      <attribute id="2" title="level" type="integer" />
    </attributes>
    <nodes>
      <node id="n0" label="Node 0">
        <attvalue for="0" value="#ff0000" />
        <attvalue for="1" value="10" />
        <attvalue for="2" value="0" />
      </node>
      <!-- More nodes... -->
    </nodes>
    <edges>
      <edge id="e0" source="n0" target="n1" />
      <!-- More edges... -->
    </edges>
  </graph>
</gexf>
```

## Troubleshooting

If visualization modes are not working:

1. Check the browser console for errors
2. Ensure the .gexf file is properly formatted
3. Try reloading the page
4. Verify that keyboard shortcuts are working by checking the debug panel

## License

[MIT](LICENSE)

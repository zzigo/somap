const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');

const wss = new WebSocketServer({ port: 3001 });

wss.on('connection', ws => {
  console.log('Client connected for live reload');
  ws.on('close', () => console.log('Client disconnected'));
});

chokidar.watch('/opt/somap/public').on('change', (path) => {
  console.log(`File changed: ${path}`);
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send('reload');
    }
  });
});

console.log('Live reload server running on ws://0.0.0.0:3001');
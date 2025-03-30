import { Hono } from 'hono';
import { serve } from 'bun';

const app = new Hono();

// SSE
app.get('/live/t1-cluster', (c) => {
  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        const data = JSON.stringify({ time: Date.now() });
        controller.enqueue(`data: ${data}\n\n`);
      }, 1000);
      c.req.raw.addEventListener('close', () => clearInterval(interval));
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  });
});

// WebSocket
app.get('/live/t1-ws', (c) => {
  if (c.req.raw.headers.get('upgrade') !== 'websocket') {
    return c.text('Expected a WebSocket request', 400);
  }

  const { socket, response } = Bun.upgradeWebSocket(c.req.raw, {
    open(ws) {
      console.log('🔌 WebSocket connected');
      ws.send('Welcome!');
    },
    message(ws, message) {
      console.log('📨 Received:', message);
      ws.send(`Echo: ${message}`);
    },
    close(ws) {
      console.log('❌ WebSocket closed');
    }
  });

  return response;
});

// 👇 Corrección clave
serve({
  port: 3001,
  fetch: app.fetch
});
import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, createExedra } from '../src';

function streamRequest(
  app: express.Application,
  path: string,
): Promise<{ res: http.IncomingMessage; chunks: Buffer[] }> {
  return new Promise((resolve, reject) => {
    let server: http.Server;
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('timeout'));
    }, 5000);
    server = app.listen(0, () => {
      const addr = server.address() as any;
      http.get(`http://localhost:${addr.port}${path}`, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (d: Buffer) => chunks.push(d));
        res.on('end', () => {
          clearTimeout(timer);
          server.close();
          resolve({ res, chunks });
        });
      });
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Path('/stream')
class StreamController extends Controller {
  @Get('/raw')
  getRaw(_req: express.Request, res: express.Response) {
    res.setHeader('Content-Type', 'text/plain');
    res.write('chunk-1\n');
    res.write('chunk-2\n');
    res.write('chunk-3\n');
    res.end();
  }

  @Get('/sse')
  getSse(_req: express.Request, res: express.Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write('data: event-1\n\n');
    res.write('data: event-2\n\n');
    res.write('data: event-3\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

class RootController extends Controller {
  groupStream() {
    return StreamController;
  }
}

function buildApp() {
  const app = express();
  createExedra(app, { controller: RootController });
  return app;
}

describe('Streaming support', () => {
  it('raw chunked: all chunks arrive in order', async () => {
    const app = buildApp();
    const { chunks } = await streamRequest(app, '/stream/raw');
    const body = Buffer.concat(chunks).toString();
    expect(body).toBe('chunk-1\nchunk-2\nchunk-3\n');
  });

  it('raw chunked: status is 200', async () => {
    const app = buildApp();
    const { res } = await streamRequest(app, '/stream/raw');
    expect(res.statusCode).toBe(200);
  });

  it('SSE: all events arrive in order with [DONE]', async () => {
    const app = buildApp();
    const { chunks } = await streamRequest(app, '/stream/sse');
    const body = Buffer.concat(chunks).toString();
    const lines = body.split('\n').filter((l) => l.startsWith('data:'));
    expect(lines).toEqual(['data: event-1', 'data: event-2', 'data: event-3', 'data: [DONE]']);
  });

  it('SSE: correct content-type and cache-control headers', async () => {
    const app = buildApp();
    const { res } = await streamRequest(app, '/stream/sse');
    expect(res.headers['content-type']).toBe('text/event-stream');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('no double-send: framework skips res.json when handler streams manually', async () => {
    const app = buildApp();
    const { res, chunks } = await streamRequest(app, '/stream/raw');
    const body = Buffer.concat(chunks).toString();
    // If the framework had called res.json(), the body would be wrapped in JSON
    // (e.g. "\"chunk-1\\nchunk-2\\nchunk-3\\n\"") or the response would have
    // Content-Type: application/json. Verify it's plain text.
    expect(res.headers['content-type']).toBe('text/plain');
    expect(body).toBe('chunk-1\nchunk-2\nchunk-3\n');
    expect(body).not.toContain('"');
  });
});

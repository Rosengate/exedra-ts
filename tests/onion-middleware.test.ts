import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, createExedra } from '../src';

function request(
  app: express.Application,
  path: string,
  options: { method?: string; body?: any } = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let server: http.Server;
    const timer = setTimeout(() => { server.close(); reject(new Error('timeout')); }, 5000);
    server = app.listen(0, () => {
      const addr = server.address() as any;
      const method = (options.method || 'GET').toUpperCase();
      http.request(`http://localhost:${addr.port}${path}`, { method }, (res) => {
        let body = '';
        res.on('data', (d: Buffer) => (body += d));
        res.on('end', () => {
          clearTimeout(timer);
          server.close();
          resolve({ status: res.statusCode || 0, body });
        });
      }).on('error', (err) => { clearTimeout(timer); server.close(); reject(err); }).end();
    });
  });
}

describe('Onion-style middleware', () => {
  describe('await next() — catch downstream errors', () => {
    it('middleware catches sync throw from downstream middleware', async () => {
      const order: string[] = [];

      @Path('/items')
      class ItemsController extends Controller {
        async middlewareOuter(
          req: express.Request,
          res: express.Response,
          next: express.NextFunction,
        ) {
          try {
            order.push('outer-before');
            await next();
            order.push('outer-after');
          } catch (err: any) {
            order.push('outer-catch');
            res.status(500).json({ error: err.message });
          }
        }

        middlewareInner(
          _req: express.Request,
          _res: express.Response,
          _next: express.NextFunction,
        ) {
          order.push('inner');
          throw new Error('inner error');
        }

        @Get('')
        getItems() {
          order.push('handler');
          return { data: [] };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(500);
      expect(JSON.parse(res.body)).toEqual({ error: 'inner error' });
      expect(order).toEqual(['outer-before', 'inner', 'outer-catch']);
    });

    it('middleware catches async throw from downstream middleware', async () => {
      const order: string[] = [];

      @Path('/items')
      class ItemsController extends Controller {
        async middlewareOuter(
          req: express.Request,
          res: express.Response,
          next: express.NextFunction,
        ) {
          try {
            order.push('outer-before');
            await next();
            order.push('outer-after');
          } catch (err: any) {
            order.push('outer-catch');
            res.status(500).json({ error: err.message });
          }
        }

        async middlewareInner(
          _req: express.Request,
          _res: express.Response,
          _next: express.NextFunction,
        ) {
          order.push('inner-before');
          await new Promise((_, reject) => setTimeout(() => reject(new Error('async error')), 5));
          order.push('inner-after');
        }

        @Get('')
        getItems() {
          order.push('handler');
          return { data: [] };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(500);
      expect(JSON.parse(res.body)).toEqual({ error: 'async error' });
      expect(order).toEqual(['outer-before', 'inner-before', 'outer-catch']);
    });

    it('middleware catches error from route handler', async () => {
      const order: string[] = [];

      @Path('/items')
      class ItemsController extends Controller {
        async middlewareOuter(
          req: express.Request,
          res: express.Response,
          next: express.NextFunction,
        ) {
          try {
            order.push('outer-before');
            await next();
            order.push('outer-after');
          } catch (err: any) {
            order.push('outer-catch');
            res.status(500).json({ error: err.message });
          }
        }

        @Get('')
        getItems() {
          order.push('handler');
          throw new Error('handler error');
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(500);
      expect(JSON.parse(res.body)).toEqual({ error: 'handler error' });
      expect(order).toEqual(['outer-before', 'handler', 'outer-catch']);
    });

    it('onion model — outer middleware runs after downstream completes', async () => {
      const order: string[] = [];

      @Path('/items')
      class ItemsController extends Controller {
        async middlewareOuter(
          _req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          order.push('outer-before');
          await next();
          order.push('outer-after');
        }

        @Get('')
        getItems() {
          order.push('handler');
          return { data: [] };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(order).toEqual(['outer-before', 'handler', 'outer-after']);
    });

    it('multiple middleware — nested onion layers', async () => {
      const order: string[] = [];

      @Path('/items')
      class ItemsController extends Controller {
        async middlewareA(
          _req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          order.push('a-before');
          await next();
          order.push('a-after');
        }

        async middlewareB(
          _req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          order.push('b-before');
          await next();
          order.push('b-after');
        }

        @Get('')
        getItems() {
          order.push('handler');
          return { data: [] };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(order).toEqual(['a-before', 'b-before', 'handler', 'b-after', 'a-after']);
    });

    it('middleware without await next() still works (backward compat)', async () => {
      const order: string[] = [];

      @Path('/items')
      class ItemsController extends Controller {
        middlewareLegacy(
          _req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          order.push('legacy');
          next();
        }

        @Get('')
        getItems() {
          order.push('handler');
          return { data: [] };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(order).toEqual(['legacy', 'handler']);
    });
  });

  describe('await next() returns handler result', () => {
    it('middleware receives handler result from await next()', async () => {
      let capturedResult: any = null;

      @Path('/items')
      class ItemsController extends Controller {
        async middlewareCapture(
          req: express.Request,
          res: express.Response,
          next: express.NextFunction,
        ) {
          capturedResult = await (next as any)();
        }

        @Get('')
        getItems() {
          return { data: [1, 2, 3] };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(capturedResult).toEqual({ data: [1, 2, 3] });
    });

    it('middleware can modify handler result and send custom response', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        async middlewareTransform(
          req: any,
          res: express.Response,
          next: express.NextFunction,
        ) {
          const result = await (next as any)();
          if (result && !res.headersSent) {
            res.json({ wrapped: true, data: result });
          }
        }

        @Get('')
        getItems() {
          return { data: [1, 2, 3] };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ wrapped: true, data: { data: [1, 2, 3] } });
    });

    it('middleware return value replaces handler response', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        async middlewareProfile(
          req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          const response = await (next as any)();
          return { data: response };
        }

        @Get('')
        getItems() {
          return { test: 'ok?' };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ data: { test: 'ok?' } });
    });
  });
});

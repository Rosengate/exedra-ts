import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, Param, createExedra } from '../src';

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

  describe('multi-layer error handling', () => {
    it('each middleware layer catches its own error type', async () => {
      class DatabaseError extends Error {
        code = 'DB_ERROR';
      }

      class AuthError extends Error {
        code = 'AUTH_ERROR';
      }

      @Path('/items')
      class ItemsController extends Controller {
        async middlewareDatabase(
          _req: any,
          res: express.Response,
          next: express.NextFunction,
        ) {
          try {
            await next();
          } catch (err: any) {
            if (err.code === 'DB_ERROR') {
              res.status(503).json({ error: 'Database unavailable' });
            } else {
              throw err;
            }
          }
        }

        async middlewareAuth(
          _req: any,
          res: express.Response,
          next: express.NextFunction,
        ) {
          try {
            await next();
          } catch (err: any) {
            if (err.code === 'AUTH_ERROR') {
              res.status(401).json({ error: 'Unauthorized' });
            } else {
              throw err;
            }
          }
        }

        @Get('')
        getItems() {
          throw new DatabaseError('Connection refused');
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(503);
      expect(JSON.parse(res.body)).toEqual({ error: 'Database unavailable' });
    });

    it('error bubbles through layers that dont handle it', async () => {
      class ForbiddenError extends Error {
        status = 403;
      }

      @Path('/items')
      class ItemsController extends Controller {
        async middlewareRateLimit(
          _req: any,
          res: express.Response,
          next: express.NextFunction,
        ) {
          try {
            await next();
          } catch (err: any) {
            if (err.code === 'RATE_LIMITED') {
              res.status(429).json({ error: 'Too many requests' });
            } else {
              throw err;
            }
          }
        }

        async middlewareAuth(
          _req: any,
          res: express.Response,
          next: express.NextFunction,
        ) {
          try {
            await next();
          } catch (err: any) {
            if (err instanceof ForbiddenError) {
              res.status(403).json({ error: 'Access denied' });
            } else {
              throw err;
            }
          }
        }

        @Get('')
        getItems() {
          throw new ForbiddenError('No access');
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: 'Access denied' });
    });

    it('global catch-all handles unhandled errors', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        async middlewareGlobalError(
          _req: any,
          res: express.Response,
          next: express.NextFunction,
        ) {
          try {
            await next();
          } catch {
            res.status(500).json({ error: 'Internal server error' });
          }
        }

        @Get('')
        getItems() {
          throw new Error('Something unexpected');
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(500);
      expect(JSON.parse(res.body)).toEqual({ error: 'Internal server error' });
    });

    it('handler throws domain error — correct layer catches it', async () => {
      class NotFoundError extends Error {
        statusCode = 404;
      }

      @Path('/items')
      class ItemsController extends Controller {
        async middlewareNotFound(
          _req: any,
          res: express.Response,
          next: express.NextFunction,
        ) {
          try {
            await next();
          } catch (err: any) {
            if (err.statusCode === 404) {
              res.status(404).json({ error: err.message });
            } else {
              throw err;
            }
          }
        }

        @Get('/:id')
        getItem(req: express.Request) {
          const id = req.params.id;
          if (id === '999') throw new NotFoundError('Item not found');
          return { id, name: 'Widget' };
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const found = await request(app, '/items/1');
      expect(found.status).toBe(200);
      expect(JSON.parse(found.body)).toEqual({ id: '1', name: 'Widget' });

      const notFound = await request(app, '/items/999');
      expect(notFound.status).toBe(404);
      expect(JSON.parse(notFound.body)).toEqual({ error: 'Item not found' });
    });
  });
});

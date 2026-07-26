import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, Middleware, createExedra } from '../src';
import { getMetadata } from '../src/metadata';

function request(app: express.Application, path: string): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    let server: http.Server;
    const timer = setTimeout(() => { server.close(); reject(new Error('timeout')); }, 5000);
    server = app.listen(0, () => {
      const addr = server.address() as any;
      http.get(`http://localhost:${addr.port}${path}`, (res) => {
        let body = '';
        res.on('data', (d: Buffer) => (body += d));
        res.on('end', () => {
          clearTimeout(timer);
          server.close();
          resolve({ status: res.statusCode || 0, body, headers: res.headers });
        });
      });
    });
  });
}

describe('@Middleware attribute', () => {
  describe('metadata storage', () => {
    it('stores middleware in class-level metadata', () => {
      @Middleware('AuthMiddleware')
      class TestController extends Controller {}

      const meta = getMetadata(TestController);
      expect(meta.middleware).toContain('AuthMiddleware');
    });

    it('stores middleware in method-level metadata', () => {
      class TestController {
        @Middleware('LogMiddleware')
        @Get('/test')
        getTest() {}
      }

      const meta = getMetadata(TestController, 'getTest');
      expect(meta.middleware).toContain('LogMiddleware');
    });

    it('accumulates multiple @Middleware decorators', () => {
      @Middleware('AuthMiddleware')
      @Middleware('CorsMiddleware')
      class TestController extends Controller {}

      const meta = getMetadata(TestController);
      // Decorators are applied bottom-up: CorsMiddleware first, then AuthMiddleware
      expect(meta.middleware).toEqual(['CorsMiddleware', 'AuthMiddleware']);
    });
  });

  describe('middleware execution', () => {
    it('middleware* prefix methods execute for routes in the group', async () => {
      const order: string[] = [];

      @Path('/items')
      class ItemsController extends Controller {
        middlewareAuth(
          _req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          order.push('auth');
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

      await request(app, '/items');
      expect(order).toEqual(['auth', 'handler']);
    });

    it('multiple middleware* methods run in definition order', async () => {
      const order: string[] = [];

      @Path('/items')
      class ItemsController extends Controller {
        middlewareFirst(
          _req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          order.push('first');
          next();
        }

        middlewareSecond(
          _req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          order.push('second');
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

      await request(app, '/items');
      expect(order).toEqual(['first', 'second', 'handler']);
    });

    it('middleware can short-circuit by sending response', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        middlewareBlock(
          _req: express.Request,
          res: express.Response,
          _next: express.NextFunction,
        ) {
          res.status(403).json({ error: 'blocked' });
        }

        @Get('')
        getItems() {
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
      expect(res.status).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: 'blocked' });
    });

    it('middleware can modify request and handler sees it', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        middlewareTag(
          req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          (req as any).tagged = true;
          next();
        }

        @Get('')
        getItems(req: express.Request) {
          return { tagged: (req as any).tagged };
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
      expect(JSON.parse(res.body)).toEqual({ tagged: true });
    });
  });

  describe('@Middleware vs middleware* coexistence', () => {
    it('@Middleware function runs alongside middleware* methods', async () => {
      const order: string[] = [];

      function ExternalMiddleware(
        _req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) {
        order.push('external');
        next();
      }

      @Middleware(ExternalMiddleware as any)
      @Path('/items')
      class ItemsController extends Controller {
        middlewareInternal(
          _req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          order.push('internal');
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
      // Class-level @Middleware runs first (added via group.addMiddleware),
      // then middleware* methods (added during method iteration)
      expect(order).toEqual(['external', 'internal', 'handler']);
    });
  });
});

import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, Post, Middleware, createExedra } from '../src';

function request(
  app: express.Application,
  path: string,
  options: { method?: string; body?: any; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    let server: http.Server;
    const timer = setTimeout(() => { server.close(); reject(new Error('timeout')); }, 5000);
    server = app.listen(0, () => {
      const addr = server.address() as any;
      const method = (options.method || 'GET').toUpperCase();
      const reqOpts: http.RequestOptions = {
        hostname: 'localhost',
        port: addr.port,
        path,
        method,
        headers: { 'content-type': 'application/json', ...options.headers },
      };
      const req = http.request(reqOpts, (res) => {
        let body = '';
        res.on('data', (d: Buffer) => (body += d));
        res.on('end', () => {
          clearTimeout(timer);
          server.close();
          resolve({ status: res.statusCode || 0, body, headers: res.headers });
        });
      });
      req.on('error', (err) => { clearTimeout(timer); server.close(); reject(err); });
      if (options.body) req.write(JSON.stringify(options.body));
      req.end();
    });
  });
}

describe('Express middleware backward compatibility', () => {
  describe('sync middleware — fire and forget', () => {
    it('middleware that calls next() without return works', async () => {
      const order: string[] = [];

      @Path('/items')
      class ItemsController extends Controller {
        middlewareAuth(req: express.Request, _res: express.Response, next: express.NextFunction) {
          order.push('auth');
          (req as any).user = 'alice';
          next();
        }

        @Get('')
        getItems(req: express.Request) {
          order.push('handler');
          return { user: (req as any).user };
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ user: 'alice' });
      expect(order).toEqual(['auth', 'handler']);
    });

    it('sync middleware modifying req works', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        middlewareTag(req: express.Request, _res: express.Response, next: express.NextFunction) {
          (req as any).tags = ['v1', 'internal'];
          next();
        }

        @Get('')
        getItems(req: express.Request) {
          return { tags: (req as any).tags };
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(JSON.parse(res.body)).toEqual({ tags: ['v1', 'internal'] });
    });
  });

  describe('async middleware — fire and forget', () => {
    it('async middleware that awaits next() without return works', async () => {
      const order: string[] = [];

      @Path('/items')
      class ItemsController extends Controller {
        async middlewareLog(
          _req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          order.push('log-before');
          await next();
          order.push('log-after');
        }

        @Get('')
        getItems() {
          order.push('handler');
          return { data: [] };
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ data: [] });
      expect(order).toEqual(['log-before', 'handler', 'log-after']);
    });
  });

  describe('rate-limit pattern', () => {
    it('in-memory rate limiter middleware works', async () => {
      const hits = new Map<string, { count: number; resetAt: number }>();

      function rateLimit(maxRequests: number, windowMs: number) {
        return (req: express.Request, res: express.Response, next: express.NextFunction) => {
          const ip = req.ip || 'unknown';
          const now = Date.now();
          const record = hits.get(ip) || { count: 0, resetAt: now + windowMs };

          if (now > record.resetAt) {
            record.count = 0;
            record.resetAt = now + windowMs;
          }

          record.count++;
          hits.set(ip, record);

          if (record.count > maxRequests) {
            res.status(429).json({ error: 'Too many requests' });
            return;
          }

          res.setHeader('X-RateLimit-Remaining', String(maxRequests - record.count));
          next();
        };
      }

      @Middleware(rateLimit(2, 10000))
      @Path('/api')
      class ApiController extends Controller {
        @Get('/data')
        getData() {
          return { data: [1, 2, 3] };
        }
      }

      class Root extends Controller {
        groupApi() { return ApiController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res1 = await request(app, '/api/data');
      expect(res1.status).toBe(200);
      expect(res1.headers['x-ratelimit-remaining']).toBe('1');

      const res2 = await request(app, '/api/data');
      expect(res2.status).toBe(200);
      expect(res2.headers['x-ratelimit-remaining']).toBe('0');

      const res3 = await request(app, '/api/data');
      expect(res3.status).toBe(429);
      expect(JSON.parse(res3.body)).toEqual({ error: 'Too many requests' });
    });
  });

  describe('auth pattern', () => {
    it('auth middleware rejects unauthenticated requests', async () => {
      function requireAuth(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) {
        const token = req.headers.authorization;
        if (!token) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
        (req as any).user = { id: 1, name: 'Alice' };
        next();
      }

      @Middleware(requireAuth)
      @Path('/profile')
      class ProfileController extends Controller {
        @Get('')
        getProfile(req: express.Request) {
          return (req as any).user;
        }
      }

      class Root extends Controller {
        groupProfile() { return ProfileController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const noAuth = await request(app, '/profile');
      expect(noAuth.status).toBe(401);

      const withAuth = await request(app, '/profile', { headers: { authorization: 'Bearer abc' } });
      expect(withAuth.status).toBe(200);
      expect(JSON.parse(withAuth.body)).toEqual({ id: 1, name: 'Alice' });
    });
  });

  describe('cors pattern', () => {
    it('CORS middleware sets headers', async () => {
      function cors(
        _req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
        next();
      }

      @Middleware(cors)
      @Path('/api')
      class ApiController extends Controller {
        @Get('/data')
        getData() {
          return { ok: true };
        }
      }

      class Root extends Controller {
        groupApi() { return ApiController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/api/data');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.headers['access-control-allow-methods']).toBe('GET, POST, PUT, DELETE');
    });
  });

  describe('multiple middleware stack', () => {
    it('multiple middleware run in order', async () => {
      const order: string[] = [];

      function logging(
        _req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) {
        order.push('logging');
        next();
      }

      function timing(
        _req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) {
        order.push('timing');
        next();
      }

      function auth(
        _req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) {
        order.push('auth');
        next();
      }

      @Middleware(logging)
      @Middleware(timing)
      @Middleware(auth)
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        getItems() {
          order.push('handler');
          return [];
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      // Decorators applied bottom-up: auth, timing, logging
      expect(order).toEqual(['auth', 'timing', 'logging', 'handler']);
    });
  });

  describe('middleware short-circuits response', () => {
    it('middleware that sends response without calling next stops chain', async () => {
      function blockAll(
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) {
        res.status(403).json({ error: 'blocked' });
      }

      @Middleware(blockAll)
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        getItems() {
          return { data: [] };
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: 'blocked' });
    });
  });

  describe('middleware with promise-based patterns', () => {
    it('middleware returning a promise works', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        middlewareDelay(
          _req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          return new Promise<void>((resolve) => {
            setTimeout(() => {
              next();
              resolve();
            }, 5);
          });
        }

        @Get('')
        getItems() {
          return { data: [] };
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ data: [] });
    });

    it('middleware with rejected promise goes to error handler', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        middlewareFail(
          _req: express.Request,
          _res: express.Response,
          _next: express.NextFunction,
        ) {
          return new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error('async middleware error')), 5);
          });
        }

        @Get('')
        getItems() {
          return { data: [] };
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(500);
    });
  });

  describe('next(err) pattern', () => {
    it('middleware calling next(err) rejects the chain', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        async middlewareCheck(
          req: express.Request,
          res: express.Response,
          next: express.NextFunction,
        ) {
          try {
            await next();
          } catch (err: any) {
            res.status(500).json({ error: err.message });
          }
        }

        middlewareTrigger(
          _req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          next(new Error('check failed'));
        }

        @Get('')
        getItems() {
          return { data: [] };
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(500);
      expect(JSON.parse(res.body)).toEqual({ error: 'check failed' });
    });
  });

  describe('middleware + subrouting', () => {
    it('parent middleware runs for all child routes', async () => {
      const order: string[] = [];

      function parentMiddleware(
        _req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) {
        order.push('parent-mw');
        next();
      }

      @Middleware(parentMiddleware)
      @Path('/admin')
      class AdminController extends Controller {
        @Get('')
        getAdmin() {
          order.push('admin');
          return { admin: true };
        }

        groupSettings() {
          return SettingsController;
        }
      }

      @Path('/settings')
      class SettingsController extends Controller {
        @Get('')
        getSettings() {
          order.push('settings');
          return { theme: 'dark' };
        }
      }

      class Root extends Controller {
        groupAdmin() { return AdminController; }
      }

      const app = express();
      createExedra(app, { controller: Root });

      const adminRes = await request(app, '/admin');
      expect(adminRes.status).toBe(200);
      expect(order).toEqual(['parent-mw', 'admin']);

      order.length = 0;
      const settingsRes = await request(app, '/admin/settings');
      expect(settingsRes.status).toBe(200);
      expect(order).toEqual(['parent-mw', 'settings']);
    });
  });

  describe('onion model — modify response', () => {
    it('middleware returning next() passes through unchanged', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        async middlewarePass(
          req: express.Request,
          res: express.Response,
          next: express.NextFunction,
        ) {
          return next();
        }

        @Get('')
        getItems() {
          return { data: [1, 2, 3] };
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ data: [1, 2, 3] });
    });

    it('middleware modifying req._exedra_result after await next()', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        async middlewareWrap(
          req: any,
          res: express.Response,
          next: express.NextFunction,
        ) {
          const result = await next();
          req._exedra_result = { wrapped: true, data: result };
        }

        @Get('')
        getItems() {
          return { items: [1, 2, 3] };
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ wrapped: true, data: { items: [1, 2, 3] } });
    });

    it('middleware sending custom response via res.json()', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        async middlewareReplace(
          req: express.Request,
          res: express.Response,
          next: express.NextFunction,
        ) {
          const result = await next();
          if (!res.headersSent) {
            res.json({ replaced: true, original: result });
          }
        }

        @Get('')
        getItems() {
          return { original: true };
        }
      }

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ replaced: true, original: { original: true } });
    });
  });
});

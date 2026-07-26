import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, Post, Param, Body, Query, createExedra } from '../src';

function request(
  app: express.Application,
  path: string,
  options: { method?: string; body?: any; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: string }> {
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
          resolve({ status: res.statusCode || 0, body });
        });
      });
      req.on('error', (err) => { clearTimeout(timer); server.close(); reject(err); });
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  });
}

describe('Express compatibility', () => {
  describe('basic routing', () => {
    class Root extends Controller {
      groupUsers() {
        return UsersController;
      }
    }

    @Path('/users')
    class UsersController extends Controller {
      middlewareAuth(
        _req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) {
        next();
      }

      @Get('')
      listUsers() {
        return { data: [{ id: 1, name: 'Alice' }] };
      }

      @Get('/:id')
      getUser(@Param('id') id: string) {
        return { id, name: 'Alice' };
      }

      @Post('')
      createUser(@Body('name') name: string) {
        return { id: 2, name };
      }
    }

    it('GET /users returns list', async () => {
      const app = express();
      createExedra(app, { controller: Root });
      const res = await request(app, '/users');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ data: [{ id: 1, name: 'Alice' }] });
    });

    it('GET /users/:id returns single user', async () => {
      const app = express();
      createExedra(app, { controller: Root });
      const res = await request(app, '/users/42');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ id: '42', name: 'Alice' });
    });

    it('POST /users creates user', async () => {
      const app = express();
      app.use(express.json());
      createExedra(app, { controller: Root });
      const res = await request(app, '/users', {
        method: 'POST',
        body: { name: 'Bob' },
      });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ id: 2, name: 'Bob' });
    });

    it('404 for unmatched routes', async () => {
      const app = express();
      createExedra(app, { controller: Root });
      const res = await request(app, '/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('query parameters', () => {
    class Root extends Controller {
      groupItems() {
        return ItemsController;
      }
    }

    @Path('/items')
    class ItemsController extends Controller {
      @Get('')
      listItems(@Query('limit') limit: string) {
        return { limit: limit || '10', items: [] };
      }
    }

    it('reads query parameters', async () => {
      const app = express();
      createExedra(app, { controller: Root });
      const res = await request(app, '/items?limit=5');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ limit: '5', items: [] });
    });
  });

  describe('middleware pipeline', () => {
    class Root extends Controller {
      groupItems() {
        return ItemsController;
      }
    }

    @Path('/items')
    class ItemsController extends Controller {
      middlewareFirst(
        req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) {
        (req as any).first = true;
        next();
      }

      middlewareSecond(
        req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) {
        (req as any).second = true;
        next();
      }

      @Get('')
      getItems(req: express.Request) {
        return { first: (req as any).first, second: (req as any).second };
      }
    }

    it('middleware runs in order', async () => {
      const app = express();
      createExedra(app, { controller: Root });
      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ first: true, second: true });
    });
  });

  describe('subrouting', () => {
    class Root extends Controller {
      groupAdmin() {
        return AdminController;
      }
    }

    @Path('/admin')
    class AdminController extends Controller {
      groupSettings() {
        return SettingsController;
      }

      @Get('')
      getAdmin() {
        return { section: 'admin' };
      }
    }

    @Path('/settings')
    class SettingsController extends Controller {
      @Get('')
      getSettings() {
        return { theme: 'dark' };
      }
    }

    it('nests routes correctly', async () => {
      const app = express();
      createExedra(app, { controller: Root });

      const adminRes = await request(app, '/admin');
      expect(adminRes.status).toBe(200);
      expect(JSON.parse(adminRes.body)).toEqual({ section: 'admin' });

      const settingsRes = await request(app, '/admin/settings');
      expect(settingsRes.status).toBe(200);
      expect(JSON.parse(settingsRes.body)).toEqual({ theme: 'dark' });
    });
  });

  describe('named param auto-inject', () => {
    class Root extends Controller {
      groupItems() {
        return ItemsController;
      }
    }

    @Path('/items')
    class ItemsController extends Controller {
      @Get('/:id')
      getItem(id: string) {
        return { id };
      }
    }

    it('resolves params by name', async () => {
      const app = express();
      createExedra(app, { controller: Root, namedParamAutoInject: true });
      const res = await request(app, '/items/7');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ id: '7' });
    });
  });
});

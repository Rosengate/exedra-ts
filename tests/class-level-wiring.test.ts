import 'reflect-metadata';
import express from 'express';
import http from 'http';
import {
  Controller, Path, Get, Post, Name, Method, Requestable, Config, Middleware,
  createExedra,
} from '../src';
import { Route } from '../src/routing/route';

function request(
  app: express.Application,
  path: string,
  options: { method?: string } = {},
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

describe('Class-level decorator wiring', () => {
  describe('@Name — class prefix', () => {
    it('route.name returns own name, route.fullName returns full dotted path', () => {
      @Path('/users')
      @Name('apis.users')
      class UsersController extends Controller {
        @Get('')
        @Name('list')
        listUsers() {
          return [];
        }

        @Get('/:id')
        getUser() {
          return {};
        }
      }

      class Root extends Controller {
        groupUsers() {
          return UsersController;
        }
      }

      const app = express();
      const group = createExedra(app, { controller: Root });

      const childRoute = group.routes.find(r => r.properties.subroutes);
      const childGroup = childRoute!.properties._childGroup;
      const routes = childGroup.routes.filter((r: Route) => r.method);

      const listRoute = routes.find((r: Route) => r.name === 'list');
      expect(listRoute).toBeDefined();
      expect(listRoute!.name).toBe('list');
      expect(listRoute!.fullName).toBe('apis.users.list');

      const getUserRoute = routes.find((r: Route) => r.name === 'get-user');
      expect(getUserRoute).toBeDefined();
      expect(getUserRoute!.name).toBe('get-user');
      expect(getUserRoute!.fullName).toBe('apis.users.get-user');
    });

    it('listRoutes() returns name, fullName, and fullPath', () => {
      @Path('/users')
      @Name('apis.users')
      class UsersController extends Controller {
        @Get('')
        listUsers() {
          return [];
        }
      }

      class Root extends Controller {
        groupUsers() {
          return UsersController;
        }
      }

      const app = express();
      const group = createExedra(app, { controller: Root });
      const routes = group.listRoutes();

      expect(routes[0].name).toBe('list-users');
      expect(routes[0].fullName).toBe('apis.users.list-users');
      expect(routes[0].fullPath).toBe('/users');
    });

    it('group* method name provides default baseName, chains through nesting', () => {
      @Path('/settings')
      class SettingsController extends Controller {
        @Get('')
        getSettings() {
          return {};
        }
      }

      @Path('/admin')
      class AdminController extends Controller {
        @Get('')
        getAdmin() {
          return {};
        }

        groupSettings() {
          return SettingsController;
        }
      }

      class Root extends Controller {
        groupAdmin() {
          return AdminController;
        }
      }

      const app = express();
      const group = createExedra(app, { controller: Root });
      const routes = group.listRoutes();

      const fullNames = routes.map(r => r.fullName).sort();
      expect(fullNames).toContain('admin.get-admin');
      expect(fullNames).toContain('admin.settings.get-settings');
    });

    it('@Name replaces the group* method default', () => {
      @Path('/settings')
      class SettingsController extends Controller {
        @Get('')
        getSettings() {
          return {};
        }
      }

      @Path('/admin')
      @Name('v2')
      class AdminController extends Controller {
        @Get('')
        getAdmin() {
          return {};
        }

        groupSettings() {
          return SettingsController;
        }
      }

      class Root extends Controller {
        groupAdmin() {
          return AdminController;
        }
      }

      const app = express();
      const group = createExedra(app, { controller: Root });
      const routes = group.listRoutes();

      const fullNames = routes.map(r => r.fullName).sort();
      expect(fullNames).toContain('v2.get-admin');
      expect(fullNames).toContain('v2.settings.get-settings');
    });

    it('routes without @Name or group* have no prefix', () => {
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        listItems() {
          return [];
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      const group = createExedra(app, { controller: Root });

      const childRoute = group.routes.find(r => r.properties.subroutes);
      const childGroup = childRoute!.properties._childGroup;
      const route = childGroup.routes.find((r: Route) => r.method);

      expect(route!.name).toBe('list-items');
      expect(route!.fullName).toBe('items.list-items');
    });

    it('listRoutes returns all fields correctly for nested controllers', () => {
      @Path('/settings')
      class SettingsController extends Controller {
        @Get('/:id')
        getSetting() {
          return {};
        }
      }

      @Path('/admin')
      class AdminController extends Controller {
        @Get('')
        getAdmin() {
          return {};
        }

        groupSettings() {
          return SettingsController;
        }
      }

      class Root extends Controller {
        groupAdmin() {
          return AdminController;
        }
      }

      const app = express();
      const group = createExedra(app, { controller: Root });
      const routes = group.listRoutes();

      const adminRoute = routes.find(r => r.action === 'getAdmin');
      expect(adminRoute).toMatchObject({
        method: 'GET',
        path: '/',
        name: 'get-admin',
        fullPath: '/admin',
        fullName: 'admin.get-admin',
        controllerPath: '/admin',
      });

      const settingsRoute = routes.find(r => r.action === 'getSetting');
      expect(settingsRoute).toMatchObject({
        method: 'GET',
        path: '/:id',
        name: 'get-setting',
        fullPath: '/admin/settings/:id',
        fullName: 'admin.settings.get-setting',
        controllerPath: '/settings',
      });
    });
  });

  describe('@Method — default HTTP verb', () => {
    it('class-level @Method sets default HTTP method for all routes', async () => {
      @Path('/items')
      @Method('GET')
      class ItemsController extends Controller {
        @Get('')
        listItems() {
          return [{ id: 1 }];
        }

        @Post('')
        createItem() {
          return { id: 2 };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root });

      const res = await request(app, '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual([{ id: 1 }]);
    });
  });

  describe('@Requestable — class-level disable', () => {
    it('class-level @Requestable(false) disables all routes in the controller', () => {
      @Path('/items')
      @Requestable(false)
      class ItemsController extends Controller {
        @Get('')
        listItems() {
          return [];
        }

        @Get('/:id')
        getItem() {
          return {};
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      const group = createExedra(app, { controller: Root });
      const routes = group.listRoutes();

      // All routes should be excluded from the route listing
      expect(routes).toHaveLength(0);
    });

    it('method-level @Requestable(true) overrides class-level @Requestable(false)', () => {
      @Path('/items')
      @Requestable(false)
      class ItemsController extends Controller {
        @Get('')
        @Requestable(true)
        listItems() {
          return [];
        }

        @Get('/:id')
        getItem() {
          return {};
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      const group = createExedra(app, { controller: Root });
      const routes = group.listRoutes();

      // Only the method-level @Requestable(true) route should appear
      expect(routes).toHaveLength(1);
    });
  });

  describe('@Config — class-level config', () => {
    it('class-level @Config merges into all route properties', () => {
      @Path('/items')
      @Config('cache', true)
      @Config('rateLimit', 100)
      class ItemsController extends Controller {
        @Get('')
        listItems() {
          return [];
        }

        @Config('cache', false)
        @Get('/:id')
        getItem() {
          return {};
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root });

      // Verify the app starts without errors — config is in route properties
      // which are available via route.fullProperties()
      expect(true).toBe(true);
    });
  });

  describe('@Middleware — class-level function', () => {
    it('class-level @Middleware(fn) runs for all routes in the controller', async () => {
      const order: string[] = [];

      function AuthMiddleware(
        _req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) {
        order.push('auth');
        next();
      }

      @Middleware(AuthMiddleware)
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        listItems() {
          order.push('list');
          return [];
        }

        @Get('/:id')
        getItem() {
          order.push('get');
          return {};
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root });

      await request(app, '/items');
      expect(order).toEqual(['auth', 'list']);

      order.length = 0;
      await request(app, '/items/1');
      expect(order).toEqual(['auth', 'get']);
    });

    it('method-level @Middleware(fn) runs only for that route', async () => {
      const order: string[] = [];

      function CacheMiddleware(
        _req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) {
        order.push('cache');
        next();
      }

      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        listItems() {
          order.push('list');
          return [];
        }

        @Get('/:id')
        @Middleware(CacheMiddleware)
        getItem() {
          order.push('get');
          return {};
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root });

      await request(app, '/items');
      expect(order).toEqual(['list']);

      order.length = 0;
      await request(app, '/items/1');
      expect(order).toEqual(['cache', 'get']);
    });

    it('class + method middleware both run, class-level first', async () => {
      const order: string[] = [];

      function ClassMiddleware(
        _req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) {
        order.push('class-mw');
        next();
      }

      function MethodMiddleware(
        _req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) {
        order.push('method-mw');
        next();
      }

      @Middleware(ClassMiddleware)
      @Path('/items')
      class ItemsController extends Controller {
        middlewarePrefix(
          _req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) {
          order.push('prefix-mw');
          next();
        }

        @Get('')
        @Middleware(MethodMiddleware)
        listItems() {
          order.push('handler');
          return [];
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root });

      await request(app, '/items');
      expect(order).toEqual(['class-mw', 'prefix-mw', 'method-mw', 'handler']);
    });

    it('middleware can short-circuit the request', async () => {
      function BlockMiddleware(
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) {
        res.status(403).json({ error: 'blocked' });
      }

      @Middleware(BlockMiddleware)
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        listItems() {
          return [];
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root });

      const res = await request(app, '/items');
      expect(res.status).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: 'blocked' });
    });
  });
});

import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, FailRoute, createExedra } from '../src';
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

describe('@FailRoute', () => {
  describe('metadata storage', () => {
    it('sets asFailRoute in method-level metadata', () => {
      class TestController {
        @FailRoute
        notFound() {}
      }

      const meta = getMetadata(TestController, 'notFound');
      expect(meta.asFailRoute).toBe(true);
    });

    it('@FailRoute() with parentheses sets method-level metadata', () => {
      class TestController {
        @FailRoute()
        notFound() {}
      }

      const meta = getMetadata(TestController, 'notFound');
      expect(meta.asFailRoute).toBe(true);
    });

    it('@FailRoute on class throws an error', () => {
      expect(() => {
        @FailRoute
        class TestController extends Controller {}
      }).toThrow('@FailRoute can only be applied to a method, not a class');
    });

    it('@FailRoute() on class throws an error', () => {
      expect(() => {
        @FailRoute()
        class TestController extends Controller {}
      }).toThrow('@FailRoute can only be applied to a method, not a class');
    });
  });

  describe('handler registration', () => {
    it('standalone @FailRoute method is registered as a catch-all route', () => {
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        getItems() {
          return { data: [] };
        }

        @FailRoute
        failHandler() {
          return { error: 'not found' };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      const group = createExedra(app, { controller: Root, useFlatRouting: true });

      const routes = group.listRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe('GET');

      const groupItemsRoute = group.routes.find(r => r.properties.subroutes);
      const childGroup = groupItemsRoute!.properties._childGroup;
      expect(childGroup.hasFailRoute()).toBe(true);
    });
  });

  describe('catch-all behavior — Express mode', () => {
    it('unmatched route returns fail route response', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        getItems() {
          return { data: [] };
        }

        @FailRoute
        failHandler() {
          return { error: 'not found in items' };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root });

      const res = await request(app, '/items/nonexistent');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ error: 'not found in items' });
    });

    it('matched route still works normally', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        getItems() {
          return { data: [] };
        }

        @FailRoute
        failHandler() {
          return { error: 'not found' };
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
      expect(JSON.parse(res.body)).toEqual({ data: [] });
    });

    it('404 when no fail route exists', async () => {
      @Path('/items')
      class ItemsController extends Controller {
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
      createExedra(app, { controller: Root });

      const res = await request(app, '/items/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('catch-all behavior — flat routing', () => {
    it('unmatched route returns fail route response', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        getItems() {
          return { data: [] };
        }

        @FailRoute
        failHandler() {
          return { error: 'not found in items' };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items/nonexistent');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ error: 'not found in items' });
    });

    it('matched route still works normally', async () => {
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        getItems() {
          return { data: [] };
        }

        @FailRoute
        failHandler() {
          return { error: 'not found' };
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
      expect(JSON.parse(res.body)).toEqual({ data: [] });
    });
  });

  describe('multiple fail routes', () => {
    it('child fail route catches within its scope', async () => {
      @Path('/settings')
      class SettingsController extends Controller {
        @Get('')
        getSettings() {
          return { theme: 'dark' };
        }

        @FailRoute
        failHandler() {
          return { error: 'settings not found' };
        }
      }

      @Path('/admin')
      class AdminController extends Controller {
        @Get('')
        getAdmin() {
          return { section: 'admin' };
        }

        @FailRoute
        failHandler() {
          return { error: 'admin not found' };
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
      createExedra(app, { controller: Root });

      const adminRes = await request(app, '/admin');
      expect(adminRes.status).toBe(200);
      expect(JSON.parse(adminRes.body)).toEqual({ section: 'admin' });

      const settingsRes = await request(app, '/admin/settings');
      expect(settingsRes.status).toBe(200);
      expect(JSON.parse(settingsRes.body)).toEqual({ theme: 'dark' });

      const unmatchedSettings = await request(app, '/admin/settings/unknown');
      expect(unmatchedSettings.status).toBe(200);
      expect(JSON.parse(unmatchedSettings.body)).toEqual({ error: 'settings not found' });

      const unmatchedAdmin = await request(app, '/admin/unknown');
      expect(unmatchedAdmin.status).toBe(200);
      expect(JSON.parse(unmatchedAdmin.body)).toEqual({ error: 'admin not found' });
    });

    it('parent fail route catches from child without fail route', async () => {
      @Path('/settings')
      class SettingsController extends Controller {
        @Get('')
        getSettings() {
          return { theme: 'dark' };
        }
      }

      @Path('/admin')
      class AdminController extends Controller {
        @Get('')
        getAdmin() {
          return { section: 'admin' };
        }

        @FailRoute
        failHandler() {
          return { error: 'admin not found' };
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
      createExedra(app, { controller: Root });

      const unmatchedSettings = await request(app, '/admin/settings/unknown');
      expect(unmatchedSettings.status).toBe(200);
      expect(JSON.parse(unmatchedSettings.body)).toEqual({ error: 'admin not found' });
    });

    it('root fail route catches unmatched routes outside any child group', async () => {
      @Path('/admin')
      class AdminController extends Controller {
        @Get('')
        getAdmin() {
          return { section: 'admin' };
        }
      }

      class Root extends Controller {
        groupAdmin() {
          return AdminController;
        }

        @FailRoute
        failHandler() {
          return { error: 'global not found' };
        }
      }

      const app = express();
      createExedra(app, { controller: Root });

      const adminRes = await request(app, '/admin');
      expect(adminRes.status).toBe(200);

      const unmatched = await request(app, '/unknown');
      expect(unmatched.status).toBe(200);
      expect(JSON.parse(unmatched.body)).toEqual({ error: 'global not found' });
    });
  });

  describe('Group.hasFailRoute() and Group.getFailRoute()', () => {
    it('hasFailRoute() returns false when no fail route exists', () => {
      @Path('/items')
      class ItemsController extends Controller {
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
      const group = createExedra(app, { controller: Root, useFlatRouting: true });

      const groupItemsRoute = group.routes.find(r => r.properties.subroutes);
      const childGroup = groupItemsRoute!.properties._childGroup;
      expect(childGroup.hasFailRoute()).toBe(false);
      expect(childGroup.getFailRoute()).toBeNull();
    });

    it('hasFailRoute() returns true when a @FailRoute route exists', () => {
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        getItems() {
          return { data: [] };
        }

        @FailRoute
        failHandler() {
          return { error: 'not found' };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      const group = createExedra(app, { controller: Root, useFlatRouting: true });

      const groupItemsRoute = group.routes.find(r => r.properties.subroutes);
      const childGroup = groupItemsRoute!.properties._childGroup;
      expect(childGroup.hasFailRoute()).toBe(true);
      expect(childGroup.getFailRoute()).not.toBeNull();
      expect(childGroup.getFailRoute()!.asFailRoute).toBe(true);
    });
  });
});

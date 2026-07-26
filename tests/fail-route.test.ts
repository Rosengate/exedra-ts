import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, FailRoute, createExedra } from '../src';
import { getMetadata } from '../src/metadata';
import { Route } from '../src/routing/route';

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
    it('sets asFailRoute in class-level metadata', () => {
      @FailRoute
      class TestController extends Controller {}

      const meta = getMetadata(TestController);
      expect(meta.asFailRoute).toBe(true);
    });

    it('sets asFailRoute in method-level metadata', () => {
      class TestController {
        @FailRoute
        notFound() {}
      }

      const meta = getMetadata(TestController, 'notFound');
      expect(meta.asFailRoute).toBe(true);
    });
  });

  describe('handler registration', () => {
    it('standalone @FailRoute method without verb prefix is skipped by handler', () => {
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
    });

    it('@FailRoute combined with @Get creates a route but marks asFailRoute', () => {
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        getItems() {
          return { data: [] };
        }

        @Get('/notfound')
        @FailRoute
        notFound() {
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

      // listRoutes excludes asFailRoute routes
      const routes = group.listRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe('GET');

      // But the route exists internally - check via subroutes
      const groupItemsRoute = group.routes.find(r => r.properties.subroutes);
      expect(groupItemsRoute).toBeDefined();
      const childGroup = groupItemsRoute!.properties._childGroup;
      expect(childGroup).toBeDefined();

      const failRoute = childGroup.routes.find((r: Route) => r.asFailRoute);
      expect(failRoute).toBeDefined();
      expect(failRoute!.asFailRoute).toBe(true);
    });
  });

  describe('unmatched routes', () => {
    it('returns 404 for unmatched routes (no catch-all implemented)', async () => {
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
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items/nonexistent');
      expect(res.status).toBe(404);
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

        @Get('/notfound')
        @FailRoute
        notFound() {
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

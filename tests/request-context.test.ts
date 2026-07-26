import 'reflect-metadata';
import express from 'express';
import http from 'http';
import {
  Controller, Path, Get, Param, Inject,
  Ctx, createExedra, Container, Context,
} from '../src';

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
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  });
}

class User {
  constructor(public name: string, public id: number) {}
}

describe('Request-level Context', () => {
  describe('middleware registers on per-request context', () => {
    function makeApp() {
      const container = new Container();

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      @Path('/items')
      class ItemsController extends Controller {
        middlewareSetUser(
          _req: any,
          _res: any,
          _next: any,
          ctx: Context,
        ) {
          ctx.service(User, new User('Alice', 1));
          _next();
        }

        @Get('')
        getUser(@Ctx() ctx: Context) {
          const user = ctx.resolve(User);
          return { name: user.name, id: user.id };
        }

        @Get('/by-name')
        getUserByName(ctx: Context) {
          const user = ctx.resolve(User);
          return { name: user.name };
        }
      }

      const app = express();
      createExedra(app, { controller: Root, namedParamAutoInject: true, useFlatRouting: true, container });
      return app;
    }

    it('resolves user from per-request context via @Ctx()', async () => {
      const res = await request(makeApp(), '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ name: 'Alice', id: 1 });
    });

    it('resolves user from per-request context via named auto-inject (param name "ctx")', async () => {
      const res = await request(makeApp(), '/items/by-name');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ name: 'Alice' });
    });
  });

  describe('request isolation — separate requests get separate contexts', () => {
    function makeApp() {
      let counter = 0;

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      @Path('/items')
      class ItemsController extends Controller {
        middlewareIncrement(
          _req: any,
          _res: any,
          _next: any,
          ctx: Context,
        ) {
          counter++;
          ctx.service('counter', counter);
          _next();
        }

        @Get('')
        getCounter(@Ctx() ctx: Context) {
          return { counter: ctx.resolve('counter') };
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });
      return app;
    }

    it('each request gets its own counter value', async () => {
      const res1 = await request(makeApp(), '/items');
      expect(JSON.parse(res1.body).counter).toBe(1);

      const res2 = await request(makeApp(), '/items');
      expect(JSON.parse(res2.body).counter).toBe(1);

      const res3 = await request(makeApp(), '/items');
      expect(JSON.parse(res3.body).counter).toBe(1);
    });
  });

  describe('child scope — context inherits from app container', () => {
    function makeApp() {
      const container = new Container();
      container.service('appName', 'exedra-test');

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        getAppName(@Ctx() ctx: Context) {
          return {
            appName: ctx.resolve('appName'),
          };
        }

        @Get('/set')
        setLocal(@Ctx() ctx: Context) {
          ctx.service('localKey', 'local-value');
          return { ok: true };
        }

        @Get('/get-local')
        getLocal(@Ctx() ctx: Context) {
          return {
            localKey: ctx.resolve('localKey'),
            appName: ctx.resolve('appName'),
          };
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true, container });
      return app;
    }

    it('resolves app-level services from request context', async () => {
      const res = await request(makeApp(), '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ appName: 'exedra-test' });
    });

    it('request-scoped services are isolated across requests', async () => {
      const res1 = await request(makeApp(), '/items/set');
      expect(JSON.parse(res1.body)).toEqual({ ok: true });

      const res2 = await request(makeApp(), '/items/get-local');
      expect(JSON.parse(res2.body)).toEqual({
        localKey: undefined,
        appName: 'exedra-test',
      });
    });
  });

  describe('Context has req, res, and Container methods', () => {
    function makeApp() {
      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        checkCtx(@Ctx() ctx: Context) {
          return {
            hasReq: ctx.req !== undefined,
            hasRes: ctx.res !== undefined,
            isContext: ctx instanceof Context,
            hasCanResolve: typeof ctx.canResolve === 'function',
            hasService: typeof ctx.service === 'function',
          };
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });
      return app;
    }

    it('context has req, res, and container methods', async () => {
      const res = await request(makeApp(), '/items');
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.hasReq).toBe(true);
      expect(data.hasRes).toBe(true);
      expect(data.isContext).toBe(true);
      expect(data.hasCanResolve).toBe(true);
      expect(data.hasService).toBe(true);
    });
  });

  describe('named auto-inject resolves ctx by name', () => {
    function makeApp() {
      const container = new Container();
      container.service(User, new User('Bob', 2));

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        getItem(ctx: Context) {
          const user = ctx.resolve(User);
          return { name: user.name };
        }
      }

      const app = express();
      createExedra(app, { controller: Root, namedParamAutoInject: true, useFlatRouting: true, container });
      return app;
    }

    it('resolves ctx by param name', async () => {
      const res = await request(makeApp(), '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ name: 'Bob' });
    });
  });

  describe('middleware without ctx param still works (backward compatible)', () => {
    function makeApp() {
      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      @Path('/items')
      class ItemsController extends Controller {
        middlewareLegacy(
          req: express.Request,
          res: express.Response,
          next: express.NextFunction,
        ) {
          (req as any).legacy = true;
          next();
        }

        @Get('')
        getItem(req: express.Request) {
          return { legacy: (req as any).legacy };
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });
      return app;
    }

    it('middleware with 3 params still works', async () => {
      const res = await request(makeApp(), '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ legacy: true });
    });
  });

  describe('mixed injection: @Ctx + @Param + type-based', () => {
    function makeApp() {
      const container = new Container();
      container.service('appName', 'my-app');

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      @Path('/items')
      class ItemsController extends Controller {
        middlewareSetUser(
          _req: any,
          _res: any,
          _next: any,
          ctx: Context,
        ) {
          ctx.service(User, new User('Charlie', 3));
          _next();
        }

        @Get('/:id')
        getItem(
          @Param('id') id: string,
          @Ctx() ctx: Context,
        ) {
          const user = ctx.resolve(User);
          const appName = ctx.resolve('appName');
          return { id, user: user.name, app: appName };
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true, container });
      return app;
    }

    it('resolves @Param, @Ctx, and app container together', async () => {
      const res = await request(makeApp(), '/items/42');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ id: '42', user: 'Charlie', app: 'my-app' });
    });
  });

  describe('@Inject decorator — explicit token injection', () => {
    function makeApp() {
      const container = new Container();
      container.service('appName', 'my-app');

      class Root extends Controller {
        groupItems() { return ItemsController; }
      }

      @Path('/items')
      class ItemsController extends Controller {
        middlewareSetUser(
          _req: any,
          _res: any,
          _next: any,
          ctx: Context,
        ) {
          ctx.service(User, new User('Dave', 4));
          _next();
        }

        @Get('/:id')
        getItem(@Param('id') id: string, @Inject(User) user: User) {
          return { id, user: user.name };
        }

        @Get('')
        getApp(@Inject('appName') appName: string) {
          return { appName };
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true, container });
      return app;
    }

    it('injects request-scoped service via @Inject', async () => {
      const res = await request(makeApp(), '/items/42');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ id: '42', user: 'Dave' });
    });

    it('injects app-level service via @Inject with string key', async () => {
      const res = await request(makeApp(), '/items');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ appName: 'my-app' });
    });

    it('@Inject works alongside @Param', async () => {
      const res = await request(makeApp(), '/items/99');
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.id).toBe('99');
      expect(data.user).toBe('Dave');
    });
  });
});

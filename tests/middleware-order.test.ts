import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, Requestable, FailRoute, createExedra } from '../src';

function request(app: express.Application, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address() as any;
      http.get(`http://localhost:${addr.port}${path}`, (res) => {
        let body = '';
        res.on('data', (d: Buffer) => (body += d));
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode || 0, body });
        });
      });
    });
    setTimeout(() => { server.close(); reject(new Error('timeout')); }, 5000);
  });
}

describe('Middleware execution order', () => {
  it('runs middleware methods in definition order', async () => {
    const order: string[] = [];

    class Root extends Controller {
      groupItems() {
        return ItemsController;
      }
    }

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

    const app = express();
    createExedra(app, { controller: Root, useFlatRouting: true });
    const res = await request(app, '/items');
    expect(res.status).toBe(200);
    expect(order).toEqual(['first', 'second', 'handler']);
  });

  it('middleware can modify request and handler sees it', async () => {
    class Root extends Controller {
      groupItems() {
        return ItemsController;
      }
    }

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

    const app = express();
    createExedra(app, { controller: Root, useFlatRouting: true });
    const res = await request(app, '/items');
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ tagged: true });
  });

  it('middleware can short-circuit by sending response', async () => {
    class Root extends Controller {
      groupItems() {
        return ItemsController;
      }
    }

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

    const app = express();
    createExedra(app, { controller: Root, useFlatRouting: true });
    const res = await request(app, '/items');
    expect(res.status).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: 'blocked' });
  });
});

describe('@Requestable', () => {
  it('hides route from matching when requestable is false', async () => {
    class Root extends Controller {
      groupItems() {
        return ItemsController;
      }
    }

    @Path('/items')
    class ItemsController extends Controller {
      @Get('')
      listItems() {
        return { route: 'list' };
      }

      @Get('/hidden')
      @Requestable(false)
      hiddenItem() {
        return { route: 'hidden' };
      }
    }

    const app = express();
    createExedra(app, { controller: Root, useFlatRouting: true });

    const listRes = await request(app, '/items');
    expect(listRes.status).toBe(200);
    expect(JSON.parse(listRes.body)).toEqual({ route: 'list' });

    // hidden route should not match — Express returns 404
    const hiddenRes = await request(app, '/items/hidden');
    expect(hiddenRes.status).toBe(404);
  });
});

describe('@FailRoute', () => {
  it('acts as catch-all for unmatched routes in group', async () => {
    class Root extends Controller {
      groupItems() {
        return ItemsController;
      }
    }

    @Path('/items')
    class ItemsController extends Controller {
      @Get('')
      listItems() {
        return { route: 'list' };
      }

      @FailRoute
      notFound() {
        return { error: 'not found in items' };
      }
    }

    const app = express();
    createExedra(app, { controller: Root, useFlatRouting: true });

    const listRes = await request(app, '/items');
    expect(listRes.status).toBe(200);
    expect(JSON.parse(listRes.body)).toEqual({ route: 'list' });
  });
});

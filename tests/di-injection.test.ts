import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, Post, Param, Body, createExedra, Container } from '../src';
import { Wireman } from '../src/support/wireman';

function request(
  app: express.Application,
  path: string,
  options: { method?: string; body?: any; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
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
          server.close();
          resolve({ status: res.statusCode || 0, body });
        });
      });
      req.on('error', (err) => { server.close(); reject(err); });
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
    setTimeout(() => { server.close(); reject(new Error('timeout')); }, 5000);
  });
}

class Database {
  query(sql: string) { return `result: ${sql}`; }
}

class Cache {
  get(key: string) { return `cached:${key}`; }
}

class Logger {
  log(msg: string) { return `[log] ${msg}`; }
}

describe('Wireman', () => {
  const container = new Container();
  const dbInstance = new Database();
  const cacheInstance = new Cache();
  container.service(Database, dbInstance);
  container.service(Cache, cacheInstance);

  it('resolves class types from container', () => {
    function fn(db: Database, cache: Cache) {}
    Reflect.defineMetadata('design:paramtypes', [Database, Cache], fn);

    const wireman = new Wireman(container);
    const result = wireman.resolveTypes(fn);
    expect(result[0]).toBe(dbInstance);
    expect(result[1]).toBe(cacheInstance);
  });

  it('skips primitives', () => {
    function fn(name: string, db: Database) {}
    Reflect.defineMetadata('design:paramtypes', [String, Database], fn);

    const wireman = new Wireman(container);
    const result = wireman.resolveTypes(fn);
    expect(result[0]).toBeUndefined();
    expect(result[1]).toBe(dbInstance);
  });

  it('returns undefined for unregistered types', () => {
    function fn(db: Database, logger: Logger) {}
    Reflect.defineMetadata('design:paramtypes', [Database, Logger], fn);

    const wireman = new Wireman(container);
    const result = wireman.resolveTypes(fn);
    expect(result[0]).toBe(dbInstance);
    expect(result[1]).toBeUndefined();
  });

  it('returns empty array when no metadata', () => {
    function fn(a: any, b: any) {}

    const wireman = new Wireman(container);
    const result = wireman.resolveTypes(fn);
    expect(result).toEqual([]);
  });
});

describe('Container with class keys', () => {
  it('registers and resolves by class reference', () => {
    const container = new Container();
    const db = new Database();
    container.service(Database, db);
    expect(container.canResolve(Database)).toBe(true);
    expect(container.resolve(Database)).toBe(db);
  });

  it('registers and resolves factory by class reference', () => {
    const container = new Container();
    let count = 0;
    container.factory(Cache, () => { count++; return new Cache(); });
    expect(container.canResolve(Cache)).toBe(true);
    const a = container.resolve(Cache);
    const b = container.resolve(Cache);
    expect(a).toBeInstanceOf(Cache);
    expect(b).toBeInstanceOf(Cache);
    expect(a).not.toBe(b);
  });

  it('mixes string and class keys', () => {
    const container = new Container();
    container.service('appName', 'exedra');
    container.service(Database, new Database());
    expect(container.resolve('appName')).toBe('exedra');
    expect(container.resolve(Database)).toBeInstanceOf(Database);
  });
});

describe('Type-based DI integration (compiled with tsc)', () => {
  function buildApp() {
    const container = new Container();
    container.service(Database, new Database());
    container.service(Cache, new Cache());

    class Root extends Controller {
      groupItems() { return ItemsController; }
    }

    @Path('/items')
    class ItemsController extends Controller {
      @Get('')
      list() {
        return { route: 'list' };
      }

      @Get('/:id')
      getItem(@Param('id') id: string) {
        return { id };
      }
    }

    const app = express();
    createExedra(app, { controller: Root, useFlatRouting: true, container });
    return app;
  }

  it('routes work with container provided', async () => {
    const res = await request(buildApp(), '/items');
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ route: 'list' });
  });

  it('routes with params work with container provided', async () => {
    const res = await request(buildApp(), '/items/42');
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ id: '42' });
  });
});

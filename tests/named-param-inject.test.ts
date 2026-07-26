import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, Post, Param, createExedra } from '../src';

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
        headers: options.headers || {},
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

describe('namedParamAutoInject', () => {
  describe('enabled', () => {
    function makeApp() {
      class Root extends Controller {
        groupDevices() {
          return DevicesController;
        }
      }

      @Path('/devices')
      class DevicesController extends Controller {
        @Get('')
        list(limit: any, offset: any) {
          return { limit, offset };
        }

        @Get('/:id')
        getDevice(id: any) {
          return { id };
        }

        @Get('/:id/info')
        getInfo(id: any, req: any) {
          return { id, ip: req.ip };
        }

        @Post('')
        create(name: any, model: any) {
          return { name, model };
        }
      }

      const app = express();
      app.use(express.json());
      createExedra(app, { controller: Root, namedParamAutoInject: true, useFlatRouting: true });
      return app;
    }

    it('resolves route params by name', async () => {
      const res = await request(makeApp(), '/devices/abc123');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ id: 'abc123' });
    });

    it('resolves query params by name', async () => {
      const res = await request(makeApp(), '/devices?limit=10&offset=20');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ limit: '10', offset: '20' });
    });

    it('resolves req object by name', async () => {
      const res = await request(makeApp(), '/devices/abc123/info');
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.id).toBe('abc123');
      expect(data.ip).toBeDefined();
    });
  });

  describe('disabled (default)', () => {
    function makeApp() {
      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      @Path('/items')
      class ItemsController extends Controller {
        @Get('/:id')
        getItem(req: express.Request) {
          return { id: req.params.id };
        }
      }

      const app = express();
      createExedra(app, { controller: Root, useFlatRouting: true });
      return app;
    }

    it('passes (req, res, next) when auto-inject is off', async () => {
      const res = await request(makeApp(), '/items/xyz');
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.id).toBe('xyz');
    });
  });

  describe('decorator bindings override auto-inject', () => {
    function makeApp() {
      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      @Path('/items')
      class ItemsController extends Controller {
        @Get('/:id')
        getItem(@Param('id') id: string) {
          return { id };
        }
      }

      const app = express();
      createExedra(app, { controller: Root, namedParamAutoInject: true, useFlatRouting: true });
      return app;
    }

    it('uses decorator binding even with auto-inject enabled', async () => {
      const res = await request(makeApp(), '/items/from-decorator');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ id: 'from-decorator' });
    });
  });
});

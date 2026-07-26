import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, Decorator, createExedra } from '../src';
import { getMetadata } from '../src/metadata';
import { Route } from '../src/routing/route';
import { Group } from '../src/routing/group';
import { Finding } from '../src/routing/finding';

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

describe('@Decorator attribute', () => {
  describe('metadata storage', () => {
    it('stores decorator in class-level metadata', () => {
      @Decorator('ResponseTransformer')
      class TestController extends Controller {}

      const meta = getMetadata(TestController);
      expect(meta.decorator).toContain('ResponseTransformer');
    });

    it('stores decorator in method-level metadata', () => {
      class TestController {
        @Decorator('ResponseTransformer')
        @Get('/test')
        getTest() {}
      }

      const meta = getMetadata(TestController, 'getTest');
      expect(meta.decorator).toContain('ResponseTransformer');
    });

    it('accumulates multiple @Decorator decorators', () => {
      @Decorator('TransformerA')
      @Decorator('TransformerB')
      class TestController extends Controller {}

      const meta = getMetadata(TestController);
      // Decorators are applied bottom-up: TransformerB first, then TransformerA
      expect(meta.decorator).toEqual(['TransformerB', 'TransformerA']);
    });
  });

  describe('decorate* prefix methods', () => {
    it('decorate* methods are registered as decorators on the group', () => {
      @Path('/items')
      class ItemsController extends Controller {
        decorateAddTimestamp(
          req: express.Request,
          _res: express.Response,
          _next: express.NextFunction,
        ) {
          return (data: any) => ({ ...data, timestamp: Date.now() });
        }

        @Get('')
        getItems() {
          return { data: [] };
        }
      }

      const Factory = require('../src/routing/factory').Factory;
      const Handler = require('../src/handler').Handler;
      const factory = new Factory();
      const handler = new Handler();
      const group = handler.resolveGroup(factory, ItemsController);

      // decorate* methods are added to group.decorators
      expect(group.decorators.length).toBe(1);
      expect(typeof group.decorators[0]).toBe('function');
    });
  });

  describe('@Decorator with Finding', () => {
    it('@Decorator metadata is included in Finding.getCallStack()', () => {
      function MockTransformer(data: any) {
        return { transformed: true, ...data };
      }

      const Factory = require('../src/routing/factory').Factory;
      const factory = new Factory();
      const group = factory.createGroup([]);
      const route = new Route(group, 'test-route', {
        method: 'GET',
        path: '/test',
        decorator: [MockTransformer],
        execute: () => ({ data: [] }),
      });
      group.addRoute(route);

      const finding = new Finding(route);
      const stack = finding.getCallStack();

      // The call stack should include the decorator between middleware and execute
      expect(stack.calls.length).toBe(2); // decorator + execute
      expect(stack.calls[0].callable).toBe(MockTransformer);
    });
  });

  describe('@Decorator in request pipeline', () => {
    it('@Decorator metadata is stored but not executed in request pipeline', async () => {
      const order: string[] = [];

      function TimestampDecorator(_req: express.Request, _res: express.Response, next: express.NextFunction) {
        order.push('decorator');
        next();
      }

      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        @Decorator(TimestampDecorator as any)
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
      // @Decorator metadata is stored but not executed; only handler runs
      expect(order).toEqual(['handler']);
    });
  });
});

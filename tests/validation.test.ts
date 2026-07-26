import 'reflect-metadata';
import express from 'express';
import http from 'http';
import {
  Controller, Path, Get, Post, Validation, Middleware, createValidationMiddleware,
  createExedra,
} from '../src';

function request(
  app: express.Application,
  path: string,
  options: { method?: string; body?: any } = {},
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
        headers: { 'content-type': 'application/json' },
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

const sharedCapture: { data?: any; rules?: any } = {};

function makeValidator(capture: { data?: any; rules?: any } = sharedCapture) {
  return async (data: any, rules: Record<string, any>) => {
    capture.data = data;
    capture.rules = rules;
    for (const [field, rule] of Object.entries(rules)) {
      if (rule === 'required' && (data[field] === undefined || data[field] === '')) {
        throw new Error(`${field} is required`);
      }
    }
  };
}

describe('@Validation', () => {
  beforeEach(() => {
    sharedCapture.data = undefined;
    sharedCapture.rules = undefined;
  });

  describe('query validation (GET)', () => {
    it('validates query parameters on GET requests', async () => {
      const validate = makeValidator();

      @Middleware(createValidationMiddleware(validate))
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        @Validation({ limit: 'required', sort: 'required' })
        listItems() {
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

      const res = await request(app, '/items?limit=10&sort=asc');
      expect(res.status).toBe(200);
      expect(sharedCapture.data).toEqual({ limit: '10', sort: 'asc' });
    });

    it('rejects when required query params are missing', async () => {
      const validate = makeValidator();

      @Middleware(createValidationMiddleware(validate))
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        @Validation({ limit: 'required', sort: 'required' })
        listItems() {
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

      const res = await request(app, '/items?sort=asc');
      expect(res.status).toBe(500);
    });
  });

  describe('body validation (POST)', () => {
    it('validates body on POST requests', async () => {
      const validate = makeValidator();

      @Middleware(createValidationMiddleware(validate))
      @Path('/items')
      class ItemsController extends Controller {
        @Post('')
        @Validation({ name: 'required' })
        createItem() {
          return { created: true };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      app.use(express.json());
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items', {
        method: 'POST',
        body: { name: 'Widget' },
      });
      expect(res.status).toBe(200);
      expect(sharedCapture.data).toHaveProperty('name', 'Widget');
    });
  });

  describe('params + query + body merge (POST)', () => {
    it('merges params, query, and body for POST requests', async () => {
      const validate = makeValidator();

      @Middleware(createValidationMiddleware(validate))
      @Path('/items/:id')
      class ItemsController extends Controller {
        @Post('/update')
        @Validation({ id: 'required', name: 'required', format: 'required' })
        updateItem() {
          return { updated: true };
        }
      }

      class Root extends Controller {
        groupItems() {
          return ItemsController;
        }
      }

      const app = express();
      app.use(express.json());
      createExedra(app, { controller: Root, useFlatRouting: true });

      const res = await request(app, '/items/42/update?format=json', {
        method: 'POST',
        body: { name: 'Widget' },
      });
      expect(res.status).toBe(200);
      expect(sharedCapture.data).toEqual({ id: '42', format: 'json', name: 'Widget' });
    });
  });

  describe('GET ignores body', () => {
    it('does not include body data for GET requests', async () => {
      const validate = makeValidator();

      @Middleware(createValidationMiddleware(validate))
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        @Validation({ limit: 'required' })
        listItems() {
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

      await request(app, '/items?limit=10');
      expect(sharedCapture.data).toEqual({ limit: '10' });
    });
  });

  describe('class-level @Validation', () => {
    it('class-level validation applies to all routes in the controller', async () => {
      const validate = makeValidator();

      @Validation({ api_key: 'required' })
      @Middleware(createValidationMiddleware(validate))
      @Path('/items')
      class ItemsController extends Controller {
        @Get('')
        listItems() {
          return { data: [] };
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
      createExedra(app, { controller: Root, useFlatRouting: true });

      await request(app, '/items');
      expect(sharedCapture.rules).toEqual({ api_key: 'required' });
    });
  });
});

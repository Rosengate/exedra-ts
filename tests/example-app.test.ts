import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { createExedra } from '../src/handler';
import { Controller, Path, Get, Post, Put, Delete, Patch, Name, Tag, Param } from '../src';

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

const fakeUsers = [
  { id: 1, name: 'Alice', email: 'alice@test.com', role: 'admin', password: 'secret' },
  { id: 2, name: 'Bob', email: 'bob@test.com', role: 'user', password: 'secret' },
];

const fakePosts = [
  { id: 1, title: 'Hello', body: 'First post', excerpt: 'First post', author: 'Alice', createdAt: '2026-01-01' },
  { id: 2, title: 'TypeScript Tips', body: 'Advanced patterns', excerpt: 'Advanced patterns', author: 'Bob', createdAt: '2026-02-15' },
];

function buildApp() {
  class RootController extends Controller {
    setupRoutes(group: any) {
      group.get('/', () => ({ app: 'exedra-ts', version: '0.1.0' }));
    }

    groupUsers() { return UsersController; }
    groupPosts() { return PostController; }
    groupHealth() { return HealthController; }
    groupAdmin() { return AdminController; }
    groupDevices() { return DevicesController; }
  }

  @Path('/users')
  @Tag('api')
  class UsersController extends Controller {
    middlewareAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
      const token = req.headers.authorization;
      if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      next();
    }

    @Get('')
    @Name('users.index')
    getUsers() {
      return { data: fakeUsers.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })) };
    }

    @Get('/:id')
    @Name('users.show')
    getUser(id: string) {
      return fakeUsers.find(u => u.id === Number(id)) || fakeUsers[0];
    }

    @Post('')
    @Name('users.store')
    storeUser() {
      return { id: 3, name: 'New User', email: 'new@test.com' };
    }

    @Put('/:id')
    @Name('users.update')
    updateUser() {
      return { id: 1, name: 'Alice Updated', email: 'alice@test.com' };
    }

    @Delete('/:id')
    @Name('users.destroy')
    deleteUser() {
      return { deleted: true };
    }
  }

  @Path('/posts')
  @Tag('api')
  class PostController extends Controller {
    middlewareAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
      const token = req.headers.authorization;
      if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      next();
    }

    @Get('')
    @Name('posts.index')
    getPosts() {
      return { data: fakePosts };
    }

    @Get('/:id')
    @Name('posts.show')
    getPost(id: string) {
      return fakePosts.find(p => p.id === Number(id)) || fakePosts[0];
    }

    @Post('')
    @Name('posts.store')
    storePost() {
      return { id: 3, title: 'New Post', body: 'Content' };
    }

    @Patch('/:id')
    @Name('posts.update-partial')
    patchPost() {
      return { id: 1, title: 'Updated' };
    }
  }

  @Path('/health')
  class HealthController extends Controller {
    get() {
      return { status: 'ok' };
    }
  }

  @Path('/admin')
  class AdminController extends Controller {
    middlewareAuth(req: express.Request, _res: express.Response, next: express.NextFunction) {
      (req as any)._adminAuth = true;
      next();
    }

    @Get('')
    getAdminIndex() {
      return { admin: true };
    }

    groupSettings() { return AdminSettingsController; }
    groupStats() { return AdminStatsController; }
  }

  @Path('/settings')
  class AdminSettingsController extends Controller {
    @Get('')
    getSettings() {
      return { theme: 'dark' };
    }

    @Put('')
    updateSettings() {
      return { updated: true };
    }
  }

  @Path('/stats')
  class AdminStatsController extends Controller {
    @Get('')
    getStats() {
      return { views: 1000 };
    }
  }

  @Path('/devices')
  class DevicesController extends Controller {
    @Get('')
    getAll() {
      return { data: [{ id: 1, name: 'Phone' }] };
    }

    @Get('/:device')
    getDevice(@Param('device') device: string) {
      return { id: device };
    }

    @Post('')
    createDevice() {
      return { id: 2, name: 'New Device' };
    }
  }

  const app = express();
  app.use(express.json());
  createExedra(app, { controller: RootController, namedParamAutoInject: true, useFlatRouting: true });
  return app;
}

describe('Example app integration', () => {
  describe('RootController', () => {
    it('GET / returns app info', async () => {
      const res = await request(buildApp(), '/');
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.app).toBe('exedra-ts');
      expect(data.version).toBeDefined();
    });
  });

  describe('UsersController', () => {
    it('GET /users returns list', async () => {
      const res = await request(buildApp(), '/users', { headers: { authorization: 'Bearer test' } });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThanOrEqual(2);
      expect(data.data[0].name).toBe('Alice');
    });

    it('GET /users/1 returns single user', async () => {
      const res = await request(buildApp(), '/users/1', { headers: { authorization: 'Bearer test' } });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.id).toBe(1);
      expect(data.name).toBe('Alice');
    });

    it('POST /users creates user', async () => {
      const res = await request(buildApp(), '/users', { method: 'POST', body: { name: 'Test' }, headers: { authorization: 'Bearer test' } });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.id).toBe(3);
      expect(data.name).toBe('New User');
    });

    it('PUT /users/1 updates user', async () => {
      const res = await request(buildApp(), '/users/1', { method: 'PUT', body: { name: 'Updated' }, headers: { authorization: 'Bearer test' } });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.name).toBe('Alice Updated');
    });

    it('DELETE /users/1 deletes user', async () => {
      const res = await request(buildApp(), '/users/1', { method: 'DELETE', headers: { authorization: 'Bearer test' } });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ deleted: true });
    });

    it('GET /users without auth returns 401', async () => {
      const res = await request(buildApp(), '/users');
      expect(res.status).toBe(401);
      expect(JSON.parse(res.body).error).toBe('Unauthorized');
    });

    it('GET /users with auth returns data', async () => {
      const res = await request(buildApp(), '/users', { headers: { authorization: 'Bearer token' } });
      expect(res.status).toBe(200);
    });
  });

  describe('PostController', () => {
    it('GET /posts returns list', async () => {
      const res = await request(buildApp(), '/posts', { headers: { authorization: 'Bearer test' } });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.data).toHaveLength(2);
    });

    it('GET /posts/1 returns single post', async () => {
      const res = await request(buildApp(), '/posts/1', { headers: { authorization: 'Bearer test' } });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.id).toBe(1);
      expect(data.title).toBe('Hello');
    });

    it('POST /posts creates post', async () => {
      const res = await request(buildApp(), '/posts', { method: 'POST', body: { title: 'New' }, headers: { authorization: 'Bearer test' } });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.id).toBe(3);
    });

    it('PATCH /posts/1 patches post', async () => {
      const res = await request(buildApp(), '/posts/1', { method: 'PATCH', body: { title: 'Updated' }, headers: { authorization: 'Bearer test' } });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).title).toBe('Updated');
    });

    it('GET /posts without auth returns 401', async () => {
      const res = await request(buildApp(), '/posts');
      expect(res.status).toBe(401);
    });
  });

  describe('HealthController', () => {
    it('GET /health returns status ok', async () => {
      const res = await request(buildApp(), '/health');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
    });
  });

  describe('AdminController', () => {
    it('GET /admin returns admin index', async () => {
      const res = await request(buildApp(), '/admin');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ admin: true });
    });

    it('GET /admin/settings returns settings', async () => {
      const res = await request(buildApp(), '/admin/settings');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ theme: 'dark' });
    });

    it('PUT /admin/settings updates settings', async () => {
      const res = await request(buildApp(), '/admin/settings', { method: 'PUT', body: {} });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ updated: true });
    });

    it('GET /admin/stats returns stats', async () => {
      const res = await request(buildApp(), '/admin/stats');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ views: 1000 });
    });
  });

  describe('DevicesController', () => {
    it('GET /devices returns list', async () => {
      const res = await request(buildApp(), '/devices');
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.data).toHaveLength(1);
    });

    it('GET /devices/:device returns device', async () => {
      const res = await request(buildApp(), '/devices/abc');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ id: 'abc' });
    });

    it('POST /devices creates device', async () => {
      const res = await request(buildApp(), '/devices', { method: 'POST', body: { name: 'Tablet' } });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.id).toBe(2);
      expect(data.name).toBe('New Device');
    });
  });

  describe('listRoutes', () => {
    it('returns all registered routes', () => {
      const app = express();
      app.use(express.json());
      const rootGroup = createExedra(app, { controller: (class Root extends Controller {
        groupUsers() { return (class {
          static instance() { return this; }
        }) as any; }
      }) as any, useFlatRouting: true });
      const routes = rootGroup.listRoutes();
      expect(Array.isArray(routes)).toBe(true);
    });
  });
});

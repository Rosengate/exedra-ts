import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, Transformer, Include, Param, createExedra } from '../src';

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

describe('Transformer + Include system', () => {
  class UserTransformer {
    transform(user: any) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
      };
    }

    @Include('posts')
    includePosts(user: any) {
      return (user.posts || []).map((p: any) => ({ id: p.id, title: p.title }));
    }

    @Include('settings')
    includeSettings(_user: any) {
      return { theme: 'dark', notifications: true };
    }
  }

  const fakeUsers = [
    {
      id: 1,
      name: 'Alice',
      email: 'alice@test.com',
      posts: [{ id: 10, title: 'Hello' }, { id: 11, title: 'World' }],
    },
    {
      id: 2,
      name: 'Bob',
      email: 'bob@test.com',
      posts: [],
    },
  ];

  function makeApp() {
    class Root extends Controller {
      groupUsers() {
        return UsersController;
      }
    }

    @Path('/users')
    class UsersController extends Controller {
      @Get('')
      getUsers() {
        return { data: fakeUsers };
      }

      @Get('/:id')
      @Transformer(UserTransformer)
      getUser(@Param('id') id: string) {
        return fakeUsers.find((u) => u.id === Number(id)) || fakeUsers[0];
      }
    }

    const app = express();
    createExedra(app, { controller: Root, useFlatRouting: true });
    return app;
  }

  it('applies transformer without includes', async () => {
    const res = await request(makeApp(), '/users/1');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toEqual({ id: 1, name: 'Alice', email: 'alice@test.com' });
    expect(data.posts).toBeUndefined();
  });

  it('applies transformer with ?include=posts', async () => {
    const res = await request(makeApp(), '/users/1?include=posts');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.id).toBe(1);
    expect(data.name).toBe('Alice');
    expect(data.posts).toEqual([
      { id: 10, title: 'Hello' },
      { id: 11, title: 'World' },
    ]);
  });

  it('applies transformer with ?include=settings', async () => {
    const res = await request(makeApp(), '/users/1?include=settings');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.settings).toEqual({ theme: 'dark', notifications: true });
  });

  it('applies transformer with multiple includes', async () => {
    const res = await request(makeApp(), '/users/1?include=posts,settings');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.id).toBe(1);
    expect(data.posts).toHaveLength(2);
    expect(data.settings).toEqual({ theme: 'dark', notifications: true });
  });

  it('ignores unknown includes', async () => {
    const res = await request(makeApp(), '/users/1?include=invalid');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toEqual({ id: 1, name: 'Alice', email: 'alice@test.com' });
    expect(data.invalid).toBeUndefined();
  });

  it('handles empty include string', async () => {
    const res = await request(makeApp(), '/users/1?include=');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toEqual({ id: 1, name: 'Alice', email: 'alice@test.com' });
  });

  it('includes with empty array from source', async () => {
    const res = await request(makeApp(), '/users/2?include=posts');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.id).toBe(2);
    expect(data.posts).toEqual([]);
  });

  it('routes without @Transformer still work', async () => {
    const res = await request(makeApp(), '/users');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.data).toHaveLength(2);
  });
});

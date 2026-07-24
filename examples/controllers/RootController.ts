import express from 'express';
import { Controller, Group } from '../../src';
import UserController from './UserController';
import PostController from './PostController';
import HealthController from './HealthController';
import AdminController from './admin/AdminController';

class RootController extends Controller {
  setupRoutes(group: Group) {
    group.get('/', (_req: express.Request, res: express.Response) => {
      res.json({
        name: 'exedra-ts example',
        version: '0.1.0',
        endpoints: {
          health: 'GET /health',
          users: 'GET /users, POST /users, PUT /users/:id, DELETE /users/:id',
          posts: 'GET /posts, POST /posts, PATCH /posts/:id',
          admin: 'GET /admin, GET /admin/settings, GET /admin/stats',
        },
      });
    });
  }

  groupUsers() {
    return UserController;
  }

  groupPosts() {
    return PostController;
  }

  groupAdmin() {
    return AdminController;
  }

  groupHealth() {
    return HealthController;
  }
}

export default RootController;

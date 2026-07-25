import express from 'express';
import { Controller, Group } from '../../src';
import UsersController from './UsersController';
import PostController from './PostController';
import HealthController from './HealthController';
import AdminController from './admin/AdminController';
import DevicesController from "./DevicesController";
import SessionController from './SessionController';

class RootController extends Controller {
  setupRoutes(group: Group) {
    group.get('/', (_req: express.Request, res: express.Response) => {
      res.json({
        name: 'exedra-ts example',
        version: '0.1.0',
        endpoints: {
          health: 'GET /health',
          users:
            'GET /users, POST /users, PUT /users/:id, DELETE /users/:id',
          posts: 'GET /posts, POST /posts, PATCH /posts/:id',
          admin:
            'GET /admin, GET /admin/settings, GET /admin/stats',
          session:
            'GET /profile, GET /profile/:id, GET /admin/dashboard, GET /admin/inspect',
        },
      });
    });
  }

  groupUsers() {
    return UsersController;
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

  groupDevices() {
    return DevicesController;
  }

  groupProfile() {
    return SessionController;
  }
}

export default RootController;

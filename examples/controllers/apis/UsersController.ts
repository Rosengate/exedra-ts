import express from 'express';
import {
  Controller, Path, Get, Post, Put, Delete,
  Name, Tag, Validation, Transformer, Include,
} from '../../../src';
import { users, posts } from '../../data';
import UserApiController from "./user/UserApiController";

@Path('/users')
@Tag('api')
export default class UsersController extends Controller {
  middlewareAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    const token = req.headers.authorization;
    if (!token) {
      res.status(401).json({ error: 'Unauthorizedz' });
      return;
    }
    next();
  }

  middlewareRateLimit(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    next();
  }

  @Get('')
  getUsers() {
    return {
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      })),
    };
  }

  @Post('')
  @Validation({ name: 'required', email: 'required|email' })
  storeUser() {
    return {
      id: 4,
      name: 'New User',
      email: 'new@example.com',
    };
  }

  groupUser() {
    return UserApiController;
  }
}

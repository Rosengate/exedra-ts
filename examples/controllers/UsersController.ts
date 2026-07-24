import express from 'express';
import {
  Controller, Path, Get, Post, Put, Delete,
  Name, Tag, Validation, Transformer,
} from '../../src';
import { users } from '../data';

class UserTransformer {
  transform(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}

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
  @Name('users.index')
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

  @Get('/:id')
  @Name('users.show')
  @Transformer(UserTransformer)
  getUser() {
    return users[0];
  }

  @Post('')
  @Name('users.store')
  @Validation({ name: 'required', email: 'required|email' })
  storeUser() {
    return {
      id: 4,
      name: 'New User',
      email: 'new@example.com',
    };
  }

  @Put('/:id')
  @Name('users.update')
  updateUser() {
    return {
      id: 1,
      name: 'Alice Updated',
      email: 'alice@example.com',
    };
  }

  @Delete('/:id')
  @Name('users.destroy')
  deleteUser() {
    return { deleted: true };
  }
}
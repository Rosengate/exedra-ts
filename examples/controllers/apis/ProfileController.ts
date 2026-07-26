import express from 'express';
import {Controller, Path, Get, Param, Inject, Ctx, Context, Validation} from '../../../src';

export class User {
  constructor(public id: number, public name: string, public email: string) {}
}

const fakeUsers: Record<string, User> = {
  'token-alice': new User(1, 'Alice', 'alice@test.com'),
  'token-bob': new User(2, 'Bob', 'bob@test.com'),
};

// GET /profile — get current user via @Inject(User)
// GET /profile/:id — get user by ID, verify ownership
// Demonstrates: middleware registers services on per-request Context, handler injects via @Inject
@Path('/profile')
export default class ProfileController extends Controller {
  middleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
    ctx: Context,
  ) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = token ? fakeUsers[token] : undefined;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    ctx.service(User, user);
    ctx.service('token', token);
    next();
  }

  @Get('')
  getProfile(@Inject(User) user: User, @Ctx() ctx: Context) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }

  @Get('/:id')
  getProfileById(@Param('id') id: string, @Inject(User) user: User) {
    const requestedId = Number(id);

    if (user.id !== requestedId) {
      return { error: 'Forbidden', message: 'You can only view your own profile' };
    }

    return { id: user.id, name: user.name , status: 'ok'};
  }

  @Path('/:id')
  @Validation({
    name: 'required',
    email: 'required|email',
  })
  postProfile() {
    return {
    }
  }
}

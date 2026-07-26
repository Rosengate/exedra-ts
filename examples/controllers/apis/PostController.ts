import express from 'express';
import {
  Controller, Path, Get, Post, Patch,
  Name, Tag, Validation, Transformer,
} from '../../../src';
import { posts } from '../../data';

class PostTransformer {
  transform(post: any) {
    return {
      id: post.id,
      title: post.title,
      excerpt: post.excerpt || post.body?.slice(0, 100),
      author: post.author,
      createdAt: post.createdAt,
    };
  }
}

@Path('/posts')
@Tag('api')
class PostController extends Controller {
  middlewareAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    const token = req.headers.authorization;
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  }

  middlewareLog(
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) {
    console.log(`[PostController] ${req.method} ${req.path}`);
    next();
  }

  @Get('')
  getPosts() {
    return { data: posts };
  }

  @Get('/:id')
  @Transformer(PostTransformer)
  getPost(id: string) {
    return posts.find((p) => p.id === Number(id)) || posts[0];
  }

  @Post('')
  @Validation({ title: 'required', body: 'required' })
  storePost() {
    return {
      id: 3,
      title: 'New Post',
      body: 'Content here',
    };
  }

  @Patch('/:id')
  patchPost() {
    return {
      id: 1,
      title: 'Updated Title',
    };
  }
}

export default PostController;

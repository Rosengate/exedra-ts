import {Controller, Delete, Get, Include, Name, Path, Put, Transformer, Validation} from "../../../../src";
import {posts, users} from "../../../data";

class UserTransformer {
  transform(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  @Include('posts')
  includePosts(user: any) {
    return posts.filter((p) => p.author === user.name).map((p) => ({
      id: p.id,
      title: p.title,
      excerpt: p.excerpt,
    }));
  }

  @Include('settings')
  includeSettings(user: any) {
    return {
      notifications: true,
      theme: 'light',
    };
  }
}

@Path('/:user-id')
export default class UserApiController extends Controller {
  @Get('/:id')
  @Name('users.show')
  @Transformer(UserTransformer)
  getUser(id: string) {
    return users.find((u) => u.id === Number(id)) || users[0];
  }

  @Validation({
    name: 'required',
    email: 'required|email',
  })
  post() {
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

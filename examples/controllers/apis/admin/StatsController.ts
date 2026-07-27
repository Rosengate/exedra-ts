import {Controller, Path, Get, Name} from '../../../../src';
import { users, posts } from '../../../data';

@Path('/stats')
@Name('stats')
export default class AdminStatsController extends Controller {
  @Get('')
  getStats() {
    return {
      totalUsers: users.length,
      totalPosts: posts.length,
      uptime: process.uptime(),
    };
  }
}

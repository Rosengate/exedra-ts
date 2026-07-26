import express from 'express';
import {Controller, Path, Get, Name} from '../../../src';
import AdminSettingsController from './SettingsController';
import AdminStatsController from './StatsController';

@Path('/admin')
@Name('admin')
class AdminController extends Controller {
  middlewareAuth(
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) {
    console.log('[AdminController] Checking auth for admin area');
    next();
  }

  middlewareLog(
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) {
    console.log(`[Admin] ${req.method} ${req.path}`);
    next();
  }

  groupSettings() {
    return AdminSettingsController;
  }

  groupStats() {
    return AdminStatsController;
  }

  @Get('')
  getAdminIndex() {
    return {
      area: 'admin',
      message: 'Welcome to admin panel',
    };
  }
}

export default AdminController;

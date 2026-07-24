import express from 'express';
import { Controller, Path, Get, Put } from '../../../src';

@Path('/settings')
class AdminSettingsController extends Controller {
  middlewareAdminOnly(req: express.Request, _res: express.Response, next: express.NextFunction) {
    console.log('[AdminSettings] Checking admin access');
    next();
  }

  @Get('')
  getSettings() {
    return { settings: { theme: 'dark', lang: 'en' } };
  }

  @Put('')
  updateSettings() {
    return { updated: true };
  }
}

export default AdminSettingsController;

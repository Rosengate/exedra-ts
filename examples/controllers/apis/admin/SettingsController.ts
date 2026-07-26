import express from 'express';
import {Controller, Path, Get, Put, FailRoute, Name} from '../../../../src';
import TerminalSettingsApiController from "./settings/TerminalSettingsApiController";

@Path('/settings')
export default class AdminSettingsController extends Controller {
  middlewareAdminOnly(
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) {
    console.log('[AdminSettings] Checking admin access');
    next();
  }

  @Get('')
  getSettings() {
    return {
      settings: {
        theme: 'dark',
        lang: 'en',
      },
    };
  }

  @Put('')
  updateSettings() {
    return { updated: true };
  }

  @FailRoute
  get404() {
    return { error: 'Not Found' };
  }

  groupTerminal() {
    return TerminalSettingsApiController;
  }
}

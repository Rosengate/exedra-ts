import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Controller, Path, Get, Param } from '../src';
import { createExedra } from '../src/handler';

function request(app: express.Application, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let server: http.Server;
    const timer = setTimeout(() => { server.close(); reject(new Error('timeout')); }, 5000);
    server = app.listen(0, () => {
      const addr = server.address() as any;
      http.get(`http://localhost:${addr.port}${path}`, (res) => {
        let body = '';
        res.on('data', (d: Buffer) => (body += d));
        res.on('end', () => {
          clearTimeout(timer);
          server.close();
          resolve({ status: res.statusCode || 0, body });
        });
      });
    });
  });
}

function makeNestedApp(useFlatRouting: boolean) {
  class Root extends Controller {
    groupDeviceScreens() {
      return DeviceScreensController;
    }
  }

  @Path('/:deviceId/screens')
  class DeviceScreensController extends Controller {
    @Get('')
    listScreens() {
      return { route: 'list' };
    }

    @Get('/:screenId')
    getScreen(@Param('screenId') screenId: string, @Param('deviceId') deviceId: string) {
      return { screenId, deviceId };
    }
  }

  const app = express();
  createExedra(app, { controller: Root, useFlatRouting });
  return app;
}

function makeSimpleApp(useFlatRouting: boolean) {
  class Root extends Controller {
    groupHealth() {
      return HealthCheck;
    }
  }

  @Path('/health')
  class HealthCheck extends Controller {
    get() {
      return { status: 'ok' };
    }
  }

  const app = express();
  createExedra(app, { controller: Root, useFlatRouting });
  return app;
}

function makeMiddlewareApp(useFlatRouting: boolean) {
  class Root extends Controller {
    groupDevices() {
      return DeviceController;
    }
  }

  @Path('/:deviceId')
  class DeviceController extends Controller {
    middlewareLog(req: express.Request, _res: express.Response, next: express.NextFunction) {
      (req as any)._loggedDeviceId = req.params.deviceId;
      next();
    }

    @Get('/:screenId')
    getScreen(req: express.Request) {
      return {
        deviceId: (req as any)._loggedDeviceId,
        screenId: req.params.screenId,
      };
    }
  }

  const app = express();
  createExedra(app, { controller: Root, useFlatRouting });
  return app;
}

describe('Routing modes', () => {
  describe('Express mode (useFlatRouting: false) — default', () => {
    it('resolves nested route params via mergeParams', async () => {
      const res = await request(makeNestedApp(false), '/dev123/screens/screen456');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ screenId: 'screen456', deviceId: 'dev123' });
    });

    it('resolves basePath param on child route', async () => {
      const res = await request(makeNestedApp(false), '/dev123/screens');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ route: 'list' });
    });

    it('middleware sees all params from mount path', async () => {
      const res = await request(makeMiddlewareApp(false), '/dev123/screen456');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ deviceId: 'dev123', screenId: 'screen456' });
    });
  });

  describe('Flat mode (useFlatRouting: true)', () => {
    it('resolves nested route params via direct registration', async () => {
      const res = await request(makeNestedApp(true), '/dev123/screens/screen456');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ screenId: 'screen456', deviceId: 'dev123' });
    });

    it('resolves basePath param on child route', async () => {
      const res = await request(makeNestedApp(true), '/dev123/screens');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ route: 'list' });
    });

    it('middleware sees all params from mount path', async () => {
      const res = await request(makeMiddlewareApp(true), '/dev123/screen456');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ deviceId: 'dev123', screenId: 'screen456' });
    });
  });

  describe('Both modes produce same results for simple routes', () => {
    it('simple single-level route works in both modes', async () => {
      for (const useFlat of [true, false]) {
        const result = await request(makeSimpleApp(useFlat), '/health');
        expect(result.status).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ status: 'ok' });
      }
    });
  });
});

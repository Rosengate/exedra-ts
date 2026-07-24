import 'reflect-metadata';
import { Controller, Path, Get, createExedra } from '../src';
import express from 'express';
import http from 'http';

class RootController extends Controller {
  groupDeviceScreens() {
    return DeviceScreensController;
  }
}

@Path('/:deviceId/screens')
class DeviceScreensController extends Controller {
  middlewareAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    console.log('middlewareAuth req.params:', JSON.stringify(req.params));
    next();
  }

  @Path('/:screenId')
  get(screenId: string, deviceId: string) {
    return [{ screenId, deviceId }];
  }
}

const app = express();
createExedra(app, { controller: RootController, namedParamAutoInject: true });

const server = app.listen(3333, () => {
  http.get('http://localhost:3333/device123/screens/screen456', (res) => {
    let body = '';
    res.on('data', (d: Buffer) => (body += d));
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Body:', body);
      server.close();
      process.exit(0);
    });
  });
});

setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 8000);

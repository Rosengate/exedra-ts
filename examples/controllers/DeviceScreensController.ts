import {Controller, Path} from "../../src";
import express from "express";

@Path('/:deviceId/screens')
export default class DeviceScreensController extends Controller {
    middlewareAuth(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
        deviceId: string
    ) {
        next();
    }

    @Path('/:screenId')
    get(deviceId: string) {
        return [{
            hello: deviceId
        }];
    }
}
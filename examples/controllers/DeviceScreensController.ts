import {Controller, Path} from "../../src";
import express from "express";

@Path('/:deviceId/screens')
export default class DeviceScreensController extends Controller {
    middlewareAuth(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ) {
        console.log(req.params.deviceId) // doesn't work

        next();
    }

    @Path('/:screenId')
    get(screenId: string, deviceId: string, req: express.Request) {
        return [{
            screenId: screenId,
            deviceId: deviceId, // doesn't work
            deviceIdFromRequest: req.params.deviceId // doesn't work
        }];
    }
}
import {Controller, Path} from "../../src";
import express from "express";

@Path('/devices')
export default class DevicesController extends Controller {
    @Path('/')
    get() {
        return {
            hello: 'world'
        }
    }

    @Path('/:device')
    getDevice(request: express.Request) {
        return {
            hello: request.params.device
        }
    }
}
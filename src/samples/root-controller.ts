import {Controller, Get} from "../decorators/decorators.js";
import ApisController from "./apis-controller.js";
import WebController from "./web-controller.js";

export default class RootController {
    // middleware() {
    //     console.log('hello world');
    // }

    @Get('/')
    get() {
    }

    @Get('/contact-me')
    contactMe(req: any, res: any) {
        return res.send('hehe');
    }

    groupWeb() {
        return WebController;
    }

    groupApis() {
        return ApisController;
    }
}
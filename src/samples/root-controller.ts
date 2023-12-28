import {controller, get} from "../decorators/decorators.js";
import ApisController from "./apis-controller.js";
import WebController from "./web-controller.js";

export default class RootController {
    // middleware() {
    //     console.log('hello world');
    // }

    @get('/')
    get() {
    }

    @get('/contact-me')
    contactMe(req: any, res: any) {
        return res.send('hehe');
    }

    // groupWeb() {
    //     return WebController;
    // }
    //
    // groupApis() {
    //     return ApisController;
    // }
}
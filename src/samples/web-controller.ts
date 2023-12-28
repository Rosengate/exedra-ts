import {controller, middleware, path} from "../decorators/decorators.js";

@controller('/')
export default class WebController {
    @middleware()
    middleware() {

    }

    index() {
    }

    @path('/contact-us')
    contactUs() {
    }
}
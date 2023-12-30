import {Controller, Middleware, Path} from "../decorators/decorators.js";

@Controller('/')
export default class WebController {
    @Middleware()
    middleware() {

    }

    index() {
    }

    @Path('/contact-us')
    contactUs() {
    }
}
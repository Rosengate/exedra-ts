import path from "../decorators/path.js";

export default class WebController {
    @path('/contact-us')
    contactUs() {
    }
}
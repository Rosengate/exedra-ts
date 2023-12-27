import ApisController from "./apis-controller.js";
import WebController from "./web-controller.js";

export default class RootController {
    middleware() {
        console.log('hello world');
    }

    groupWeb() {
        return WebController;
    }

    groupApis() {
        return ApisController;
    }
}
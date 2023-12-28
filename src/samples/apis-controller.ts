import {controller, middleware, path} from "../decorators/decorators.js";
import UsersApisController from "./users-apis-controller.js";

@controller('/apis')
export default class ApisController {
    @path('/')
    get() {
    }

    @path('/cool')
    getCool() {
    }

    groupUsers() {
        return UsersApisController;
    }
}
import {Controller, Middleware, Path} from "../decorators/decorators.js";
import UsersApisController from "./apis/users-apis-controller.js";

@Controller('/apis')
export default class ApisController {
    @Path('/')
    get() {
    }

    @Path('/cool')
    getCool() {
    }

    groupUsers() {
        return UsersApisController;
    }
}
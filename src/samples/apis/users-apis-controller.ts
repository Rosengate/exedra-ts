import {controller, get, path} from "../../decorators/decorators.js";
import UserApiController from "./user-api-controller.js";

@controller('/users')
export default class UsersApisController {
    @get('/')
    list() {
    }

    groupUser() {
        return UserApiController;
    }
}
import {controller, get, path, post} from "../../decorators/decorators.js";
import UserLogsApiController from "./user/user-logs-api-controller.js";

@controller('/:userId')
export default class UserApiController {
    @get('/')
    get() {
    }

    @post('/')
    post() {
    }

    groupLogs() {
        return UserLogsApiController
    }
}
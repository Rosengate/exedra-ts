import {Controller, Get, Path} from "../../decorators/decorators.js";
import UserApiController from "./user-api-controller.js";

@Controller('/users')
export default class UsersApisController {
    @Get('/')
    list() {
    }

    groupUser() {
        return UserApiController;
    }
}
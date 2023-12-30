import {Controller, Get, Path, Post} from "../../decorators/decorators.js";
import UserLogsApiController from "./user/user-logs-api-controller.js";

@Controller('/:userId')
export default class UserApiController {
    @Get('/')
    get() {
    }

    @Post('/')
    post() {
    }

    groupLogs() {
        return UserLogsApiController
    }
}
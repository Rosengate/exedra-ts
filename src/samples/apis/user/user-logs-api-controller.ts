import {Controller, Get} from "../../../decorators/decorators.js";

@Controller('/logs')
export default class UserLogsApiController {
    @Get('/')
    get() {
    }
}
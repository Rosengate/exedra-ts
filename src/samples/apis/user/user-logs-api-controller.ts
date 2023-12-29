import {controller, get} from "../../../decorators/decorators.js";

@controller('/logs')
export default class UserLogsApiController {
    @get('/')
    get() {

    }
}
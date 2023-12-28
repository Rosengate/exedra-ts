import {controller, get, path} from "../decorators/decorators.js";

@controller('/users')
export default class UsersApisController {
    @get('/list')
    list() {
    }
}
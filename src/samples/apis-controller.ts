import path from "../decorators/path.js";

@path('/apis')
export default class ApisController {
    @path('/')
    get() {
    }
}
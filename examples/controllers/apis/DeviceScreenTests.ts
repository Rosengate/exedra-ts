import {Controller, Path} from "../../../src";

@Path('/:screenId/tests')
export default class DeviceScreenTests extends Controller {
    get(screenId: string, deviceId: string) {
        return {screenId, deviceId};
    }
}

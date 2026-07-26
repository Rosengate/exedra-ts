import {Controller, Path} from "../../../../../src";

@Path('/terminal')
export default class TerminalSettingsApiController extends Controller {
  get() {
    return {
      status: 'ok',
    };
  }
}

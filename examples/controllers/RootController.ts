import { Controller, Group } from '../../src';
import ApisController from "./ApisController";

class RootController extends Controller {
  get() {
    return {
      status: 'ok',
    }
  }

  groupApis() {
    return ApisController;
  }
}

export default RootController;

import { Controller, Group } from '../../src';
import ApisController from './ApisController';
import WebController from './WebController';

class RootController extends Controller {
  groupApis() {
    return ApisController;
  }

  groupWeb() {
    return WebController;
  }
}

export default RootController;

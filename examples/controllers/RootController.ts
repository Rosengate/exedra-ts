import {Controller, createValidationMiddleware, Group, Middleware} from '../../src';
import ApisController from './ApisController';
import WebController from './WebController';

export default class RootController extends Controller {
  groupApis() {
    return ApisController;
  }

  groupWeb() {
    return WebController;
  }
}

import {Controller, createValidationMiddleware, Group, Middleware} from '../../src';
import ApisController from './ApisController';
import WebController from './WebController';

@Middleware(createValidationMiddleware((data, rules) => {
  console.log('Validation data:', data);
  console.log('Validation rules:', rules);
}))
export default class RootController extends Controller {
  groupApis() {
    return ApisController;
  }

  groupWeb() {
    return WebController;
  }
}

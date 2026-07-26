import { Controller, Group } from '../../src';
import UsersController from './UsersController';
import PostController from './PostController';
import HealthController from './HealthController';
import AdminController from './admin/AdminController';
import DevicesController from "./DevicesController";
import ProfileController from "./ProfileController";
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

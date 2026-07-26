import { Controller, Group } from '../../src';
import UsersController from './UsersController';
import PostController from './PostController';
import HealthController from './HealthController';
import AdminController from './admin/AdminController';
import DevicesController from "./DevicesController";
import SessionController from './SessionController';

class RootController extends Controller {
  get() {
    return {
      status: 'ok',
    }
  }

  groupUsers() {
    return UsersController;
  }

  groupPosts() {
    return PostController;
  }

  groupAdmin() {
    return AdminController;
  }

  groupHealth() {
    return HealthController;
  }

  groupDevices() {
    return DevicesController;
  }

  groupProfile() {
    return SessionController;
  }
}

export default RootController;

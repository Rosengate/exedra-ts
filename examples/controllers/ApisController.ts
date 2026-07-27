import {Controller, Path} from "../../src";
import UsersController from "./apis/UsersController";
import PostController from "./apis/PostController";
import AdminController from "./apis/admin/AdminController";
import HealthController from "./apis/HealthController";
import DevicesController from "./apis/DevicesController";
import ProfileController from "./apis/ProfileController";

@Path('/apis')
export default class ApisController extends Controller {
  async middlewareDataWrapping(req: any, res: any, next: any) {
    return {
      data: await next()
    };
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
    return ProfileController;
  }
}

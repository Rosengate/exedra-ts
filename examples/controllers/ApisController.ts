import {Controller, Path} from "../../src";
import UsersController from "./UsersController";
import PostController from "./PostController";
import AdminController from "./admin/AdminController";
import HealthController from "./HealthController";
import DevicesController from "./DevicesController";
import ProfileController from "./ProfileController";

@Path('/apis')
export default class ApisController extends Controller {
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

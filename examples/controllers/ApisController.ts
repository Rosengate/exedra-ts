import {Controller, FailRoute, Path} from "../../src";
import UsersController from "./apis/UsersController";
import PostController from "./apis/PostController";
import AdminController from "./apis/admin/AdminController";
import HealthController from "./apis/HealthController";
import DevicesController from "./apis/DevicesController";
import ProfileController from "./apis/ProfileController";
import express from "express";

@Path('/apis')
export default class ApisController extends Controller {
  async middlewareErrorHandling(req: any, res: any, next: any) {
    try {
      return await next();
    } catch (e: any) {
      return {
        error: {
          message: e.message
        }
      }
    }
  }

  async middlewareDataWrapping(req: any, res: any, next: any) {
    return {
      data: await next()
    };
  }

  @FailRoute
  notFound(res: express.Response) {
    // catch any route not found
    return res.status(404).json({
      error: {
        message: 'Invalid endpoint'
      }
    });
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

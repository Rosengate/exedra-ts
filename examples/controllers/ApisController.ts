import {Controller, Path} from "../../src";
import UsersController from "./apis/UsersController";
import PostController from "./apis/PostController";
import AdminController from "./apis/admin/AdminController";
import HealthController from "./apis/HealthController";
import DevicesController from "./apis/DevicesController";
import ProfileController from "./apis/ProfileController";

@Path('/apis')
export default class ApisController extends Controller {
  // async middlewareZero(req: any, res: any, next: any) {
  //   try {
  //     await next();
  //   } catch (e: any) {
  //     res.status(500).json({ error: e.message });
  //   }
  // }
  //
  // async middlewareOne(req: any, res: any, next: any) {
  //   try {
  //     await next();
  //   } catch (e: any) {
  //     throw new Error(`Middleware One Error and ${e.message}`);
  //   }
  // }
  //
  // async middlewareTwo(req: any, res: any, next: any) {
  //   try {
  //     await next();
  //   } catch (e: any) {
  //     throw new Error(`Middleware Two Error and ${e.message}`);
  //   }
  // }


  // middlewareFinal() {
  //   return async (req: any, res: any, next: any) => {
  //     try {
  //       await next();
  //
  //       res.status(200).json({
  //         ok: 'la'
  //       })
  //     } catch (e: any) {
  //       res.status(500).json({ error: e.message });
  //     }
  //   }
  // }
  //
  async middlewareThree(req: any, res: any, next: any) {
    try {
      await next();
    } catch (e: any) {
      return res.status(500).json({ zerror: e.message });

      return {
        ok: 'tak?'
      }
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
    return ProfileController;
  }
}

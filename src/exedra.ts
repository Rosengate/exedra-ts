import * as core from 'express-serve-static-core';
import express, {Router} from "express";

export default class Exedra {
    constructor(protected app: core.Express) {
    }

    run(controller: any) {
        this.handle(controller);
    }

    handle(controller: any) : express.Router {
        const router = express.Router({mergeParams: true});

        const methods = Reflect.ownKeys(controller.prototype)
            .filter(k => typeof controller.prototype[k] === 'function')
            .map(k => k.toString())
            .filter(method => !['constructor'].includes(method));

        for (const method of methods) {
            if (method.indexOf('group') === 0) {
                this.handleGroup(router, controller, method);
            } else if (method.indexOf('middleware') === 0) {
                this.handleMiddleware(router, controller, method);
            } else if (method.indexOf('setup')) {
                this.handleSetup(router, controller, method);
            } else {
                this.handleRoute(router, controller, method);
            }
        }

        return router;
    }

    handleMiddleware(router: Router, controller: any, method: string) {
        router.use((req, next) => (new controller)[method](req, next));
    }

    handleSetup(router: Router, controller: any, method: string) {
        (new controller)[method](router);
    }

    handleRoute(router: Router, controller: any, func: string) {
        const obj = new controller;


        obj[func].apply(obj, []);
    }

    handleGroup(router: Router, controller: any, method: string) {
        const child = (new controller)[method]();
        const path = '';

        router.use(path, this.handle(child));
    }
}
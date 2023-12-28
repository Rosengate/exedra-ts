import * as core from 'express-serve-static-core';
import express, {Router} from "express";
import RoutingGroup from "./routing/routing-group.js";
import {type} from "os";
import RoutingMeta from "./decorators/routing-meta.js";
import MethodMeta from "./decorators/method-meta.js";
import {getMethodMeta, getRoutingMeta} from "./decorators/decorators.js";
import exp from "constants";
import AbstractHandler from "./handler/abstract-handler.js";
import GroupHandler from "./handler/group-handler.js";
import MiddlewareHandler from "./handler/middleware-handler.js";
import RouteHandler from "./handler/route-handler.js";
import SetupHandler from "./handler/setup-handler.js";

export default class Exedra {
    constructor(protected app: core.Express, readonly handlers: AbstractHandler[]) {
    }

    static createDefault(app: core.Express) {
        const exedra = new Exedra(app, [
            new MiddlewareHandler(),
            new RouteHandler(),
            new SetupHandler()
        ]);

        exedra.handlers.push(new GroupHandler(exedra));

        return exedra;
    }

    run(controller: any) {
        this.app.use(this.handle(controller).router);
    }

    handle(controller: any) : RoutingMeta {
        // const group: RoutingGroup = {
        //     middlewares: [],
        //     prefix: "",
        //     routes: []
        // }
        const routing = getRoutingMeta(controller);

        const router = express.Router({mergeParams: true});
        routing.router = router;

        const methods = Reflect.ownKeys(controller.prototype)
            .filter(k => typeof controller.prototype[k] === 'function')
            .map(k => k.toString())
            .filter(method => !['constructor'].includes(method));

        routing.controller = new controller;

        for (const method of methods) {
            const methodMeta = getMethodMeta(controller, method);
            methodMeta.callable = routing.controller[method];

            for (const handler of this.handlers)
                handler.setup(router, routing, methodMeta);

            for (const handler of this.handlers) {
                if (handler.validate(router, routing, methodMeta))
                    handler.handle(router, routing, methodMeta);
            }

            // by prefixes
            if (method.indexOf('group') === 0) {
                methodMeta.type = 'group';
            } else if (method.indexOf('setup') === 0) {
                methodMeta.type = 'setup';
            }



            if (methodMeta.type == 'group')
                this.handleGroup(router, routing, methodMeta);
            else if (methodMeta.type == 'setup')
                this.handleSetup(router, routing, methodMeta);
            else if (methodMeta.type == 'route')
                this.handleRoute(router, routing, methodMeta);
            else if (methodMeta.type == 'middleware')
                this.handleMiddleware(router, routing, methodMeta);
        }

        // const c = express.Router({mergeParams: true});
        // c.post('/hehe', () => {
        //
        // })

        // router.use('/keke', c)

        return routing;
    }

    handleMiddleware(router: Router, routing: RoutingMeta, methodMeta: MethodMeta) {
        router.use((req, next) => methodMeta.callable(req, next));
    }

    handleSetup(router: Router, routing: RoutingMeta, methodMeta: MethodMeta) {
        methodMeta.callable(router);
    }

    handleRoute(router: Router, routing: RoutingMeta, methodMeta: MethodMeta) {
        if (!methodMeta.method) {
            return;
        }

        router[methodMeta.method](methodMeta.path, (req, res) => methodMeta.callable.apply(routing.controller, [req, res]));
    }

    handleGroup(router: Router, routing: RoutingMeta, methodMeta: MethodMeta) {
        const child = methodMeta.callable();
        // const path = '';

        const childRouting = this.handle(child);

        // const r = express.Router({mergeParams: true})
        //
        // r.get('/he', () => {
        //
        // })
        //
        // router.use('/huh', r);
        router.use(childRouting.prefix, childRouting.router);
    }
}
import AbstractHandler from "./abstract-handler.js";
import e from "express";
import RoutingMeta from "../decorators/routing-meta.js";
import MethodMeta from "../decorators/method-meta.js";

export default class RouteHandler extends AbstractHandler {
    handle(router: e.Router, routing: RoutingMeta, methodMeta: MethodMeta): void {
        if (!methodMeta.method) {
            return;
        }

        router[methodMeta.method](methodMeta.path, (req, res) => methodMeta.callable.apply(routing.controller, [req, res]));
    }

    validate(router: e.Router, routing: RoutingMeta, methodMeta: MethodMeta): boolean {
        return methodMeta.type == 'route';
    }

}
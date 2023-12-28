import AbstractHandler from "./abstract-handler.js";
import e from "express";
import RoutingMeta from "../decorators/routing-meta.js";
import MethodMeta from "../decorators/method-meta.js";

export default class MiddlewareHandler extends AbstractHandler {
    handle(router: e.Router, routing: RoutingMeta, methodMeta: MethodMeta): void {
        router.use((req, next) => methodMeta.callable(req, next));
    }

    validate(router: e.Router, routing: RoutingMeta, methodMeta: MethodMeta): boolean {
        return methodMeta.type == 'middleware';
    }

}
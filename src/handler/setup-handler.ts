import AbstractHandler from "./abstract-handler.js";
import e from "express";
import RoutingMeta from "../decorators/routing-meta.js";
import MethodMeta from "../decorators/method-meta.js";

export default class SetupHandler extends AbstractHandler {
    setup(router: e.Router, routing: RoutingMeta, methodMeta: MethodMeta) {
        methodMeta.type = 'setup';
    }

    handle(router: e.Router, routing: RoutingMeta, methodMeta: MethodMeta): void {
        methodMeta.callable(router);
    }

    validate(router: e.Router, routing: RoutingMeta, methodMeta: MethodMeta): boolean {
        return methodMeta.type == 'setup';
    }
}
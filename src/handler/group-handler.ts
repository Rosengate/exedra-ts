import AbstractHandler from "./abstract-handler.js";
import e from "express";
import RoutingMeta from "../decorators/routing-meta.js";
import MethodMeta from "../decorators/method-meta.js";
import Exedra from "../exedra.js";

export default class GroupHandler extends AbstractHandler {
    constructor(protected exedra: Exedra) {
        super();
    }

    setup(router: e.Router, routing: RoutingMeta, methodMeta: MethodMeta) {
        if (methodMeta.name.indexOf('group'))
            methodMeta.type = 'group';
    }

    handle(router: e.Router, routing: RoutingMeta, methodMeta: MethodMeta): void {
        const child = methodMeta.callable();

        const childRouting = this.exedra.handle(child);

        router.use(childRouting.prefix, childRouting.router);
    }

    validate(router: e.Router, routing: RoutingMeta, methodMeta: MethodMeta): boolean {
        return methodMeta.type == 'group';
    }
}
import {Router} from "express";
import RoutingMeta from "../decorators/routing-meta.js";
import MethodMeta from "../decorators/method-meta.js";

export default abstract class AbstractHandler {
    setup(router: Router, routing: RoutingMeta, methodMeta: MethodMeta) : void {
    }

    abstract validate(router: Router, routing: RoutingMeta, methodMeta: MethodMeta): boolean
    abstract handle(router: Router, routing: RoutingMeta, methodMeta: MethodMeta) : void
}
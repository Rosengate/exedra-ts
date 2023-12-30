import "reflect-metadata";
import RoutingGroup from "../routing/routing-group.js";
import RoutingMeta from "./routing-meta.js";
import MethodMeta from "./method-meta.js";

// const isMethod = (target: any, propertyKey: any, descriptor: any) => {
//     return !!descriptor;
// }

export function getRoutingMeta(controller: any) : RoutingMeta {
    if (!controller._meta)
        controller._meta = new RoutingMeta();

    return controller._meta;
}

export function getMethodMeta(controller: any, method: any) : MethodMeta {
    const routingMeta = getRoutingMeta(controller);

    if (!routingMeta.methods[method])
        routingMeta.methods[method] = new MethodMeta(method);

    return routingMeta.methods[method];
}

export const Path = (path: string) : MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        getMethodMeta(target.constructor, propertyKey).path = path;
        getMethodMeta(target.constructor, propertyKey).type = 'route';

        if (!getMethodMeta(target.constructor, propertyKey).method)
            getMethodMeta(target.constructor, propertyKey).method = 'get';
    }
}

export const Get = (path: string) : MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        getMethodMeta(target.constructor, propertyKey).type = 'route';
        getMethodMeta(target.constructor, propertyKey).path = path;
        getMethodMeta(target.constructor, propertyKey).method = 'get';
    }
}

export const Post = (path: string) : MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        getMethodMeta(target.constructor, propertyKey).type = 'route';
        getMethodMeta(target.constructor, propertyKey).path = path;
        getMethodMeta(target.constructor, propertyKey).method = 'post';
    }
}

export const Delete = (path: string) : MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        getMethodMeta(target.constructor, propertyKey).type = 'route';
        getMethodMeta(target.constructor, propertyKey).path = path;
        getMethodMeta(target.constructor, propertyKey).method = 'delete';
    }
}

export const Patch = (path: string) : MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        getMethodMeta(target.constructor, propertyKey).type = 'route';
        getMethodMeta(target.constructor, propertyKey).path = path;
        getMethodMeta(target.constructor, propertyKey).method = 'patch';
    }
}

export const Put = (path: string) : MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        getMethodMeta(target.constructor, propertyKey).type = 'route';
        getMethodMeta(target.constructor, propertyKey).path = path;
        getMethodMeta(target.constructor, propertyKey).method = 'put';
    }
}

export const Middleware = () : MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        getMethodMeta(target.constructor, propertyKey).type = 'middleware';
    }
}

export const Method = (method: 'get' | 'post' | 'delete' | 'patch') : MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        getMethodMeta(target.constructor, propertyKey).method = method;
    }
}

export const Controller = (prefix: string) : ClassDecorator => {
    return (target) => {
        getRoutingMeta(target).prefix = prefix;
    }
}
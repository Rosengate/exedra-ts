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

export const path = (path: string) : MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        getMethodMeta(target.constructor, propertyKey).path = path;
        getMethodMeta(target.constructor, propertyKey).type = 'route';

        if (!getMethodMeta(target.constructor, propertyKey).method)
            getMethodMeta(target.constructor, propertyKey).method = 'get';
    }
}

export const get = (path: string) : MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        getMethodMeta(target.constructor, propertyKey).type = 'route';
        getMethodMeta(target.constructor, propertyKey).path = path;
        getMethodMeta(target.constructor, propertyKey).method = 'get';
    }
}

export const post = (path: string) : MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        getMethodMeta(target.constructor, propertyKey).type = 'route';
        getMethodMeta(target.constructor, propertyKey).path = path;
        getMethodMeta(target.constructor, propertyKey).method = 'post';
    }
}

export const middleware = () : MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        getMethodMeta(target.constructor, propertyKey).type = 'middleware';
    }
}

export const method = (method: 'get' | 'post' | 'delete' | 'patch') : MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        getMethodMeta(target.constructor, propertyKey).method = method;
    }
}

export const controller = (prefix: string) : ClassDecorator => {
    return (target) => {
        getRoutingMeta(target).prefix = prefix;
    }
}


// export function path(path: string) : any {
//     return (target: any, propertyKey: any, descriptor: any) => {
//         const isMethod = !!descriptor;
//
//         const controller = isMethod ? target.constructor : target;
//
//         if (isMethod) {
//
//         } else {
//
//         }
//         // const controller = isMethod(target, propertyKey, descriptor) ? target.constructor : target;
//
//         controller.routes = [];
//
//         if (!Reflect.hasMetadata('routes', target.constructor))
//             Reflect.defineMetadata('routes', [], target.constructor);
//     }
// }
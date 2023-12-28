import Route from "./route.js";

export default class RoutingGroup {
    prefix: string = '/';
    routes: Route[] = [];
    middlewares: any[];

    route(name: string) : Route {
        return this.routes.find(r => r.name == name) ?? {
            name: name
        } as Route
    }
}
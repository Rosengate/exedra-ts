// export default function decoTest(de: string) : any {
//     console.log(`decotest factory ${de}`);
//
//     return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
//         console.log(`decotest call`);
//         console.log('target', target);
//         console.log('propkey', propertyKey);
//         console.log('desc', descriptor);
//     }
// }
import "reflect-metadata";
import Route from "../routing/route.js";

export default (path: string) : MethodDecorator => {
    console.log('factory');

    return (target, propertyKey) => {
        if (!Reflect.hasMetadata('routes', target.constructor))
            Reflect.defineMetadata('routes', [], target.constructor);

        const routes = Reflect.getMetadata('routes', target.constructor) as Array<Route>;

        const method = 'GET';

        // routes.push({
        //     flags: [],
        //     method: method,
        //     path: path,
        //     serieses: [],
        //     states: {}
        // });
    }
}
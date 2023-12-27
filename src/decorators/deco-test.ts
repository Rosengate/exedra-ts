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

export default (de: string) : MethodDecorator => {
    console.log('factory');

    return (target, propertyKey) => {
        if (!Reflect.hasMetadata('routes', target.constructor))
            Reflect.defineMetadata('routes', [], target.constructor);

        const routes = Reflect.getMetadata('routes', target.constructor) as Array<any>

        routes.push({
            path: path
        });

        console.log(target.constructor);
        console.log(propertyKey);
    }
}
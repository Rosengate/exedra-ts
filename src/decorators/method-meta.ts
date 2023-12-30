export default class MethodMeta {
    path: string;
    method: 'get' | 'post' | 'delete' | 'patch' | 'put' | null = null;
    isMiddleware: boolean = false;
    isGroup: boolean = false;
    isSetup: boolean = false;
    type: 'setup' | 'middleware' | 'group' | 'route' | null = null;
    callable: Function

    constructor(readonly name: string) {
    }
}
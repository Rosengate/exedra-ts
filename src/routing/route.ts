export default class Route {
    name: string;
    path: string = '';
    method: string = 'any';
    states: {} = {};
    serieses: [] = [];
    flags: [] = [];

    static fromMethod(controller: any, method: string) {
    }

    static fromClass(controller: any) {

    }
}
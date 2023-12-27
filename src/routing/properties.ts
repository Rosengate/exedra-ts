export default class Properties {
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
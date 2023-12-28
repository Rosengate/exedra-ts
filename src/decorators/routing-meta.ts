import MethodMeta from "./method-meta.js";

export default class RoutingMeta {
    prefix: string = ''
    methods: {[key: string]: MethodMeta} = {};
    controller: any;
    router: any;

    _instance = null;

    get instance() : any {
        if (!this._instance)
            this._instance = new this.controller;

        return this._instance;
    }
}
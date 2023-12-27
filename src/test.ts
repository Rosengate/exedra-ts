import express from 'express'
import Exedra from "./exedra.js";
import RootController from "./samples/root-controller.js";
import decoTest from "./decorators/deco-test.js";

// @decoTest('/oi')
// class DecoClass {
//     @decoTest('/hey')
//     mymet() {
//         console.log('hello world');
//     }
// }
//
// (new DecoClass()).mymet();

(new Exedra(express())).run(RootController);
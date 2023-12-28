import express from "express";
import Exedra from "./exedra.js";
import RootController from "./samples/root-controller.js";

export default function app() {
    const app = express();

    // app.get('/helo', (req, res) => {
    //     return res.send('heloz');
    // });
    //
    // const r = express.Router({mergeParams: true});
    //
    // r.get('/world', (req, res) => {
    //     return res.send('worldz');
    // });
    //
    // app.use('/', r);

    Exedra.createDefault(app).run(RootController);

    return app;
}
import {default as appFunc} from './app.js';
import {listRoutes} from "./utils/route-list.js";

const app = appFunc();

console.log(listRoutes([], '/', app.router));


// const router = express.Router({mergeParams: true});
//
// router.get('/aka', () => {
// })
//
// const subr = express.Router({mergeParams: true});
//
// subr.get('/subhere', () => {
// })
//
// router.use('/kuku', subr);
// app.use('/', router);
//
// app.get('hey', () => {
// });
//
// app.post('zhey', () => {
// });

// console.log(listRoutes([], '/', app.router));

// console.log(expressListRoutes(app));
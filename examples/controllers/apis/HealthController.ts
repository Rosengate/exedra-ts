import { Controller, Path } from '../../../src';

@Path('/health')
export default class HealthController extends Controller {
  get() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

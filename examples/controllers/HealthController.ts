import { Controller, Path } from '../../src';

@Path('/health')
class HealthController extends Controller {
  get() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

export default HealthController;

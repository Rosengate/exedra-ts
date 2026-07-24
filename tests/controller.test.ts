import 'reflect-metadata';
import { Controller } from '../src/controller';

describe('Controller', () => {
  class TestController extends Controller {
    value = Math.random();
  }

  it('returns singleton instance', () => {
    const a = (TestController as any).instance();
    const b = (TestController as any).instance();
    expect(a).toBe(b);
  });

  it('returns different instances for different classes', () => {
    class OtherController extends Controller {
      value = Math.random();
    }

    const a = (TestController as any).instance();
    const b = (OtherController as any).instance();
    expect(a).not.toBe(b);
  });
});

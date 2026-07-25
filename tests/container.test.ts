import { Container } from '../src/container';

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('service', () => {
    it('registers and resolves a service', () => {
      const db = { host: 'localhost' };
      container.service('db', db);
      expect(container.resolve('db')).toBe(db);
    });

    it('returns the same instance (singleton)', () => {
      container.service('db', { host: 'localhost' });
      expect(container.resolve('db')).toBe(container.resolve('db'));
    });

    it('supports chaining', () => {
      const result = container.service('a', 1).service('b', 2);
      expect(result).toBe(container);
      expect(container.resolve('a')).toBe(1);
      expect(container.resolve('b')).toBe(2);
    });
  });

  describe('factory', () => {
    it('registers and resolves a factory', () => {
      let callCount = 0;
      container.factory('counter', () => ++callCount);
      expect(container.resolve('counter')).toBe(1);
      expect(container.resolve('counter')).toBe(2);
      expect(container.resolve('counter')).toBe(3);
    });

    it('creates new instance each call', () => {
      container.factory('obj', () => ({ x: 1 }));
      const a = container.resolve('obj');
      const b = container.resolve('obj');
      expect(a).toEqual({ x: 1 });
      expect(b).toEqual({ x: 1 });
      expect(a).not.toBe(b);
    });
  });

  describe('func', () => {
    it('registers and resolves a callable', () => {
      const fn = (x: number) => x * 2;
      container.func('double', fn);
      expect(container.resolve('double')).toBe(fn);
    });

    it('can invoke the resolved function', () => {
      container.func('add', (a: number, b: number) => a + b);
      const fn = container.resolve('add');
      expect(fn(2, 3)).toBe(5);
    });
  });

  describe('resolve', () => {
    it('returns undefined for unknown key', () => {
      expect(container.resolve('nonexistent')).toBeUndefined();
    });

    it('services take priority over factories', () => {
      container.service('x', 'from-service');
      container.factory('x', () => 'from-factory');
      expect(container.resolve('x')).toBe('from-service');
    });

    it('factories take priority over callables', () => {
      container.func('y', () => 'from-func');
      container.factory('y', () => 'from-factory');
      expect(container.resolve('y')).toBe('from-factory');
    });
  });

  describe('canResolve', () => {
    it('returns true for registered service', () => {
      container.service('db', {});
      expect(container.canResolve('db')).toBe(true);
    });

    it('returns true for registered factory', () => {
      container.factory('cache', () => ({}));
      expect(container.canResolve('cache')).toBe(true);
    });

    it('returns true for registered func', () => {
      container.func('helper', () => {});
      expect(container.canResolve('helper')).toBe(true);
    });

    it('returns false for unknown key', () => {
      expect(container.canResolve('nope')).toBe(false);
    });
  });

  describe('make', () => {
    it('creates new instance of a class', () => {
      class Foo {
        value = 42;
      }
      const foo = container.make(Foo);
      expect(foo).toBeInstanceOf(Foo);
      expect(foo.value).toBe(42);
    });
  });

  describe('create', () => {
    it('creates new instance with args', () => {
      class Foo {
        constructor(public a: number, public b: number) {}
      }
      const foo = container.create(Foo, [10, 20]);
      expect(foo.a).toBe(10);
      expect(foo.b).toBe(20);
    });

    it('creates instance with no args', () => {
      class Bar {}
      const bar = container.create(Bar);
      expect(bar).toBeInstanceOf(Bar);
    });
  });

  describe('tokenResolve', () => {
    it('resolves with self. prefix', () => {
      container.service('db', { type: 'postgres' });
      expect(container.tokenResolve('self.db')).toEqual({ type: 'postgres' });
    });

    it('resolves with app. prefix', () => {
      container.service('config', { debug: true });
      expect(container.tokenResolve('app.config')).toEqual({ debug: true });
    });

    it('resolves without prefix', () => {
      container.service('logger', { level: 'info' });
      expect(container.tokenResolve('logger')).toEqual({ level: 'info' });
    });
  });
});

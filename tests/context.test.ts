import express from 'express';
import { Context } from '../src/runtime/context';

function mockReq(overrides: Partial<express.Request> = {}): express.Request {
  return {
    params: {},
    query: {},
    headers: {},
    body: {},
    get: (name: string) => undefined,
    ...overrides,
  } as any;
}

function mockRes(): express.Response {
  const res: any = {
    statusCode: 200,
    body: undefined,
    headersSent: false,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    redirect: jest.fn(),
    setHeader: jest.fn(),
  };
  return res;
}

describe('Context', () => {
  describe('param', () => {
    it('returns param by name', () => {
      const ctx = new Context(mockReq(), mockRes(), { id: '123', name: 'alice' });
      expect(ctx.param('id')).toBe('123');
      expect(ctx.param('name')).toBe('alice');
    });

    it('returns undefined for missing param', () => {
      const ctx = new Context(mockReq(), mockRes(), {});
      expect(ctx.param('missing')).toBeUndefined();
    });
  });

  describe('hasParam', () => {
    it('returns true for existing param', () => {
      const ctx = new Context(mockReq(), mockRes(), { id: '1' });
      expect(ctx.hasParam('id')).toBe(true);
    });

    it('returns false for missing param', () => {
      const ctx = new Context(mockReq(), mockRes(), {});
      expect(ctx.hasParam('id')).toBe(false);
    });
  });

  describe('state', () => {
    it('returns state by key', () => {
      const ctx = new Context(mockReq(), mockRes(), {}, { resource: 'user', locale: 'en' });
      expect(ctx.state('resource')).toBe('user');
      expect(ctx.state('locale')).toBe('en');
    });

    it('returns default value for missing state', () => {
      const ctx = new Context(mockReq(), mockRes(), {}, {});
      expect(ctx.state('missing', 'fallback')).toBe('fallback');
    });

    it('returns undefined for missing state without default', () => {
      const ctx = new Context(mockReq(), mockRes(), {}, {});
      expect(ctx.state('missing')).toBeUndefined();
    });
  });

  describe('hasState', () => {
    it('returns true for existing state', () => {
      const ctx = new Context(mockReq(), mockRes(), {}, { key: 'value' });
      expect(ctx.hasState('key')).toBe(true);
    });

    it('returns false for missing state', () => {
      const ctx = new Context(mockReq(), mockRes(), {}, {});
      expect(ctx.hasState('key')).toBe(false);
    });
  });

  describe('hasFlag', () => {
    it('returns true for existing flag', () => {
      const ctx = new Context(mockReq(), mockRes(), {}, {}, ['ajax', 'verbose']);
      expect(ctx.hasFlag('ajax')).toBe(true);
      expect(ctx.hasFlag('verbose')).toBe(true);
    });

    it('returns false for missing flag', () => {
      const ctx = new Context(mockReq(), mockRes(), {}, {}, ['ajax']);
      expect(ctx.hasFlag('verbose')).toBe(false);
    });
  });

  describe('flags', () => {
    it('returns copy of flags array', () => {
      const original = ['ajax', 'verbose'];
      const ctx = new Context(mockReq(), mockRes(), {}, {}, original);
      const result = ctx.flags();
      expect(result).toEqual(['ajax', 'verbose']);
      result.push('extra');
      expect(ctx.flags()).toEqual(['ajax', 'verbose']);
    });

    it('returns empty array when no flags', () => {
      const ctx = new Context(mockReq(), mockRes(), {}, {}, []);
      expect(ctx.flags()).toEqual([]);
    });
  });

  describe('series', () => {
    it('returns series array by key', () => {
      const ctx = new Context(mockReq(), mockRes(), {}, {}, [], { transformer: ['list', 'detail'] });
      expect(ctx.series('transformer')).toEqual(['list', 'detail']);
    });

    it('returns empty array for missing series', () => {
      const ctx = new Context(mockReq(), mockRes());
      expect(ctx.series('missing')).toEqual([]);
    });
  });

  describe('hasSeries', () => {
    it('returns true for existing series', () => {
      const ctx = new Context(mockReq(), mockRes(), {}, {}, [], { steps: ['a'] });
      expect(ctx.hasSeries('steps')).toBe(true);
    });

    it('returns false for missing series', () => {
      const ctx = new Context(mockReq(), mockRes());
      expect(ctx.hasSeries('steps')).toBe(false);
    });
  });

  describe('json', () => {
    it('calls res.json with data', () => {
      const res = mockRes();
      const ctx = new Context(mockReq(), res);
      ctx.json({ hello: 'world' });
      expect(res.json).toHaveBeenCalledWith({ hello: 'world' });
    });
  });

  describe('send', () => {
    it('calls res.send with body', () => {
      const res = mockRes();
      const ctx = new Context(mockReq(), res);
      ctx.send('ok');
      expect(res.send).toHaveBeenCalledWith('ok');
    });

    it('calls res.send without args', () => {
      const res = mockRes();
      const ctx = new Context(mockReq(), res);
      ctx.send();
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('redirect', () => {
    it('calls res.redirect with url', () => {
      const res = mockRes();
      const ctx = new Context(mockReq(), res);
      ctx.redirect('/login');
      expect(res.redirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('status', () => {
    it('calls res.status and chains', () => {
      const res = mockRes();
      const ctx = new Context(mockReq(), res);
      const result = ctx.status(404);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(result).toBe(ctx);
    });
  });

  describe('extends Container', () => {
    it('can register and resolve services', () => {
      const ctx = new Context(mockReq(), mockRes());
      ctx.service('db', { host: 'localhost' });
      expect(ctx.resolve('db')).toEqual({ host: 'localhost' });
    });

    it('can register factories', () => {
      const ctx = new Context(mockReq(), mockRes());
      ctx.factory('obj', () => ({ x: 1 }));
      expect(ctx.resolve('obj')).toEqual({ x: 1 });
    });
  });
});

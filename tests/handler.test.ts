import 'reflect-metadata';
import { Handler } from '../src/handler';
import { kebabCase } from '../src/support/kebab-case';

describe('Handler prefix detection', () => {
  const handler = new Handler();

  describe('parseRestfulMethod', () => {
    it('parses verb-only methods', () => {
      expect(handler.parseRestfulMethod('get')).toEqual(['get', 'GET']);
      expect(handler.parseRestfulMethod('post')).toEqual(['post', 'POST']);
      expect(handler.parseRestfulMethod('put')).toEqual(['put', 'PUT']);
      expect(handler.parseRestfulMethod('delete')).toEqual(['delete', 'DELETE']);
      expect(handler.parseRestfulMethod('patch')).toEqual(['patch', 'PATCH']);
    });

    it('parses verb + suffix methods', () => {
      expect(handler.parseRestfulMethod('getProducts')).toEqual(['get-products', 'GET']);
      expect(handler.parseRestfulMethod('postUser')).toEqual(['post-user', 'POST']);
      expect(handler.parseRestfulMethod('putSettings')).toEqual(['put-settings', 'PUT']);
      expect(handler.parseRestfulMethod('deleteImage')).toEqual(['delete-image', 'DELETE']);
    });

    it('returns null for non-verb prefixed methods', () => {
      expect(handler.parseRestfulMethod('handleError')).toBeNull();
      expect(handler.parseRestfulMethod('listUsers')).toBeNull();
    });
  });

  describe('parseMiddlewareMethod', () => {
    it('detects middleware prefix', () => {
      expect(handler.parseMiddlewareMethod('middlewareAuth')).toBe(true);
      expect(handler.parseMiddlewareMethod('middlewareRateLimit')).toBe(true);
    });

    it('rejects non-middleware methods', () => {
      expect(handler.parseMiddlewareMethod('getProducts')).toBe(false);
      expect(handler.parseMiddlewareMethod('middleware')).toBe(true);
    });
  });

  describe('parseDecorateMethod', () => {
    it('detects decorate prefix', () => {
      expect(handler.parseDecorateMethod('decorateTransform')).toBe(true);
    });

    it('rejects non-decorate methods', () => {
      expect(handler.parseDecorateMethod('getProducts')).toBe(false);
    });
  });

  describe('parseSetupMethod', () => {
    it('detects setup prefix (case insensitive)', () => {
      expect(handler.parseSetupMethod('setupRoutes')).toBe(true);
      expect(handler.parseSetupMethod('SetupRoutes')).toBe(true);
    });
  });

  describe('parseExecuteMethod', () => {
    it('parses execute prefix', () => {
      expect(handler.parseExecuteMethod('executeIndex')).toBe('index');
      expect(handler.parseExecuteMethod('execute')).toBe('execute');
    });

    it('returns null for non-execute methods', () => {
      expect(handler.parseExecuteMethod('getProducts')).toBeNull();
    });
  });

  describe('parseGroupMethod', () => {
    it('parses group prefix', () => {
      expect(handler.parseGroupMethod('groupUsers')).toBe('users');
      expect(handler.parseGroupMethod('groupWeb')).toBe('web');
    });
  });

  describe('parseSubMethod', () => {
    it('parses sub prefix', () => {
      expect(handler.parseSubMethod('subDashboard')).toBe('dashboard');
    });
  });

  describe('parseRouteMethod', () => {
    it('parses route prefix', () => {
      expect(handler.parseRouteMethod('routeSettings')).toBe('settings');
    });
  });
});

import 'reflect-metadata';
import { kebabCase } from '../src/support/kebab-case';

describe('kebabCase', () => {
  it('converts camelCase to kebab-case', () => {
    expect(kebabCase('getProducts')).toBe('get-products');
    expect(kebabCase('postUser')).toBe('post-user');
    expect(kebabCase('helloWorld')).toBe('hello-world');
  });

  it('converts PascalCase to kebab-case', () => {
    expect(kebabCase('Products')).toBe('products');
    expect(kebabCase('HelloWorld')).toBe('hello-world');
  });

  it('handles single word', () => {
    expect(kebabCase('get')).toBe('get');
    expect(kebabCase('index')).toBe('index');
  });

  it('handles underscores', () => {
    expect(kebabCase('get_user_products')).toBe('get-user-products');
  });

  it('handles numbers', () => {
    expect(kebabCase('get2Products')).toBe('get-2-products');
  });
});

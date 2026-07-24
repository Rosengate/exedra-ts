import 'reflect-metadata';
import { Get, Post, Put, Delete, Patch } from '../src/decorators';
import { getMetadata } from '../src/metadata';

describe('Decorators', () => {
  class TestController {
    @Get('/users')
    getUsers() {}

    @Post('/users')
    postUser() {}

    @Put('/users/:id')
    putUser() {}

    @Delete('/users/:id')
    deleteUser() {}

    @Patch('/users/:id')
    patchUser() {}
  }

  it('@Get stores GET method', () => {
    const meta = getMetadata(TestController, 'getUsers');
    expect(meta.method).toBe('GET');
    expect(meta.path).toBe('/users');
  });

  it('@Post stores POST method', () => {
    const meta = getMetadata(TestController, 'postUser');
    expect(meta.method).toBe('POST');
    expect(meta.path).toBe('/users');
  });

  it('@Put stores PUT method', () => {
    const meta = getMetadata(TestController, 'putUser');
    expect(meta.method).toBe('PUT');
  });

  it('@Delete stores DELETE method', () => {
    const meta = getMetadata(TestController, 'deleteUser');
    expect(meta.method).toBe('DELETE');
  });

  it('@Patch stores PATCH method', () => {
    const meta = getMetadata(TestController, 'patchUser');
    expect(meta.method).toBe('PATCH');
  });
});

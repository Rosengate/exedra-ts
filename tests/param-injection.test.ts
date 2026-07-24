import 'reflect-metadata';
import { getParamNames } from '../src/support/param-names';
import { Param, Body, Query, Header, Req, Res, Next } from '../src/attributes/bind';
import { getParamBindings } from '../src/attributes/param';

describe('getParamNames', () => {
  it('extracts named params from function', () => {
    function handler(id: string, name: string) {}
    expect(getParamNames(handler)).toEqual(['id', 'name']);
  });

  it('extracts params from arrow functions', () => {
    const fn = (req: any, res: any, next: any) => {};
    expect(getParamNames(fn)).toEqual(['req', 'res', 'next']);
  });

  it('extracts params from class methods', () => {
    class Test {
      getUser(id: string, format: string) {}
    }
    expect(getParamNames(Test.prototype.getUser)).toEqual(['id', 'format']);
  });

  it('returns empty array for no-arg functions', () => {
    function noArgs() {}
    expect(getParamNames(noArgs)).toEqual([]);
  });

  it('handles destructured params (returns raw names)', () => {
    const fn = new Function('{ a, b }', 'return a + b');
    const names = getParamNames(fn);
    expect(names.length).toBeGreaterThan(0);
  });
});

describe('Parameter decorators', () => {
  class TestController {
    withParam(@Param('id') id: string) {}
    withBody(@Body('name') name: string) {}
    withQuery(@Query('limit') limit: number) {}
    withHeader(@Header('authorization') token: string) {}
    withReq(@Req() req: any) {}
    withRes(@Res() res: any) {}
    withNext(@Next() next: any) {}
    mixed(
      @Param('userId') userId: string,
      @Body('name') name: string,
      @Query('format') format: string,
    ) {}
  }

  const proto = TestController.prototype;

  it('@Param stores param binding', () => {
    const bindings = getParamBindings(proto, 'withParam');
    expect(bindings[0]).toEqual({ type: 'param', key: 'id' });
  });

  it('@Body stores body binding', () => {
    const bindings = getParamBindings(proto, 'withBody');
    expect(bindings[0]).toEqual({ type: 'body', key: 'name' });
  });

  it('@Query stores query binding', () => {
    const bindings = getParamBindings(proto, 'withQuery');
    expect(bindings[0]).toEqual({ type: 'query', key: 'limit' });
  });

  it('@Header stores header binding', () => {
    const bindings = getParamBindings(proto, 'withHeader');
    expect(bindings[0]).toEqual({ type: 'header', key: 'authorization' });
  });

  it('@Req stores req binding', () => {
    const bindings = getParamBindings(proto, 'withReq');
    expect(bindings[0]).toEqual({ type: 'req' });
  });

  it('@Res stores res binding', () => {
    const bindings = getParamBindings(proto, 'withRes');
    expect(bindings[0]).toEqual({ type: 'res' });
  });

  it('@Next stores next binding', () => {
    const bindings = getParamBindings(proto, 'withNext');
    expect(bindings[0]).toEqual({ type: 'next' });
  });

  it('handles multiple param decorators on same method', () => {
    const bindings = getParamBindings(proto, 'mixed');
    expect(bindings[0]).toEqual({ type: 'param', key: 'userId' });
    expect(bindings[1]).toEqual({ type: 'body', key: 'name' });
    expect(bindings[2]).toEqual({ type: 'query', key: 'format' });
  });

  it('returns empty bindings for undecorated methods', () => {
    class Plain {
      doSomething() {}
    }
    const bindings = getParamBindings(Plain.prototype, 'doSomething');
    expect(Object.keys(bindings)).toHaveLength(0);
  });
});

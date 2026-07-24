import 'reflect-metadata';
import { getParamNames } from '../src/support/param-names';
import { Param, Body, Query, Header, Req, Res, Next } from '../src/attributes/bind';
import { getParamBindings } from '../src/attributes/param';
import { State } from '../src/attributes/state';
import { Flag } from '../src/attributes/flag';
import { Series } from '../src/attributes/series';
import { getMetadata } from '../src/metadata';

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

describe('State/Flag/Series as parameter decorators', () => {
  class TestController {
    readState(@State('auth') auth: any, @State('role') role: any) {}
    readFlag(@Flag('admin') isAdmin: boolean, @Flag('ajax') isAjax: boolean) {}
    readSeries(@Series('transformers') transformers: any[]) {}
    mixed(@Param('id') id: string, @State('resource') resource: any) {}
  }

  const proto = TestController.prototype;

  it('@State as parameter decorator stores state binding', () => {
    const bindings = getParamBindings(proto, 'readState');
    expect(bindings[0]).toEqual({ type: 'state', key: 'auth' });
    expect(bindings[1]).toEqual({ type: 'state', key: 'role' });
  });

  it('@Flag as parameter decorator stores flag binding', () => {
    const bindings = getParamBindings(proto, 'readFlag');
    expect(bindings[0]).toEqual({ type: 'flag', key: 'admin' });
    expect(bindings[1]).toEqual({ type: 'flag', key: 'ajax' });
  });

  it('@Series as parameter decorator stores series binding', () => {
    const bindings = getParamBindings(proto, 'readSeries');
    expect(bindings[0]).toEqual({ type: 'series', key: 'transformers' });
  });

  it('mixes State/Flag/Series with other decorators', () => {
    const bindings = getParamBindings(proto, 'mixed');
    expect(bindings[0]).toEqual({ type: 'param', key: 'id' });
    expect(bindings[1]).toEqual({ type: 'state', key: 'resource' });
  });
});

describe('State/Flag/Series as class/method decorators', () => {
  @State('resource', 'user')
  @Flag('api')
  @Series('transformer', 'list')
  class DecoratedController {
    @State('need_auth', true)
    @Flag('ajax')
    @Series('transformer', 'detail')
    getIndex() {}
  }

  it('@State stores class-level state', () => {
    const meta = getMetadata(DecoratedController);
    expect(meta.states).toEqual({ resource: 'user' });
  });

  it('@State stores method-level state', () => {
    const meta = getMetadata(DecoratedController, 'getIndex');
    expect(meta.states).toEqual({ need_auth: true });
  });

  it('@Flag stores class-level flag', () => {
    const meta = getMetadata(DecoratedController);
    expect(meta.flags).toContain('api');
  });

  it('@Flag stores method-level flag', () => {
    const meta = getMetadata(DecoratedController, 'getIndex');
    expect(meta.flags).toContain('ajax');
  });

  it('@Series stores class-level series', () => {
    const meta = getMetadata(DecoratedController);
    expect(meta.serieses).toEqual({ transformer: 'list' });
  });

  it('@Series stores method-level series', () => {
    const meta = getMetadata(DecoratedController, 'getIndex');
    expect(meta.serieses).toEqual({ transformer: 'detail' });
  });
});

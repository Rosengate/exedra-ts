import 'reflect-metadata';
import { getMetadata } from '../src/metadata';
import {
  Get,
  Path,
  Name,
  Method,
  Middleware,
  Decorator,
  Requestable,
  FailRoute,
  Tag,
  Config,
  State,
  Series,
  Flag,
  Validation,
  Include,
  Transformer,
} from '../src';
import { getIncludeBindings } from '../src/attributes/include';

function getMethodMeta(target: any, method: string) {
  return getMetadata(target, method);
}

function getClassMeta(target: any) {
  return getMetadata(target);
}

describe('Attribute decorators — metadata storage', () => {
  describe('@Path', () => {
    @Path('/test-class')
    class TestClass {
      @Path('/test-method')
      testMethod() {}
    }

    it('stores path on class', () => {
      expect(getClassMeta(TestClass).path).toBe('/test-class');
    });

    it('stores path on method', () => {
      expect(getMethodMeta(TestClass, 'testMethod').path).toBe('/test-method');
    });
  });

  describe('@Name', () => {
    @Name('class.name')
    class TestClass {
      @Name('method.name')
      testMethod() {}
    }

    it('stores name on class', () => {
      expect(getClassMeta(TestClass).name).toBe('class.name');
    });

    it('stores name on method', () => {
      expect(getMethodMeta(TestClass, 'testMethod').name).toBe('method.name');
    });
  });

  describe('@Method', () => {
    @Method('POST')
    class TestClass {
      @Method('GET')
      getMethod() {}

      @Method(['PUT', 'PATCH'])
      multiMethod() {}
    }

    it('stores method on class', () => {
      expect(getClassMeta(TestClass).method).toBe('POST');
    });

    it('stores method on method', () => {
      expect(getMethodMeta(TestClass, 'getMethod').method).toBe('GET');
    });

    it('joins array methods with pipe', () => {
      expect(getMethodMeta(TestClass, 'multiMethod').method).toBe('PUT|PATCH');
    });
  });

  describe('@Middleware', () => {
    class TestClass {
      @Middleware('auth')
      methodA() {}

      @Middleware('rate-limit')
      @Middleware('cors')
      methodB() {}
    }

    it('stores middleware on method as array', () => {
      const meta = getMethodMeta(TestClass, 'methodA');
      expect(meta.middleware).toEqual(['auth']);
    });

    it('appends multiple middleware (applied bottom-up)', () => {
      const meta = getMethodMeta(TestClass, 'methodB');
      expect(meta.middleware).toEqual(['cors', 'rate-limit']);
    });
  });

  describe('@Decorator', () => {
    class TestClass {
      @Decorator('transform')
      methodA() {}

      @Decorator('serialize')
      @Decorator('cache')
      methodB() {}
    }

    it('stores decorator on method as array', () => {
      const meta = getMethodMeta(TestClass, 'methodA');
      expect(meta.decorator).toEqual(['transform']);
    });

    it('appends multiple decorators (applied bottom-up)', () => {
      const meta = getMethodMeta(TestClass, 'methodB');
      expect(meta.decorator).toEqual(['cache', 'serialize']);
    });
  });

  describe('@Requestable', () => {
    class TestClass {
      @Requestable(false)
      hiddenMethod() {}

      @Requestable()
      visibleMethod() {}
    }

    it('stores requestable false', () => {
      expect(getMethodMeta(TestClass, 'hiddenMethod').requestable).toBe(false);
    });

    it('stores requestable true (default)', () => {
      expect(getMethodMeta(TestClass, 'visibleMethod').requestable).toBe(true);
    });
  });

  describe('@FailRoute', () => {
    class TestClass {
      @FailRoute
      notFound() {}
    }

    it('stores asFailRoute on method', () => {
      expect(getMethodMeta(TestClass, 'notFound').asFailRoute).toBe(true);
    });
  });

  describe('@Tag', () => {
    @Tag('api')
    class TestClass {
      @Tag('admin')
      testMethod() {}
    }

    it('stores tag on class', () => {
      expect(getClassMeta(TestClass).tag).toBe('api');
    });

    it('stores tag on method', () => {
      expect(getMethodMeta(TestClass, 'testMethod').tag).toBe('admin');
    });
  });

  describe('@Config', () => {
    @Config('theme', 'dark')
    class TestClass {
      @Config('locale', 'en')
      testMethod() {}
    }

    it('stores config on class', () => {
      expect(getClassMeta(TestClass).config).toEqual({ theme: 'dark' });
    });

    it('stores config on method', () => {
      expect(getMethodMeta(TestClass, 'testMethod').config).toEqual({ locale: 'en' });
    });
  });

  describe('@State', () => {
    @State('resource', 'user')
    class TestClass {
      @State('need_auth', true)
      testMethod() {}
    }

    it('stores state on class', () => {
      expect(getClassMeta(TestClass).states).toEqual({ resource: 'user' });
    });

    it('stores state on method', () => {
      expect(getMethodMeta(TestClass, 'testMethod').states).toEqual({ need_auth: true });
    });
  });

  describe('@Flag', () => {
    @Flag('ajax')
    class TestClass {
      @Flag('verbose')
      testMethod() {}
    }

    it('stores flag on class as array', () => {
      expect(getClassMeta(TestClass).flags).toEqual(['ajax']);
    });

    it('stores flag on method as array', () => {
      expect(getMethodMeta(TestClass, 'testMethod').flags).toEqual(['verbose']);
    });
  });

  describe('@Series', () => {
    @Series('transformer', 'list')
    class TestClass {
      @Series('pipeline', ['step1', 'step2'])
      testMethod() {}
    }

    it('stores series on class', () => {
      expect(getClassMeta(TestClass).serieses).toEqual({ transformer: 'list' });
    });

    it('stores series on method', () => {
      expect(getMethodMeta(TestClass, 'testMethod').serieses).toEqual({ pipeline: ['step1', 'step2'] });
    });
  });

  describe('@Validation', () => {
    @Validation({ name: 'required' })
    class TestClass {
      @Validation({ title: 'required', body: 'required' })
      testMethod() {}
    }

    it('stores validation as exedra:validation state on class', () => {
      expect(getClassMeta(TestClass).states).toEqual({ 'exedra:validation': { name: 'required' } });
    });

    it('stores validation as exedra:validation state on method', () => {
      expect(getMethodMeta(TestClass, 'testMethod').states).toEqual({
        'exedra:validation': { title: 'required', body: 'required' },
      });
    });
  });

  describe('@Transformer', () => {
    class MyTransformer {
      transform(data: any) { return data; }
    }

    @Transformer(MyTransformer)
    class TestClass {
      @Transformer(MyTransformer)
      testMethod() {}
    }

    it('stores transformer as exedra:transformer state on class', () => {
      expect(getClassMeta(TestClass).states).toEqual({ 'exedra:transformer': MyTransformer });
    });

    it('stores transformer as exedra:transformer state on method', () => {
      expect(getMethodMeta(TestClass, 'testMethod').states).toEqual({ 'exedra:transformer': MyTransformer });
    });
  });

  describe('@Include', () => {
    class UserTransformer {
      transform(data: any) { return data; }

      @Include('posts')
      includePosts(user: any) { return []; }

      @Include('comments')
      includeComments(user: any) { return []; }
    }

    it('stores include bindings on target', () => {
      const bindings = getIncludeBindings(new UserTransformer());
      expect(bindings.get('posts')).toBe('includePosts');
      expect(bindings.get('comments')).toBe('includeComments');
    });
  });

  describe('Multiple decorators on same method', () => {
    class TestClass {
      @Get('/items')
      @Name('items.index')
      @Tag('api')
      @State('resource', 'items')
      @Flag('cache')
      @Series('transformer', 'list')
      @Config('page_size', 20)
      @Requestable(true)
      listItems() {}
    }

    it('merges all metadata correctly', () => {
      const meta = getMethodMeta(TestClass, 'listItems');
      expect(meta.path).toBe('/items');
      expect(meta.method).toBe('GET');
      expect(meta.name).toBe('items.index');
      expect(meta.tag).toBe('api');
      expect(meta.states).toEqual({ resource: 'items' });
      expect(meta.flags).toEqual(['cache']);
      expect(meta.serieses).toEqual({ transformer: 'list' });
      expect(meta.config).toEqual({ page_size: 20 });
      expect(meta.requestable).toBe(true);
    });
  });
});

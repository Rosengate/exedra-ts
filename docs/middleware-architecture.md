# Middleware Architecture

How exedra-ts, exedra-php, and NestJS handle middleware — and why they differ.

## The Core Problem

Middleware lets you run code before, during, and after a route handler. The question is: can middleware **wrap** downstream code (onion model), or only **precede** it (flat model)?

```
// Onion model (before + after)
middleware  →  handler  ←  middleware
                  ↑
         after handler runs

// Flat model (before only)
middleware  →  handler
              (middleware done)
```

PHP gets onion middleware for free. Express doesn't. NestJS avoids the question entirely.

---

## exedra-php — Synchronous Call Stack

PHP is synchronous. `call_user_func($next)` blocks until the downstream middleware and handler complete, then returns the result. This makes onion middleware trivial.

### CallStack (116 lines total)

```php
// Exedra/Routing/CallStack.php
class CallStack {
    protected $callables;

    public function getNextCaller() {
        $callStack = $this;
        $next = function () use ($callStack, &$next) {
            $args = func_get_args();
            $args[] = $next;  // pass $next to the callable
            return call_user_func_array(array($callStack, 'next'), $args);
        };
        return $next;
    }

    public function next() {
        // Advance pointer and call the next callable
        return call_user_func_array(next($this->callables), func_get_args());
    }
}
```

### Middleware

```php
function logMiddleware($request, $next) {
    echo "before\n";
    $response = $next($request);  // blocks, waits for handler
    echo "after\n";
    return $response;
}
```

### Why it's simple

| Aspect | How it works |
|---|---|
| Calling next | `$next()` — synchronous, blocks until done |
| Return values | `$response = $next()` — direct, no promises |
| Error handling | PHP exceptions — `try/catch` works naturally |
| Response modification | `return $response` — chain returns the result |

No promises, no microtask ordering, no async complications. The entire `CallStack` class is 60 lines.

---

## exedra-ts — Promise-Based Onion Chain

Express middleware is callback-based: `next()` is a void function that advances to the next handler. It doesn't return a value, it doesn't wait for downstream completion, and it can't catch errors from downstream.

exedra-ts re-implements the PHP synchronous call stack on top of Express's callback model using Promises. This is where the complexity comes from.

### The challenge

Express's `next()`:
```typescript
// Express's NextFunction — void, fire-and-forget
type NextFunction = (err?: any) => void;
```

PHP's `$next()`:
```php
// PHP — returns the result, blocks until done
$response = $next($request);
```

To get PHP's behavior in Express, we need:
1. `next()` to return a **Promise** instead of void
2. The Promise to **resolve with the handler's return value**
3. Errors to propagate through the Promise chain

### runMiddlewareChain (~55 lines)

```typescript
function runMiddlewareChain(handlers, req, res): Promise<any> {
  let index = 0;

  function callNext(): Promise<any> {
    if (index >= handlers.length) return Promise.resolve(req._exedra_result);
    const handler = handlers[index++];
    let nextCalled = false;
    let nextPromise: Promise<any> | null = null;

    return new Promise<any>((resolve, reject) => {
      // next() now returns a Promise instead of void
      const nextFn = (err?: any): Promise<any> => {
        if (nextCalled) return Promise.resolve(req._exedra_result);
        nextCalled = true;
        nextPromise = err ? Promise.reject(err) : callNext();
        return nextPromise;
      };

      const result = handler(req, res, nextFn);

      if (result is async) {
        result.then((handlerResult) => {
          // Handler may have modified the response via return value
          if (handlerResult !== undefined) req._exedra_result = handlerResult;
          // Wait for downstream chain, then resolve
          if (nextPromise) nextPromise.then(() => resolve(req._exedra_result));
          else resolve(req._exedra_result);
        }, reject);
      } else {
        // Sync — chain continues or resolves immediately
        if (nextPromise) nextPromise.then(resolve, reject);
        else if (!nextCalled) nextFn().then(resolve, reject);
        else resolve(req._exedra_result);
      }
    });
  }

  return callNext();
}
```

### buildHandlers wrapper

`buildHandlers` builds an array of Express handlers (context creator, middleware, exec handler), then wraps them in a single Express handler via the chain:

```typescript
// Response sender runs AFTER the onion chain completes
// so middleware can modify the result before it's sent
runMiddlewareChain(allHandlers, req, res)
  .then(() => {
    if (responseSender && !res.headersSent) {
      responseSender(req, res, next);
    }
  })
  .catch((err) => {
    if (!res.headersSent) next(err);
  });
```

### Why it's complex

| Concern | exedra-php | exedra-ts |
|---|---|---|
| Calling next | `$next()` — blocks | `nextFn()` — returns Promise |
| Return values | Automatic | `req._exedra_result` workaround |
| Error handling | `try/catch` | Promise rejection chains |
| Async middleware | N/A (PHP is sync) | `result.then(...)` with 5 branch paths |
| Double-call prevention | N/A | `nextCalled` flag |
| Response timing | After chain returns | Response sender runs after chain resolves |

The 5 branch paths in `callNext` handle every combination of:
- Sync vs async handler
- Handler called next vs didn't
- nextPromise exists vs doesn't

### `req._exedra_result` workaround

Express handlers don't return values to middleware. exedra-ts stores the handler's return value on `req._exedra_result` so middleware can read it after `await next()`:

```typescript
// Handler stores result
const result = await exec(...args);
req._exedra_result = result;
next();

// Middleware reads it
async middlewareProfile(req, res, next) {
  const result = await next();  // reads req._exedra_result
  return { data: result };      // overwrites req._exedra_result
}
```

This property doesn't exist in the PHP version because PHP functions return values directly.

---

## NestJS — Split Abstractions

NestJS recognized that Express's middleware model doesn't support onion-style wrapping. Instead of trying to force it, NestJS built **separate abstractions** for each concern.

### NestJS Middleware (flat, Express-based)

```typescript
@Injectable()
class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log('before');
    next();  // flat — no await, no return
  }
}
```

NestJS middleware is Express middleware with a class wrapper. It runs **before** the handler only.

### NestJS Interceptors (onion model)

```typescript
@Injectable()
class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Before handler
    console.log('before');

    return next.handle().pipe(
      // After handler
      map(data => ({ data }))
    );
  }
}
```

Interceptors use RxJS Observables. `next.handle()` returns an Observable of the handler's response. You `pipe` operators to transform it. This gives you the onion model without touching Express middleware.

### NestJS Guards, Pipes, Exception Filters

```typescript
// Guard — before handler, can reject
@Injectable()
class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return !!request.headers.authorization;
  }
}

// Pipe — before handler, transforms/validates input
@Injectable()
class ValidationPipe implements PipeTransform {
  transform(value: any) {
    return plainToInstance(SomeDto, value);
  }
}

// Exception filter — catch handler errors
@Catch(HttpException)
class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    response.status(exception.getStatus()).json({ error: exception.message });
  }
}
```

### Why it's clean

NestJS doesn't try to make Express middleware do everything. Each concern gets its own abstraction:

| Concern | NestJS abstraction | Runs when |
|---|---|---|
| Preprocessing | Middleware | Before handler (flat) |
| Authorization | Guards | Before handler (can reject) |
| Input validation | Pipes | Before handler (transform) |
| Response wrapping | Interceptors | Before + after handler (onion) |
| Error handling | Exception filters | On handler error |

---

## Comparison

| Aspect | exedra-php | exedra-ts | NestJS |
|---|---|---|---|
| **Middleware model** | Synchronous call stack | Promise-based onion chain | Express flat + separate interceptors |
| **Before handler** | `middleware($req, $next)` | `middleware*` / `@Middleware(fn)` | Middleware + Guards + Pipes |
| **After handler** | Automatic (onion return) | `await next()` + return/res.json | Interceptors (Observable pipe) |
| **Error catching** | `try/catch` (sync) | `try { await next() } catch` | Exception Filters |
| **Response modification** | `return $response` | `res.json()` or overwrite `req._exedra_result` | Interceptors |
| **Lines of code** | ~60 (CallStack) | ~85 (runMiddlewareChain + wrapper) | 4 separate abstractions |
| **Learning curve** | Low (one concept) | Medium (onion + Express integration) | High (4 concepts) |
| **Express compatibility** | N/A (PSR-7) | Wraps Express (adds onion on top) | Wraps Express (separate abstractions) |
| **Async support** | N/A (PHP is sync) | Full (Promises, async/await) | Full (Observables, async/await) |

### Trade-offs

**exedra-php**: Simplest implementation. One concept — everything goes through the call stack. But PHP's synchronous model doesn't translate to Node.js.

**exedra-ts**: Most powerful — full onion model with one unified concept. But the implementation is complex because it's bolting synchronous behavior (PHP's `$next()`) onto Express's async callback model. The `req._exedra_result` workaround exists because Express handlers don't return values through the middleware chain.

**NestJS**: Cleanest separation of concerns. Each feature gets its own abstraction with clear boundaries. But you need to learn 4 concepts (middleware, guards, interceptors, filters) instead of 1. And Observables add RxJS as a dependency.

### Why exedra-ts is more complex than exedra-php

The complexity isn't a design choice — it's a language constraint. PHP functions return values synchronously. Express middleware doesn't. The `runMiddlewareChain` function exists to bridge this gap by implementing PHP's call stack semantics on top of Express's callback model using Promises.

If Express supported `const result = next()` natively (returning the downstream result), `runMiddlewareChain` wouldn't need to exist. The middleware would just call `next()` and use the return value, exactly like the PHP version.

### Current exedra-ts limitations

1. **`req._exedra_result`**: A workaround for Express not returning handler values through middleware. PHP doesn't need this.

2. **Sync middleware can't modify responses**: Sync middleware that calls `next()` without `return` or `await` can't intercept the response after the handler runs. Only async middleware with `await next()` can.

3. **5 branching paths**: The `callNext` function has 5 branches to handle every combination of sync/async × called-next/didn't-call-next. PHP has one path.

4. **Response sender outside chain**: To let middleware modify the response before it's sent, the response sender had to be pulled out of the chain and run after it completes. This adds complexity to `buildHandlers`.

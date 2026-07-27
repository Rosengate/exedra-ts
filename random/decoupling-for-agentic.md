# Decoupling exedra-ts for Agentic & Graph-Based Development

RFC / design exploration — not a commitment.

## TL;DR

exedra-ts's core abstractions (decorator-driven node definition, scoped DI container, metadata propagation, middleware pipeline) map well onto graph and agentic execution models. But the Express coupling is deep — it runs through `Context`, `Group.buildHandlers`, `Finding`, `CallStack`, and every middleware signature. Decoupling means extracting a transport-agnostic core while keeping Express as one adapter.

---

## What Maps Well

### Controller → Graph Node

A controller is already a named processing unit with:

- **Inputs**: params, body, query, injected services
- **Outputs**: return value (auto-sent as JSON today)
- **Metadata**: path, name, tag, states, flags, serieses
- **Middleware**: pre/post processing (onion model)
- **Sub-controllers**: child nodes via `group*` methods

A graph node is the same thing minus the HTTP framing.

```
Current:    Controller method → HTTP response
Graph:      Node method → updated state → next node
```

### Group/Route Tree → Directed Graph

The `group*` subrouting pattern already builds a tree:

```
RootController
├── groupApis()    → ApisController
│   ├── groupUsers() → UsersController
│   └── groupPosts() → PostController
└── groupWeb()     → WebController
```

A graph is a tree with back-edges and conditional transitions. The existing `Group` → `Route` → `Finding` → `CallStack` pipeline is the execution chain for one path through this tree.

### Metadata System → Graph State Schema

`@State`, `@Flag`, `@Series` are already per-node metadata that:

- Propagate from parent to child (class → method)
- Override at finer granularity
- Are accessible at runtime via Context
- Are introspectable via `Reflect.getMetadata`

In a graph, these become **node configuration** and **shared state declarations**.

### DI Container → Scoped Service Registry

`Container` provides three registries (services, factories, callables) with parent-chain resolution. `Context` extends `Container` and adds per-request scoping. This maps directly to:

- **Graph-level services**: registered on the root Container (shared across all nodes)
- **Run-level services**: registered on a per-execution Context (isolated per graph run)
- **Node-level services**: registered in middleware before the node executes

### CallStack → Execution Pipeline

`CallStack` (`src/routing/callstack.ts`) is an ordered pipeline of `Call` objects, each wrapping a function with properties. The pointer-based execution (`getNextCallable` → `call.invoke(...)`) is a simple state machine. This generalizes to:

- **Sequential edges**: A → B → C (current CallStack behavior)
- **Conditional edges**: A → (condition ? B : C) (need branching)
- **Parallel edges**: A → [B, C, D] (need fan-out)
- **Looping edges**: A → B → A (need cycle detection or max-depth)

---

## What's Coupled to Express

Every coupling point below would need abstraction to support non-HTTP transports.

### 1. Context stores Express req/res

```typescript
// src/runtime/context.ts
export class Context extends Container {
  req: express.Request; // ← Express
  res: express.Response; // ← Express

  redirect(url: string) {
    this.res.redirect(url);
  } // ← Express
  json(data: any) {
    this.res.json(data);
  } // ← Express
  send(body?: any) {
    this.res.send(body);
  } // ← Express
  status(code: number) {
    this.res.status(code);
  } // ← Express
}
```

These response methods are HTTP-specific. A graph node doesn't "respond" — it **returns a result** that flows to the next node.

### 2. Middleware signature is Express-shaped

```typescript
// Every middleware* method receives:
middlewareAuth(
  req: express.Request,     // ← Express
  res: express.Response,    // ← Express
  next: express.NextFunction // ← Express
) { ... }
```

`buildHandlers` in `src/routing/group.ts:343-346` passes these through:

```typescript
handlers.push((req: any, res: any, next: any) => {
  const ctx = (req as any)._exedra_context;
  return fn(req, res, next, ctx); // ← Express args forwarded
});
```

### 3. Handler parameter resolution assumes Express

`resolveFromDecorators` in `group.ts` maps bindings to `req.params`, `req.query`, `req.body`, `req.headers`. These are Express-specific request shapes.

### 4. Route matching uses Express Router

`Group.registerOnRouter` creates `express.Router()` instances. `Finding` is populated by Express's route matching. In a graph, "matching" is replaced by **edge selection** (which node runs next).

### 5. Finding/CallStack assume request lifecycle

`Finding` (`src/routing/finding.ts`) builds a `CallStack` from middleware + decorators + execute handler. The lifecycle is: match route → build stack → execute stack → send response. A graph execution is: select edge → execute node → update state → select next edge.

---

## `context.goto(routeName)` — Dynamic Graph Traversal

The current `context.redirect(url)` (`src/runtime/context.ts:115`) does `this.res.redirect(url)` — an HTTP 302. But the route name system already exists: `Group.findRoute(name)` walks the tree by name, and `listRoutes()` produces dotted `fullName` values like `admin.settings.get-settings`. Nothing currently lets you **dispatch to a route by name from within a handler**.

### Three Dispatch Modes

| Mode                | Signature                   | Semantics                                                                            | HTTP use case                 | Agentic use case                                    |
| ------------------- | --------------------------- | ------------------------------------------------------------------------------------ | ----------------------------- | --------------------------------------------------- |
| **Hard redirect**   | `ctx.redirect(url)`         | HTTP 302 → client makes new request, new Context                                     | Redirect to login page        | N/A                                                 |
| **Soft dispatch**   | `ctx.goto(routeName)`       | Server-side, same execution, carries state. Target's CallStack replaces current one. | Server-side internal redirect | Node decides at runtime to jump to another node     |
| **Subroutine call** | `await ctx.call(routeName)` | Like goto, but caller resumes after callee finishes. Push/pop CallStack.             | N/A                           | Agent calls a tool, gets result, continues thinking |

### Why Dynamic Edges Matter

LLM agents don't know their execution path at build time. A classifier node examines input and _then_ decides which tool to call. A router inspects context and _then_ decides the next step.

In LangGraph, this requires an external routing function:

```python
def routing_fn(state):
    if state["intent"] == "search":
        return "search_node"
    return "fallback_node"

graph.add_conditional_edges("classify", routing_fn)
```

With `context.goto()`, the routing logic lives _in_ the handler:

```typescript
@Get('/classify')
async classify(@Body('input') input: string, @Ctx() ctx: Context) {
  const intent = await llm.classify(input);
  ctx.state('intent', intent);

  if (intent === 'search') return ctx.goto('search');
  if (intent === 'escalate') return ctx.goto('escalate');
  return ctx.goto('fallback');
}
```

The handler **is** the routing function. No external routing table, no indirection. Combined with static `@Edge` declarations for the common case, you get full graph expressiveness.

### Code Sketch: `goto`

```typescript
// In Context (transport-agnostic version)
class Context extends Container {
  private rootGroup_: Group | null; // set by adapter at creation time

  async goto(routeName: string): Promise<any> {
    if (!this.rootGroup_) throw new Error('No root group — goto requires graph context');

    // Circular dispatch protection
    this.visitedNodes_.push(routeName);
    if (this.visitedNodes_.length > this.maxDepth_) {
      throw new Error(
        `Max graph depth exceeded (${this.maxDepth_}). Visited: ${this.visitedNodes_.join(' → ')}`,
      );
    }

    // Resolve the target route by name
    const route = this.rootGroup_.findRoute(routeName);
    if (!route) throw new Error(`Route "${routeName}" not found`);

    // Build and execute the target's CallStack
    const finding = new Finding(route, this.params_);
    const newStack = finding.getCallStack();
    const callable = newStack.getNextCallable();
    return callable(this.req, this.res);
  }

  async call(routeName: string): Promise<any> {
    // Save current execution state
    const savedStack = this.callStack_;
    const savedPointer = this.callPointer;

    // Execute target
    const result = await this.goto(routeName);

    // Restore caller's execution state
    this.callStack_ = savedStack;
    this.callPointer = savedPointer;

    return result;
  }
}
```

### Code Sketch: `call` (Subroutine Semantics)

```typescript
class Context extends Container {
  private callStack_: CallStack;
  private callPointer = 0;

  // Call stack of call stacks — enables subroutine semantics
  private stackFrames_: Array<{ stack: CallStack; pointer: number }> = [];

  async call(routeName: string): Promise<any> {
    // Push current frame
    this.stackFrames_.push({
      stack: this.callStack_,
      pointer: this.callPointer,
    });

    // Build and run target
    const route = this.rootGroup_!.findRoute(routeName);
    if (!route) throw new Error(`Route "${routeName}" not found`);

    const finding = new Finding(route, this.params_);
    this.callStack_ = finding.getCallStack();
    this.callPointer = 0;

    const result = await this.runCurrentStack();

    // Pop frame, restore caller
    const frame = this.stackFrames_.pop()!;
    this.callStack_ = frame.stack;
    this.callPointer = frame.pointer;

    return result;
  }
}
```

### Context Scoping

Two options for how `goto` handles state:

| Strategy          | Behavior                                                                                      | When to use                                                           |
| ----------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Same Context**  | State mutations in the target are visible to the caller                                       | Simple linear flows where you want shared state                       |
| **Child Context** | Fork a new Context from the current one. Target gets a copy. Caller keeps its original state. | Tool calls where you might reject the result and try a different tool |

Child contexts mirror how `Context.fromFinding` already works — create a new Context from the target route's properties, with the current Context as parent for DI resolution:

```typescript
async goto(routeName: string, opts: { isolate?: boolean } = {}): Promise<any> {
  const route = this.rootGroup_!.findRoute(routeName);
  if (!route) throw new Error(`Route "${routeName}" not found`);

  let ctx: Context = this;
  if (opts.isolate) {
    const fullProps = route.fullProperties();
    ctx = new Context(
      this.req, this.res,
      this.params_,
      fullProps.states || {},
      fullProps.flags || [],
      fullProps.serieses || {},
      undefined,
      this,  // parent container — DI resolution falls through to caller
    );
  }

  const finding = new Finding(route, ctx.params_);
  const stack = finding.getCallStack();
  const callable = stack.getNextCallable();
  return callable(ctx.req, ctx.res);
}
```

### Name Resolution

`Group.findRoute(name)` (`src/routing/group.ts:175`) searches by **local name** only (e.g., `get-user`). For `goto` to work across the entire graph, you need root-level resolution by **full dotted name**:

```typescript
// Added to Group
findRouteByFullName(fullName: string): Route | null {
  const results = this.listRoutes();
  const match = results.find(r => r.fullName === fullName);
  if (!match) return null;
  // Re-resolve the Route object from the tree
  return this.findRoute(match.name);
}
```

This enables: `ctx.goto('admin.settings.get-settings')` — cross-controller dispatch.

### Circular Dispatch Protection

Prevent infinite loops when node A `goto`s B and B `goto`s A:

```typescript
class Context extends Container {
  private visitedNodes_: string[] = [];
  private maxDepth_ = 50;

  async goto(routeName: string): Promise<any> {
    if (this.visitedNodes_.includes(routeName)) {
      throw new Error(
        `Circular dispatch: "${routeName}" already visited. ` +
          `Path: ${[...this.visitedNodes_, routeName].join(' → ')}`,
      );
    }
    if (this.visitedNodes_.length >= this.maxDepth_) {
      throw new Error(`Max graph depth (${this.maxDepth_}) exceeded`);
    }
    this.visitedNodes_.push(routeName);
    // ... execute target
  }
}
```

### Middleware Integration

Every `goto`/`call` is interceptable. The logging middleware can build an execution trace:

```typescript
middlewareTrace(req: any, res: any, next: any, ctx: Context) {
  const originalGoto = ctx.goto.bind(ctx);
  ctx.goto = async (routeName: string) => {
    console.log(`[trace] ${ctx.currentNode} → ${routeName}`);
    ctx.state('trace', [...(ctx.state('trace') || []), routeName]);
    return originalGoto(routeName);
  };
  next();
}
```

This gives you the same execution trace that LangGraph provides via checkpointing, but without a separate persistence layer — it's built into the middleware pipeline.

### Agentic Example: 3-Node Agent

```typescript
import {
  Controller,
  Path,
  Get,
  Post,
  Body,
  Ctx,
  State,
  Middleware,
  Validation,
} from '@rosengate/exedra-ts';

// --- Node 1: Classify intent ---
@Path('/classify')
class ClassifyNode extends Controller {
  middlewareLog(req: any, res: any, next: any, ctx: Context) {
    const trace = ctx.state('trace') || [];
    trace.push(`classify@${Date.now()}`);
    ctx.state('trace', trace);
    next();
  }

  @Post('')
  @Validation({ input: 'required' })
  async classify(@Body('input') input: string, @Ctx() ctx: Context) {
    const intent = await llm.classify(input);
    ctx.state('intent', intent);
    ctx.state('input', input);

    // Dynamic edge — decided at runtime based on LLM output
    if (intent === 'search') return ctx.goto('search');
    if (intent === 'create') return ctx.goto('create');
    return ctx.goto('fallback');
  }
}

// --- Node 2: Search tool ---
@Path('/search')
@State('timeout', 5000)
class SearchNode extends Controller {
  @Post('')
  async search(@Ctx() ctx: Context) {
    const input = ctx.state('input');
    const results = await searchEngine.query(input);
    ctx.state('results', results);

    // After search, decide whether to respond or escalate
    if (results.length === 0) return ctx.goto('fallback');
    return ctx.goto('respond');
  }
}

// --- Node 3: Respond ---
@Path('/respond')
class RespondNode extends Controller {
  @Post('')
  async respond(@Ctx() ctx: Context) {
    const results = ctx.state('results');
    const response = await llm.generate(results);
    return { response, trace: ctx.state('trace') };
  }
}

// --- Graph topology (implicit, defined by goto calls) ---
//
//   ┌──────────┐
//   │ classify  │
//   └────┬─────┘
//        │
//   ┌────┴────────────────────┐
//   │                         │
//   ▼                         ▼
// ┌─────────┐          ┌──────────┐
// │ search   │──(empty)──▶ fallback │
// └────┬────┘          └────┬────┘
//      │                     │
//      ▼                     ▼
// ┌─────────┐          ┌─────────┐
// │ respond  │◀─────────│ respond  │
// └─────────┘          └─────────┘
//
// No static graph construction needed.
// Topology is defined by the handlers themselves.
```

### What This Enables That LangGraph Doesn't

| Feature                   | LangGraph                 | exedra-ts with `goto`                     |
| ------------------------- | ------------------------- | ----------------------------------------- |
| Static edges              | `add_conditional_edges()` | `@Edge({ when, goto })`                   |
| Dynamic edges             | External routing function | `ctx.goto()` inside handler               |
| Tool calls                | `ToolNode` wrapper class  | `await ctx.call('toolName')`              |
| Middleware on transitions | Checkpointing only        | Full onion middleware pipeline            |
| DI for node services      | Manual                    | `@Inject`, Container, per-request Context |
| Input validation          | Manual                    | `@Validation` decorator                   |
| Response transformation   | Manual                    | `@Transformer` decorator                  |
| Execution trace           | Checkpoint database       | Middleware intercepting `goto`            |
| HTTP + Agent in one app   | Not supported             | Same controller serves both               |

---

## Proposed Architecture

### Layer 1: Core (transport-agnostic)

Zero Express dependency. Everything that defines the graph, resolves dependencies, and manages state.

```
core/
  container.ts         — Container (unchanged)
  metadata.ts          — getMetadata, mergeMetadata (unchanged)
  context.ts           — Context (no req/res, pure state container)
  attributes/          — All decorators (unchanged — they store metadata via Reflect)
  support/             — wireman.ts, kebab-case.ts (unchanged)
```

**Context becomes:**

```typescript
class Context extends Container {
  private states_: Record<string, any>;
  private flags_: string[];
  private serieses_: Record<string, any[]>;
  private params_: Record<string, string>;
  private callStack_: CallStack;
  private parent_: Container | null;

  // No req, no res, no express dependency

  state(key: string, defaultValue?: any): any { ... }
  hasFlag(flag: string): boolean { ... }
  series(key: string): any[] { ... }
  param(name: string): string | undefined { ... }

  // Generic output instead of res.json/res.redirect
  result: any;
  setResult(value: any): void { this.result = value; }
}
```

### Layer 2: Transport Adapters

Thin wrappers that connect core to a specific runtime.

```
adapters/
  express/              — Current functionality
    index.ts            — createExedra(app, options)
    group.ts            — Group with Express Router
    context.ts          — ExpressContext extends Context (adds req/res)
    middleware.ts        — Bridges Express middleware to core pipeline

  agent/                — Graph/agentic execution
    index.ts            — createAgent(options)
    graph.ts            — Graph class (nodes + edges + state)
    executor.ts         — Runs the graph (state machine)
    checkpoint.ts       — Persistence layer for graph state

  cli/                  — Terminal/REPL execution (stretch goal)
```

### Layer 3: Graph Execution Model

The `GraphNode` base class:

```typescript
class GraphNode extends Controller {
  // Same decorator system — @Path becomes @Node, @Get becomes @Edge

  @Edge({ when: (output) => output.needsHumanReview, goto: 'humanReview' })
  @Edge({ when: () => true, goto: 'execute' })
  route(output: any) {} // conditional routing method
}

class Graph {
  addNode(name: string, nodeClass: Function): void;
  addEdge(from: string, to: string, condition?: (state: any) => boolean): void;
  setEntryPoint(nodeName: string): void;
  setFinishPoint(nodeName: string): void;

  async run(initialState: Record<string, any>): Promise<GraphState>;
}
```

**GraphState** is the evolution of `Context.states_`:

```typescript
interface GraphState {
  messages: Message[];
  context: Record<string, any>;
  metadata: Record<string, any>;
  checkpoint?: CheckpointData;
}
```

---

## What Changes, What Stays

| Component                                                                   | Change? | Notes                                                               |
| --------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| `Container`                                                                 | No      | Already transport-agnostic                                          |
| `metadata.ts`                                                               | No      | Reflect-based, no Express                                           |
| All decorators (`@Path`, `@State`, `@Flag`, `@Series`, `@Validation`, etc.) | No      | They store metadata, not behavior                                   |
| `getParamBindings` / `setParamBinding`                                      | No      | Parameter metadata storage                                          |
| `wireman.ts`                                                                | No      | Type resolution                                                     |
| `kebab-case.ts`                                                             | No      | Utility                                                             |
| `Context`                                                                   | **Yes** | Remove `req`/`res`, make output generic                             |
| `Group`                                                                     | **Yes** | Extract Express-specific routing to adapter                         |
| `Route`                                                                     | Minor   | Keep as data structure, remove Express coupling                     |
| `Finding`                                                                   | **Yes** | Replace Express route matching with generic match result            |
| `CallStack`                                                                 | Minor   | Add branching + fan-out                                             |
| `Call`                                                                      | No      | Already generic (callable + properties)                             |
| `CallHandler`                                                               | No      | Already generic                                                     |
| `handler.ts`                                                                | **Yes** | Extract Express bootstrap to adapter; keep reflection logic in core |
| `buildHandlers` (in Group)                                                  | **Yes** | Split into core pipeline + Express adapter                          |
| `resolveFromDecorators`                                                     | **Yes** | Make transport-agnostic (inject a `TransportContext` abstraction)   |

---

## Migration Path

### Phase 1: Extract Core (no behavior change)

1. Create `src/core/` directory
2. Move `container.ts`, `metadata.ts`, `attributes/`, `support/` → no changes needed
3. Create abstract `BaseContext` in `src/core/context.ts`
4. Current `Context` becomes `ExpressContext extends BaseContext` in `src/runtime/context.ts`
5. Create abstract `TransportAdapter` interface
6. Current `Factory` + `Group` + Express router logic moves to `src/adapters/express/`
7. All existing tests pass unchanged — Express adapter preserves current behavior

### Phase 2: Add Graph Executor (new feature, no breaking changes)

1. Add `@Node`, `@Edge`, `@GraphState` decorators to `src/core/attributes/`
2. Create `Graph` class that uses the same reflection + metadata system
3. Create `GraphExecutor` that runs nodes using `CallStack` with branching
4. Create `AgentAdapter` in `src/adapters/agent/`
5. Export from `src/index.ts` alongside existing Express exports

### Phase 3: Unify (breaking changes)

1. `Context` becomes fully transport-agnostic
2. Middleware signature changes to `(input, output, next, ctx)` with adapter providing transport-specific args
3. `createExedra` and `createAgent` share the same core

---

## Why This Could Be Good

### Compared to LangGraph (Python)

| LangGraph                           | exedra-ts equivalent                        |
| ----------------------------------- | ------------------------------------------- |
| `StateGraph(TypedDict)`             | `@State` decorators on controller           |
| `graph.add_node("name", fn)`        | Controller method with convention           |
| `graph.add_edge("a", "b")`          | `group*` subrouting                         |
| `graph.add_conditional_edges(...)`  | `@Edge({ when: ..., goto: ... })`           |
| `graph.compile()`                   | `createAgent({ controller: ... })`          |
| Checkpointing via `SqliteSaver`     | `@Checkpoint` decorator + pluggable storage |
| Human-in-the-loop via `interrupt()` | `@Interrupt` decorator on node              |

The decorator-driven approach eliminates a lot of the boilerplate that LangGraph users complain about. No manual graph construction — the graph topology is defined by the controller hierarchy.

### Compared to Vercel AI SDK

Vercel AI SDK's `ai.tool()` and `ai.streamText()` are functional but lack structure for complex multi-step agents. exedra-ts's controller convention provides:

- Organized tool definitions (methods on a controller)
- Built-in middleware for auth, logging, rate limiting on agent steps
- Metadata for routing decisions (flags, state)
- DI for injecting LLM clients, databases, caches

### Compared to Mastra

Mastra uses TypeScript but relies on explicit `workflow.addStep()` calls. exedra-ts's convention-based approach would let agents be defined as methods on a controller, with the framework handling wiring.

---

## Risks

1. **Complexity budget** — Two execution models (HTTP + graph) in one framework. Could confuse users.
2. **Express adapter maintenance** — Core changes must not break the Express adapter. Requires good test coverage.
3. **Graph execution is hard** — Loops, cycles, checkpointing, error recovery, parallel execution. Each is a significant feature.
4. **Ecosystem** — LangGraph has Python, which has the ML/AI ecosystem. TypeScript has Vercel AI SDK and Mastra. Need to pick the right integration points.
5. **Scope creep** — The goal is "support agentic patterns," not "build LangGraph." Keep the scope focused.

---

## What to Build First

If pursuing this, the highest-signal prototype is:

1. A `GraphNode` base class (or just reuse `Controller`)
2. A `Graph` class that takes controller classes and builds the execution graph
3. A `GraphExecutor` that runs one pass through the graph with state
4. One demo: a 3-node agent (classify intent → fetch data → generate response)

That demo validates whether the decorator convention works for non-HTTP use cases. If it does, the full extraction is worth pursuing. If not, the HTTP-focused framework is already solid.

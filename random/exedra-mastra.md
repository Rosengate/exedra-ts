# exedra-ts + Mastra: Complementary Integration

Exploration of using exedra-ts as the HTTP/routing layer alongside Mastra as the agent orchestration engine. Not a rewrite — a composition.

> See [decoupling-for-agentic.md](decoupling-for-agentic.md) for the alternative approach (making exedra itself an agent framework).

---

## TL;DR

exedra-ts handles HTTP routing, auth middleware, DI, validation, and response shaping. Mastra handles LLM calls, tool execution, memory, workflows, multi-agent orchestration, and checkpointing. They compose naturally because Mastra has an official Express adapter (`@mastra/express`) and exedra wraps Express. The bridge between them is Mastra's `RequestContext` — exedra middleware populates it, Mastra agents read it.

---

## Two Philosophies

### The Decoupling Approach (see `decoupling-for-agentic.md`)

Make exedra itself support agentic patterns. Extract a transport-agnostic core, add `ctx.goto()`, build a `GraphExecutor`, unify HTTP and agent execution under one framework.

**Pros:** One framework, one mental model, everything shares middleware/DI/metadata.
**Cons:** Massive scope. Reimplements what Mastra already does well (LLM orchestration, memory, workflows, processors).

### The Complementary Approach (this doc)

Keep exedra as an HTTP framework. Keep Mastra as an agent framework. Compose them.

**Pros:** Leverage both ecosystems. Ship faster. Each framework does what it's best at.
**Cons:** Two dependencies. Slight impedance mismatch between exedra's onion middleware and Mastra's Hono middleware.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       exedra controllers                        │
│                                                                 │
│  middlewareAuth  →  @Validation  →  handler  →  @Transformer   │
│  (extract user)    (validate       (call Mastra  (shape response│
│                     user input)     agent)        before send)  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    mastra.getAgent('name')
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Mastra agent / workflow                       │
│                                                                 │
│  agent.generate() / agent.stream()                              │
│  tools → LLM → tools → response                                │
│  memory, processors, checkpointing, multi-agent                 │
└─────────────────────────────────────────────────────────────────┘
```

exedra owns everything above the `generate()` call. Mastra owns everything below it.

---

## Integration Patterns

### Pattern 1: Express Embedding

Mastra's official `@mastra/express` adapter (`MastraServer`) embeds into the existing Express app that exedra wraps.

```typescript
// app.ts
import express from 'express';
import { createExedra } from '@rosengate/exedra-ts';
import { MastraServer } from '@mastra/express';
import { mastra } from './mastra';
import RootController from './controllers/RootController';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// exedra handles routing
const rootGroup = createExedra(app, {
  controller: RootController,
  namedParamAutoInject: true,
  useFlatRouting: true,
});

// Mastra handles agents — registered as Express routes under /api/agents/*
const server = new MastraServer({ app, mastra });
await server.init();

app.listen(3000, () => {
  console.log('app running on http://localhost:3000');
  console.log('agents available at /api/agents/*');
  console.log('workflows available at /api/workflows/*');
});
```

Both exedra routes (`/apis/users`, `/apis/profile`) and Mastra endpoints (`/api/agents/support`) coexist on the same Express app.

### Pattern 2: Context Bridge

exedra middleware populates Mastra's `RequestContext` with user info, permissions, locale — everything an agent needs.

```typescript
import express from 'express';
import { Controller, Path, Get, Post, Body, Ctx, Context } from '@rosengate/exedra-ts';
import { RequestContext } from '@mastra/core/request-context';
import { mastra } from '../mastra';

function buildMastraContext(ctx: Context): RequestContext {
  const requestContext = new RequestContext();
  if (ctx.hasState('userId')) requestContext.set('userId', ctx.state('userId'));
  if (ctx.hasState('userTier')) requestContext.set('userTier', ctx.state('userTier'));
  if (ctx.hasState('locale')) requestContext.set('locale', ctx.state('locale'));
  return requestContext;
}

@Path('/chat')
class ChatController extends Controller {
  middlewareAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
    ctx: Context,
  ) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = verifyToken(token);
    ctx.service('user', user);
    ctx.state('userId', user.id);
    ctx.state('userTier', user.tier);
    ctx.state('locale', req.headers['accept-language'] || 'en');
    next();
  }

  @Post('/send')
  async sendMessage(@Body('message') message: string, @Ctx() ctx: Context) {
    const agent = mastra.getAgentById('support-agent');
    const requestContext = buildMastraContext(ctx);

    const response = await agent.generate(message, {
      requestContext,
      memory: {
        resource: ctx.state('userId'),
        thread: ctx.state('threadId') || 'default',
      },
    });

    return { reply: response.text };
  }
}
```

exedra middleware extracts the user → `Context` holds user state → bridge function maps to `RequestContext` → Mastra agent receives it.

### Pattern 3: Agent Controller

An exedra controller that wraps Mastra agent calls, adding HTTP concerns that Mastra doesn't handle.

```typescript
import {
  Controller,
  Path,
  Post,
  Body,
  Get,
  Param,
  Ctx,
  Validation,
  Transformer,
} from '@rosengate/exedra-ts';
import { mastra } from '../mastra';

@Path('/agents')
class AgentController extends Controller {
  @Post('/support/chat')
  @Validation({ message: 'required', threadId: 'string' })
  @Transformer(ChatTransformer)
  async chat(
    @Body('message') message: string,
    @Body('threadId') threadId: string,
    @Ctx() ctx: Context,
  ) {
    const agent = mastra.getAgentById('support-agent');
    const requestContext = buildMastraContext(ctx);

    return agent.generate(message, {
      requestContext,
      memory: { resource: ctx.state('userId'), thread: threadId },
    });
  }

  @Post('/support/classify')
  @Validation({ message: 'required' })
  async classify(@Body('message') message: string, @Ctx() ctx: Context) {
    const agent = mastra.getAgentById('classifier-agent');
    return agent.generate(message, {
      requestContext: buildMastraContext(ctx),
      structuredOutput: {
        schema: {
          intent: 'string',
          confidence: 'number',
          suggestedAgent: 'string',
        },
      },
    });
  }
}
```

### Pattern 4: Streaming

Mastra agents return a `textStream` (AsyncIterable). exedra can forward this as Server-Sent Events.

```typescript
import express from 'express';
import { Controller, Path, Post, Body, Ctx } from '@rosengate/exedra-ts';
import { mastra } from '../mastra';

@Path('/chat')
class StreamChatController extends Controller {
  @Post('/stream')
  async streamChat(
    @Body('message') message: string,
    req: express.Request,
    res: express.Response,
    @Ctx() ctx: Context,
  ) {
    const agent = mastra.getAgentById('support-agent');
    const requestContext = buildMastraContext(ctx);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await agent.stream(message, {
      requestContext,
      memory: { resource: ctx.state('userId'), thread: 'stream-thread' },
    });

    for await (const chunk of stream.textStream) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }
}
```

### Pattern 5: Tool Registration

exedra controller methods can be wrapped as Mastra tools. The controller's `@Validation` schemas map to Mastra's Zod `inputSchema`.

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// exedra controller method
class ToolsController extends Controller {
  @Post('/lookup-account')
  @Validation({ email: 'required|email' })
  async lookupAccount(@Body('email') email: string) {
    const account = await db.accounts.findByEmail(email);
    if (!account) throw new Error('Account not found');
    return account;
  }
}

// Register as Mastra tool (thin wrapper)
const lookupAccountTool = createTool({
  id: 'lookup-account',
  description: 'Look up a customer account by email address',
  inputSchema: z.object({ email: z.string().email() }),
  execute: async ({ email }, context) => {
    const account = await db.accounts.findByEmail(email);
    if (!account) throw new Error('Account not found');
    return account;
  },
});
```

In the future, a helper could auto-convert exedra methods to Mastra tools:

```typescript
// Hypothetical: auto-generate Mastra tools from exedra controller
// import { toolsFromController } from '@rosengate/exedra-mastra';
// const tools = toolsFromController(ToolsController);
```

### Pattern 6: Workflow Triggers

exedra endpoints start Mastra workflows, check status, and resume after human input.

```typescript
import { Controller, Path, Post, Get, Param, Body, Ctx } from '@rosengate/exedra-ts';
import { mastra } from '../mastra';

@Path('/workflows')
class WorkflowController extends Controller {
  @Post('/support/start')
  async startWorkflow(@Body('message') message: string, @Body('userId') userId: string) {
    const workflow = mastra.getWorkflow('support-workflow');
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { message, userId } });

    return { runId: run.id, status: result.status };
  }

  @Get('/support/:runId/status')
  async getWorkflowStatus(@Param('runId') runId: string) {
    const workflow = mastra.getWorkflow('support-workflow');
    const run = await workflow.getRunById(runId);
    return { status: run.status, steps: run.steps };
  }

  @Post('/support/:runId/approve')
  async approveWorkflow(@Param('runId') runId: string, @Body('approved') approved: boolean) {
    const workflow = mastra.getWorkflow('support-workflow');
    const run = await workflow.getRunById(runId);

    if (run.status === 'suspended') {
      await run.resume({
        step: 'human-approval',
        resumeData: { approved },
      });
    }

    return { status: 'resumed' };
  }
}
```

---

## Full Example: Customer Support Agent

### Mastra setup

```typescript
// mastra/index.ts
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

const lookupAccount = createTool({
  id: 'lookup-account',
  description: 'Look up a customer account by email',
  inputSchema: z.object({ email: z.string().email() }),
  execute: async ({ email }) => db.accounts.findByEmail(email),
});

const checkInvoices = createTool({
  id: 'check-invoices',
  description: 'Get recent invoices for an account',
  inputSchema: z.object({ accountId: z.string() }),
  execute: async ({ accountId }) => db.invoices.findByAccount(accountId),
});

const searchKnowledgeBase = createTool({
  id: 'search-kb',
  description: 'Search the support knowledge base',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => kb.search(query, { limit: 3 }),
});

const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  instructions: ({ requestContext }) => {
    const tier = requestContext?.get('userTier') || 'standard';
    return tier === 'enterprise'
      ? 'You are a premium support agent with priority response.'
      : 'You are a helpful support agent.';
  },
  model: 'openai/gpt-4o',
  tools: { lookupAccount, checkInvoices, searchKnowledgeBase },
  memory: new Memory({
    storage: new LibSQLStore({ id: 'memory', url: 'file:mastra-memory.db' }),
    options: { lastMessages: 20, observationalMemory: true },
  }),
});

const classifierAgent = new Agent({
  id: 'classifier-agent',
  name: 'Intent Classifier',
  instructions: 'Classify the user intent as billing, technical, or general.',
  model: 'openai/gpt-4o-mini',
});

export const mastra = new Mastra({
  agents: { supportAgent, classifierAgent },
  storage: new LibSQLStore({ id: 'storage', url: 'file:mastra.db' }),
});
```

### exedra controller

```typescript
// controllers/SupportController.ts
import express from 'express';
import {
  Controller,
  Path,
  Post,
  Body,
  Ctx,
  Validation,
  Transformer,
  State,
  Flag,
} from '@rosengate/exedra-ts';
import type { Context } from '@rosengate/exedra-ts';
import { RequestContext } from '@mastra/core/request-context';
import { mastra } from '../mastra';

function bridgeContext(ctx: Context): RequestContext {
  const rc = new RequestContext();
  for (const key of ['userId', 'userTier', 'locale', 'threadId']) {
    if (ctx.hasState(key)) rc.set(key, ctx.state(key));
  }
  return rc;
}

@Flag('api')
@Path('/support')
class SupportController extends Controller {
  middlewareAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
    ctx: Context,
  ) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = verifyToken(token);
    ctx.state('userId', user.id);
    ctx.state('userTier', user.tier);
    ctx.state('locale', req.headers['accept-language'] || 'en');
    next();
  }

  middlewareLog(
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
    ctx: Context,
  ) {
    const start = Date.now();
    _res.on('finish', () => {
      console.log(
        `[support] ${req.method} ${req.originalUrl} ${_res.statusCode} (${Date.now() - start}ms)`,
      );
    });
    next();
  }

  // --- Chat endpoint ---
  @Post('/chat')
  @Validation({ message: 'required' })
  async chat(
    @Body('message') message: string,
    @Body('threadId') threadId: string | undefined,
    @Ctx() ctx: Context,
  ) {
    const agent = mastra.getAgentById('support-agent');
    return agent.generate(message, {
      requestContext: bridgeContext(ctx),
      memory: {
        resource: ctx.state('userId'),
        thread: threadId || `thread-${ctx.state('userId')}`,
      },
    });
  }

  // --- Stream endpoint ---
  @Post('/stream')
  @Validation({ message: 'required' })
  async stream(
    @Body('message') message: string,
    req: express.Request,
    res: express.Response,
    @Ctx() ctx: Context,
  ) {
    const agent = mastra.getAgentById('support-agent');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await agent.stream(message, {
      requestContext: bridgeContext(ctx),
      memory: { resource: ctx.state('userId'), thread: `thread-${ctx.state('userId')}` },
    });

    for await (const chunk of stream.textStream) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }

  // --- Classify endpoint ---
  @Post('/classify')
  @Validation({ message: 'required' })
  async classify(@Body('message') message: string, @Ctx() ctx: Context) {
    const agent = mastra.getAgentById('classifier-agent');
    return agent.generate(message, {
      requestContext: bridgeContext(ctx),
      structuredOutput: {
        schema: {
          intent: 'string',
          confidence: 'number',
          summary: 'string',
        },
      },
    });
  }
}

export default SupportController;
```

### Wiring

```typescript
// app.ts
import express from 'express';
import { createExedra } from '@rosengate/exedra-ts';
import { MastraServer } from '@mastra/express';
import { mastra } from './mastra';
import RootController from './controllers/RootController';

const app = express();
app.use(express.json());

const rootGroup = createExedra(app, {
  controller: RootController,
  namedParamAutoInject: true,
  useFlatRouting: true,
});

const server = new MastraServer({ app, mastra });
await server.init();

app.listen(3000);
// exedra: /support/chat, /support/stream, /support/classify
// Mastra:  /api/agents/support-agent, /api/agents/classifier-agent
```

---

## What exedra Adds That Mastra Alone Doesn't Have

| Feature                      | exedra contribution                                      | Mastra equivalent                           |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| **Convention-based routing** | `@Path`, `@Get`, `@Post` — no manual Express setup       | Manual route registration or auto-generated |
| **Middleware pipeline**      | `middleware*` prefix — onion model, 4th param is Context | Hono-based middleware (different model)     |
| **DI container**             | `Container` + `@Inject` + per-request scoped Context     | Constructor injection only                  |
| **Input validation**         | `@Validation` decorator on methods                       | Zod schemas on tools (separate definition)  |
| **Response shaping**         | `@Transformer` class transforms output                   | Manual post-processing                      |
| **Route introspection**      | `listRoutes()` — enumerate all endpoints                 | `mastra.getAgent()` / manual                |
| **Metadata**                 | `@State`, `@Flag`, `@Series` on routes                   | `RequestContext` (manual)                   |
| **Subrouting hierarchy**     | `group*` methods compose controllers                     | Not applicable (flat agent registry)        |
| **FailRoute**                | `@FailRoute` catch-all 404                               | Global error handler                        |

---

## What Mastra Adds That exedra Alone Doesn't Have

| Feature                  | Mastra contribution                                             | exedra equivalent                          |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------ |
| **LLM abstraction**      | Swap OpenAI/Anthropic/Google via model string                   | None (raw API calls)                       |
| **Tool lifecycle**       | `onInputAvailable`, `onOutput` hooks on tools                   | None                                       |
| **Tool Zod schemas**     | `inputSchema` / `outputSchema` with validation                  | `@Validation` (different purpose)          |
| **Workflow composition** | `.then()`, `.parallel()`, `.branch()`, `.dountil()`             | None                                       |
| **Memory**               | Conversation persistence, observational memory, semantic recall | None (manual)                              |
| **Processors**           | `TokenLimiter`, `ModerationProcessor`, PII detection            | None                                       |
| **Multi-agent**          | Supervisor pattern, sub-agents with isolated context            | `group*` (HTTP nesting, not agent nesting) |
| **Checkpointing**        | Suspend/resume, time travel, state snapshots                    | None                                       |
| **Streaming**            | `.stream()` with `textStream` AsyncIterable                     | None (manual SSE)                          |
| **Observability**        | Built-in tracing, scoring, experiments                          | None                                       |

---

## Dependency Impact

```bash
npm install @mastra/core @mastra/express
# Optional:
npm install @mastra/memory @mastra/libsql  # for agent memory
npm install @mastra/pg                      # for production storage
```

| Package           | Size (approx) | Purpose                                   |
| ----------------- | ------------- | ----------------------------------------- |
| `@mastra/core`    | ~200KB        | Agent, Tool, Workflow, Mastra class       |
| `@mastra/express` | ~10KB         | Express adapter (`MastraServer`)          |
| `@mastra/memory`  | ~50KB         | Conversation memory, observational memory |
| `@mastra/libsql`  | ~30KB         | SQLite/libSQL storage (dev)               |

Total: ~290KB added to the bundle. These are server-side only — no client impact.

---

## Migration Path for Existing exedra Apps

1. **Install Mastra**: `npm install @mastra/core @mastra/express @mastra/memory @mastra/libsql`

2. **Create `mastra/` directory** with agents, tools, and `index.ts` (the `Mastra` instance)

3. **Add `MastraServer` to app bootstrap**:

   ```typescript
   // After createExedra()
   const server = new MastraServer({ app, mastra });
   await server.init();
   ```

4. **Add agent endpoints to controllers** — new controller methods that call `mastra.getAgentById().generate()`

5. **Bridge middleware** — add a helper function that maps exedra `Context` state to Mastra `RequestContext`

6. **Optional**: wrap frequently-used controller methods as Mastra tools for use inside agent workflows

---

## Open Questions

1. **Should exedra export a `createAgentController()` helper?** A higher-level API that takes a Mastra agent ID and auto-generates the exedra controller (with `/chat`, `/stream`, `/classify` endpoints).

2. **How to handle streaming?** SSE is simple but limited. WebSocket gives bidirectional communication. Should the helper support both?

3. **Can `@State`/`@Flag` map to Mastra agent config?** e.g., `@Flag('streaming')` on an exedra method tells the bridge to use `agent.stream()` instead of `agent.generate()`.

4. **Auto-generating Mastra tools from exedra `@Post` methods?** The `@Validation` schema could be converted to Zod. This would eliminate the dual tool definition problem.

5. **Shared middleware?** exedra's `middlewareAuth` already extracts user info. Can Mastra agents access exedra's `Context` directly, or must everything go through `RequestContext`?

6. **Error handling?** exedra's `middlewareErrorHandling` catches errors. Mastra has `onError`. How do they compose? Should errors from `agent.generate()` bubble up through exedra's error middleware?

---

_See [decoupling-for-agentic.md](decoupling-for-agentic.md) for the alternative approach — making exedra itself an agent framework._

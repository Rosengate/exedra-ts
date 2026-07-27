# Agent Framework Comparison: Real-World Scenario

A concrete comparison of building the same agent across LangGraph, Mastra, Vercel AI SDK, and the proposed exedra-ts agentic model. Every code example implements the same scenario so you can see the differences side by side.

> See [decoupling-for-agentic.md](../decoupling-for-agentic.md) for the full exedra-ts agentic RFC.

---

## Scenario: Customer Support Agent

An LLM-powered agent that:

1. **Receives** a user message
2. **Classifies** intent (billing, technical, general)
3. **Routes** to a specialist sub-agent
4. **Calls tools** (lookup account, check invoices, search knowledge base)
5. **Generates** a response
6. **Escalates** to a human if the agent is uncertain

### Requirements

- Streaming responses to the client
- Middleware for auth, logging, rate limiting
- DI for injecting database, LLM client, config
- Human-in-the-loop: pause before escalation, wait for agent approval
- Memory: remember previous messages in the conversation
- Observability: trace every tool call and routing decision

---

## 1. LangGraph

### Agent Definition

```typescript
import { Annotation, StateGraph, START, END, MemorySaver, Command } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { AIMessage, BaseMessage, ToolMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';

// State schema with reducer
const SupportState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  intent: Annotation<string>,
  escalationNeeded: Annotation<boolean>,
});

const model = new ChatOpenAI({ model: 'gpt-4o', temperature: 0 });
```

### Tool Definition

```typescript
const lookupAccount = tool(
  async ({ email }) => {
    const account = await db.accounts.findByEmail(email);
    return account ? JSON.stringify(account) : 'Account not found';
  },
  {
    name: 'lookup_account',
    description: 'Look up a customer account by email',
    schema: z.object({ email: z.string().email() }),
  },
);

const checkInvoices = tool(
  async ({ accountId }) => {
    const invoices = await db.invoices.findByAccount(accountId);
    return JSON.stringify(invoices.slice(0, 5));
  },
  {
    name: 'check_invoices',
    description: 'Get recent invoices for an account',
    schema: z.object({ accountId: z.string() }),
  },
);

const searchKnowledgeBase = tool(
  async ({ query }) => {
    const results = await kb.search(query, { limit: 3 });
    return results.map((r) => r.content).join('\n---\n');
  },
  {
    name: 'search_knowledge_base',
    description: 'Search the support knowledge base',
    schema: z.object({ query: z.string() }),
  },
);
```

### Graph Topology

```typescript
// Nodes
const classifyIntent = async (state: typeof SupportState.State) => {
  const lastMsg = state.messages[state.messages.length - 1];
  const response = await model.invoke([
    { role: 'system', content: "Classify the user's intent: billing, technical, or general." },
    { role: 'user', content: lastMsg.content as string },
  ]);
  return { intent: response.content as string };
};

const routeByIntent = (state: typeof SupportState.State) => {
  switch (state.intent) {
    case 'billing':
      return 'billing_agent';
    case 'technical':
      return 'technical_agent';
    default:
      return 'general_agent';
  }
};

const billingAgent = async (state: typeof SupportState.State) => {
  const response = await model.bindTools([lookupAccount, checkInvoices]).invoke(state.messages);
  return { messages: [response] };
};

const technicalAgent = async (state: typeof SupportState.State) => {
  const response = await model.bindTools([searchKnowledgeBase]).invoke(state.messages);
  return { messages: [response] };
};

const generalAgent = async (state: typeof SupportState.State) => {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
};

const checkEscalation = async (state: typeof SupportState.State) => {
  const lastMsg = state.messages[state.messages.length - 1] as AIMessage;
  const response = await model.invoke([
    { role: 'system', content: 'Reply "escalate" if uncertain, "ok" if confident.' },
    ...state.messages,
  ]);
  return { escalationNeeded: response.content === 'escalate' };
};

const routeEscalation = (state: typeof SupportState.State) => {
  return state.escalationNeeded ? 'human_review' : END;
};

// Build
const workflow = new StateGraph(SupportState)
  .addNode('classify', classifyIntent)
  .addNode('billing_agent', billingAgent)
  .addNode('technical_agent', technicalAgent)
  .addNode('general_agent', generalAgent)
  .addNode('check_escalation', checkEscalation)
  .addNode('tools', new ToolNode([lookupAccount, checkInvoices, searchKnowledgeBase]))

  .addEdge(START, 'classify')
  .addConditionalEdges('classify', routeByIntent)
  .addConditionalEdges('billing_agent', (state) =>
    (state.messages.at(-1) as AIMessage)?.tool_calls?.length ? 'tools' : 'check_escalation',
  )
  .addConditionalEdges('technical_agent', (state) =>
    (state.messages.at(-1) as AIMessage)?.tool_calls?.length ? 'tools' : 'check_escalation',
  )
  .addEdge('general_agent', 'check_escalation')
  .addEdge('tools', 'check_escalation')
  .addConditionalEdges('check_escalation', routeEscalation);

const memory = new MemorySaver();
const graph = workflow.compile({
  checkpointer: memory,
  interruptBefore: ['human_review'], // pause for approval
});
```

### Execution

```typescript
const config = { configurable: { thread_id: 'conv-123' } };
const stream = await graph.stream(
  { messages: [{ role: 'user', content: 'I was charged twice last month' }] },
  { ...config, streamMode: 'updates' },
);
for await (const event of stream) {
  console.log(event);
}

// Human reviews and resumes
await graph.stream(null, config);
```

**Lines of code: ~110** (agent + tools + graph + execution)

---

## 2. Mastra

### Agent & Tool Definition

```typescript
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

const lookupAccount = createTool({
  id: 'lookup-account',
  description: 'Look up a customer account by email',
  inputSchema: z.object({ email: z.string().email() }),
  outputSchema: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  execute: async ({ email }) => {
    const account = await db.accounts.findByEmail(email);
    if (!account) throw new Error('Account not found');
    return account;
  },
});

const checkInvoices = createTool({
  id: 'check-invoices',
  description: 'Get recent invoices for an account',
  inputSchema: z.object({ accountId: z.string() }),
  outputSchema: z.array(z.object({ id: z.string(), amount: z.number(), date: z.string() })),
  execute: async ({ accountId }) => {
    return db.invoices.findByAccount(accountId);
  },
});

const searchKnowledgeBase = createTool({
  id: 'search-kb',
  description: 'Search the support knowledge base',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.array(z.object({ title: z.string(), content: z.string() })),
  execute: async ({ query }) => {
    return kb.search(query, { limit: 3 });
  },
});
```

### Agents

```typescript
const billingAgent = new Agent({
  id: 'billing-agent',
  name: 'Billing Specialist',
  instructions: 'You handle billing inquiries. Look up accounts and check invoices.',
  model: 'openai/gpt-4o',
  tools: { lookupAccount, checkInvoices },
  memory: new Memory({ storage: new LibSQLStore({ url: 'file:memory.db' }) }),
});

const technicalAgent = new Agent({
  id: 'technical-agent',
  name: 'Technical Specialist',
  instructions: 'You handle technical issues. Search the knowledge base for solutions.',
  model: 'openai/gpt-4o',
  tools: { searchKnowledgeBase },
  memory: new Memory({ storage: new LibSQLStore({ url: 'file:memory.db' }) }),
});

const generalAgent = new Agent({
  id: 'general-agent',
  name: 'General Support',
  instructions: 'You handle general inquiries.',
  model: 'openai/gpt-4o',
});

const supervisor = new Agent({
  id: 'supervisor',
  name: 'Support Supervisor',
  instructions: `You are the support supervisor. Classify the user's intent and delegate:
    - Billing issues -> billing-agent
    - Technical issues -> technical-agent
    - General questions -> general-agent
    If uncertain, escalate to a human.`,
  model: 'openai/gpt-4o',
  agents: { billingAgent, technicalAgent, generalAgent },
});
```

### Human-in-the-Loop (Suspend/Resume)

```typescript
const approvalStep = createStep({
  id: 'human-approval',
  inputSchema: z.object({ response: z.string(), confidence: z.number() }),
  outputSchema: z.object({ approved: z.boolean(), response: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (inputData.confidence < 0.7 && !resumeData?.approved) {
      return await suspend({ response: inputData.response });
    }
    return { approved: true, response: inputData.response };
  },
});

const supportWorkflow = createWorkflow({
  id: 'support-workflow',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ response: z.string() }),
})
  .then(classifyIntentStep)
  .branch([
    [async ({ inputData }) => inputData.intent === 'billing', billingStep],
    [async ({ inputData }) => inputData.intent === 'technical', technicalStep],
    [async () => true, generalStep],
  ])
  .then(approvalStep)
  .commit();

// Run
const run = await supportWorkflow.createRun();
const result = await run.start({ inputData: { message: 'I was charged twice' } });

if (result.status === 'suspended') {
  await run.resume({ step: 'human-approval', resumeData: { approved: true } });
}
```

**Lines of code: ~100** (tools + agents + workflow + human-in-the-loop)

---

## 3. Vercel AI SDK

### Tool Definition

```typescript
import { ToolLoopAgent, tool, isStepCount, createAgentUIStreamResponse } from 'ai';
import { z } from 'zod';

const lookupAccount = tool({
  description: 'Look up a customer account by email',
  inputSchema: z.object({
    email: z.string().describe('Customer email address'),
  }),
  execute: async ({ email }) => {
    const account = await db.accounts.findByEmail(email);
    return account ?? { error: 'Account not found' };
  },
});

const checkInvoices = tool({
  description: 'Get recent invoices for an account',
  inputSchema: z.object({ accountId: z.string() }),
  execute: async ({ accountId }) => {
    return db.invoices.findByAccount(accountId);
  },
});

const searchKnowledgeBase = tool({
  description: 'Search the support knowledge base for solutions',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    const results = await kb.search(query, { limit: 3 });
    return results.map((r) => ({ title: r.title, content: r.content }));
  },
});
```

### Agent Definition

```typescript
const supportAgent = new ToolLoopAgent({
  model: 'openai/gpt-4o',
  instructions: `You are a customer support agent. Classify the user's intent
    and use the appropriate tools. If you are uncertain, say "ESCALATE".`,
  tools: { lookupAccount, checkInvoices, searchKnowledgeBase },
  stopWhen: isStepCount(10),

  // Phase-based tool selection
  prepareStep: async ({ stepNumber }) => {
    if (stepNumber === 0) {
      // First step: classify intent (no tools needed)
      return { activeTools: [] };
    }
    return {}; // Let model decide
  },

  // Lifecycle hooks for observability
  onToolExecutionStart: ({ toolCall }) => {
    console.log(`[trace] Tool: ${toolCall.toolName}`, toolCall.args);
  },
  onToolExecutionEnd: ({ toolCall, toolExecutionMs }) => {
    console.log(`[trace] ${toolCall.toolName} completed in ${toolExecutionMs}ms`);
  },
});
```

### Execution with Runtime Context

```typescript
const result = await supportAgent.generate({
  prompt: 'I was charged twice last month for my subscription',
  runtimeContext: {
    userId: 'user-123',
    tier: 'premium',
    requestId: 'req-abc',
  },
});

if (result.text.includes('ESCALATE')) {
  // Escalation logic
  await notifyHumanAgent({ conversationId: 'conv-123', message: result.text });
}
```

### Streaming via API Route (Next.js)

```typescript
// app/api/support/route.ts
export async function POST(request: Request) {
  const { messages } = await request.json();
  return createAgentUIStreamResponse({
    agent: supportAgent,
    uiMessages: messages,
  });
}
```

**Lines of code: ~65** (tools + agent + execution + streaming)

---

## 4. exedra-ts (Proposed)

### Tool Definition (Controller Methods)

```typescript
import {
  Controller,
  Path,
  Get,
  Post,
  Body,
  Header,
  Ctx,
  Middleware,
  Validation,
  State,
  Flag,
  Inject,
  Transformer,
} from '@rosengate/exedra-ts';
import type { Context } from '@rosengate/exedra-ts';

class User {
  constructor(
    public id: string,
    public email: string,
    public name: string,
  ) {}
}

class Account {
  constructor(
    public id: string,
    public name: string,
    public email: string,
  ) {}
}

@Path('/support')
class SupportController extends Controller {
  // --- Middleware (applies to all routes in this controller) ---
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
    ctx.service(User, user);
    ctx.state('userId', user.id);
    next();
  }

  middlewareLog(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
    ctx: Context,
  ) {
    const start = Date.now();
    res.on('finish', () => {
      const trace = ctx.state('trace') || [];
      console.log(`[support] ${req.method} ${req.path} (${Date.now() - start}ms)`, trace);
    });
    next();
  }

  // --- Class-level state (defaults for all routes) ---
  @State('model', 'gpt-4o')
  @State('maxTokens', 2048)
  @Flag('streaming')
  @Flag('observability')

  // --- Tool: Lookup Account ---
  @Post('/lookup-account')
  @Validation({ email: 'required|email' })
  @Transformer(AccountTransformer)
  async lookupAccount(@Body('email') email: string) {
    const account = await db.accounts.findByEmail(email);
    if (!account) throw new Error('Account not found');
    return account;
  }

  // --- Tool: Check Invoices ---
  @Post('/check-invoices')
  @Validation({ accountId: 'required' })
  async checkInvoices(@Body('accountId') accountId: string) {
    return db.invoices.findByAccount(accountId);
  }

  // --- Tool: Search Knowledge Base ---
  @Post('/search-kb')
  @Validation({ query: 'required' })
  async searchKB(@Body('query') query: string) {
    return kb.search(query, { limit: 3 });
  }
}
```

### Routing & Dispatch

```typescript
// The agent's classification + routing happens inside the handler
// using ctx.goto() for dynamic dispatch to specialist nodes

class ClassifyNode extends Controller {
  @Post('/classify')
  @Validation({ message: 'required' })
  async classify(@Body('message') message: string, @Ctx() ctx: Context) {
    const intent = await llm.classify(message, ['billing', 'technical', 'general']);
    ctx.state('intent', intent);
    ctx.state('originalMessage', message);

    // Dynamic dispatch — decided at runtime by the LLM
    if (intent === 'billing') return ctx.goto('support.billing');
    if (intent === 'technical') return ctx.goto('support.technical');
    return ctx.goto('support.general');
  }
}

class BillingNode extends Controller {
  @Post('')
  async handle(@Ctx() ctx: Context) {
    const message = ctx.state('originalMessage');
    const account = await this.lookupAccount(message); // calls own tool
    const invoices = await this.checkInvoices(account.id); // calls own tool
    const response = await llm.generate(
      `Based on these invoices: ${JSON.stringify(invoices)}, answer: ${message}`,
    );
    ctx.state('response', response);
    return ctx.goto('support.escalation-check');
  }

  // Private tool methods — not exposed as routes
  private async lookupAccount(message: string) {
    const email = extractEmail(message);
    return db.accounts.findByEmail(email);
  }

  private async checkInvoices(accountId: string) {
    return db.invoices.findByAccount(accountId);
  }
}

class EscalationCheckNode extends Controller {
  @Post('')
  async check(@Ctx() ctx: Context) {
    const confidence = await llm.evaluate(ctx.state('response'));
    ctx.state('confidence', confidence);

    if (confidence < 0.7) {
      return ctx.goto('support.human-review'); // interruptBefore equivalent
    }
    return { response: ctx.state('response'), confidence };
  }
}

// --- Human review (pause + resume) ---
class HumanReviewNode extends Controller {
  @Post('')
  async review(@Ctx() ctx: Context) {
    // This endpoint is called by the human agent's dashboard
    const approved = req.body.approved;
    if (approved) {
      return ctx.call('support.respond'); // subroutine: returns here after
    }
    return { escalated: true, originalResponse: ctx.state('response') };
  }
}
```

### Subrouting (Graph Topology)

```typescript
class RootController extends Controller {
  groupSupport() {
    return SupportController; // tools + middleware
  }
}

class SupportController extends Controller {
  groupClassify() {
    return ClassifyNode;
  }
  groupBilling() {
    return BillingNode;
  }
  groupTechnical() {
    return TechnicalNode;
  }
  groupGeneral() {
    return GeneralNode;
  }
  groupEscalationCheck() {
    return EscalationCheckNode;
  }
  groupHumanReview() {
    return HumanReviewNode;
  }
  groupRespond() {
    return RespondNode;
  }
}

// The graph topology is implicit in the group* methods + ctx.goto() calls.
// No explicit .addEdge() or .addNode() needed.
```

### Full Graph (implicit)

```
RootController
└── groupSupport()  → SupportController  (@Path '/support')
    ├── middlewareAuth, middlewareLog
    ├── @State('model', 'gpt-4o'), @Flag('streaming')
    │
    ├── POST /classify           → ClassifyNode
    │   └── ctx.goto()           → billing / technical / general
    │
    ├── POST /billing            → BillingNode
    │   └── ctx.goto()           → escalation-check
    │
    ├── POST /technical          → TechnicalNode
    │   └── ctx.goto()           → escalation-check
    │
    ├── POST /general            → GeneralNode
    │   └── ctx.goto()           → escalation-check
    │
    ├── POST /escalation-check   → EscalationCheckNode
    │   └── ctx.goto()           → respond / human-review
    │
    ├── POST /human-review       → HumanReviewNode
    │   └── ctx.call()           → respond (subroutine)
    │
    └── POST /respond            → RespondNode
```

**Lines of code: ~90** (controllers + middleware + routing + tools)

---

## Feature Matrix

| Capability            | LangGraph                                         | Mastra                                    | Vercel AI SDK                                 | exedra-ts (proposed)                            |
| --------------------- | ------------------------------------------------- | ----------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| **Define agent**      | `StateGraph` + `.addNode()` + `.addEdge()`        | `new Agent({ tools, model })`             | `new ToolLoopAgent({ tools, model })`         | Controller class with `@State`/`@Flag`          |
| **Define tool**       | `tool()` from `@langchain/core`                   | `createTool({ execute })`                 | `tool({ execute })`                           | Controller method with `@Post`                  |
| **Graph topology**    | Explicit `.addEdge()` / `.addConditionalEdges()`  | `createWorkflow().then().branch()`        | Implicit tool loop + `prepareStep`            | `group*` subrouting + `ctx.goto()`              |
| **State schema**      | `Annotation.Root({ field: Annotation })`          | `stateSchema` on workflow/step            | `runtimeContext` / `toolsContext`             | `@State`/`@Flag`/`@Series` decorators           |
| **Middleware**        | Callbacks + LangSmith tracing                     | Hono server middleware + `RequestContext` | Lifecycle callbacks (`onStepStart`, etc.)     | `middleware*` prefix (onion model)              |
| **Human-in-the-loop** | `interruptBefore`/`interruptAfter` + checkpointer | `suspend()`/`resume()` on steps           | `hasToolCall()` stopping condition            | `ctx.goto('humanReview')` + API endpoint        |
| **Persistence**       | `MemorySaver` / `SqliteSaver` / `PostgresSaver`   | `Memory` + LibSQL/Postgres                | Provider memory tools                         | Pluggable (DI via Container)                    |
| **Sub-agents**        | Separate graph compiled as subgraph               | `agents: { subAgent }` on parent          | Subagent via tool wrapping                    | `group*` returns child controller               |
| **DI / services**     | Manual (LangChain runnables)                      | Constructor injection                     | `toolsContext` per-tool                       | `Container` + `@Inject` + per-request `Context` |
| **HTTP serving**      | Separate (LangServe / LangGraph Cloud)            | Built-in Hono server                      | `createAgentUIStreamResponse()`               | Built-in via `createExedra()`                   |
| **Streaming**         | `.stream()` on compiled graph                     | `.stream()` on agent/workflow             | `.stream()` / `createAgentUIStreamResponse()` | Express SSE / WebSocket (adapter)               |
| **Observability**     | LangSmith integration                             | Custom middleware                         | Lifecycle callbacks                           | Middleware pipeline (`middleware*`)             |

---

## Boilerplate Comparison

Same functionality: classify intent, call 3 tools, route to specialist, check escalation, human-in-the-loop.

| Framework         | Approx LOC | Key overhead                                                                     |
| ----------------- | ---------- | -------------------------------------------------------------------------------- |
| **LangGraph**     | ~110       | State annotation, explicit edge wiring, routing functions, ToolNode setup        |
| **Mastra**        | ~100       | Workflow + Step boilerplate, separate agent instantiation, suspend/resume schema |
| **Vercel AI SDK** | ~65        | Minimal — but no built-in graph topology, human-in-the-loop, or DI               |
| **exedra-ts**     | ~90        | Controller convention, middleware methods, group* subrouting                     |

Where the lines go:

- **LangGraph**: heaviest on graph construction (every edge is explicit)
- **Mastra**: heaviest on schema definitions (input/output schemas on every step and tool)
- **Vercel AI SDK**: lightest — but you give up graph topology, DI, and middleware
- **exedra-ts**: middle ground — convention eliminates boilerplate, but `ctx.goto()` is new API surface

---

## When to Use Which

### Use LangGraph when...

- You need **complex graph topologies** with cycles, parallel branches, and conditional routing
- You want **checkpoint/time-travel** — replay execution from any point
- You're in the **Python ecosystem** and need access to the ML/AI toolchain
- You need **LangSmith observability** out of the box
- You're building **multi-agent networks** where agents hand off to each other

### Use Mastra when...

- You're building a **full-stack TypeScript app** and want agents + storage + workflows in one framework
- You need **workflow composition** — parallel, branching, looping, foreach
- You want **built-in memory** with observational compression
- You need **processor pipelines** for input/output transformation
- You want **suspend/resume** without building your own persistence layer

### Use Vercel AI SDK when...

- You're building a **Next.js/React app** and want tight UI integration
- You need **streaming** with minimal setup
- Your agent is a **simple tool loop** — classify, call tool, respond
- You don't need complex graph topology or human-in-the-loop
- You want the **smallest possible API surface**

### Use exedra-ts (proposed) when...

- You **already have an Express app** and want to add agents alongside HTTP routes
- You want **the same code** to serve both HTTP requests and agent tool calls
- You prefer **convention over configuration** — no manual graph construction
- You need **middleware and DI** on agent nodes (auth, logging, rate limiting)
- You want **metadata-driven routing** — `@State`, `@Flag`, `@Series` travel with execution
- You want agents to be **first-class routes** that can be introspected via `listRoutes()`

---

## exedra-ts Unique Advantages

### 1. Same code serves HTTP and agents

A controller method is simultaneously an HTTP endpoint and a graph node. No separate agent class needed.

```typescript
// This is both a REST endpoint AND an agent tool
@Post("/lookup-account")
async lookupAccount(@Body("email") email: string) {
  return db.accounts.findByEmail(email);
}
```

LangGraph and Mastra require separate definitions for HTTP endpoints and agent tools. exedra-ts unifies them.

### 2. Middleware applies to everything

`middlewareAuth` runs whether the request comes from `curl`, a browser, or an LLM tool call. No duplication.

```typescript
class SupportController extends Controller {
  middlewareAuth(req, res, next, ctx) {
    // Runs for ALL routes — HTTP and agent alike
    const user = verifyToken(req.headers.authorization);
    ctx.service(User, user);
    next();
  }
}
```

LangGraph has no middleware concept. Mastra has Hono middleware (server-level only) and `RequestContext` (separate from tool execution). Vercel AI SDK has lifecycle callbacks but no middleware pipeline.

### 3. DI is first-class

`@Inject(User)` and `@Ctx()` work in agent nodes the same way they work in HTTP handlers. The Container + per-request Context model means agents get request-scoped services automatically.

```typescript
@Post("/billing")
async handle(@Inject(User) user: User, @Ctx() ctx: Context) {
  // user was registered by middlewareAuth, resolved by DI
  const account = await db.accounts.findByUser(user.id);
  return { invoices: await db.invoices.findByAccount(account.id) };
}
```

LangGraph requires manual dependency passing. Mastra uses constructor injection (not per-request). Vercel AI SDK uses `toolsContext` (per-tool, not per-request).

### 4. Metadata-driven behavior travels with execution

`@State`, `@Flag`, `@Series` are set once on the controller and accessible everywhere — in handlers, middleware, and downstream `goto()` targets.

```typescript
@State('model', 'gpt-4o')
@Flag('streaming')
@Flag('observability')
class SupportController extends Controller {
  middlewareLog(req, res, next, ctx) {
    if (ctx.hasFlag('observability')) {
      console.log('tracing enabled');
    }
    next();
  }
}
```

No other framework has this. LangGraph requires passing state through `Annotation`. Mastra uses `RequestContext` (separate from tools). Vercel AI SDK uses `runtimeContext` (manual, not declarative).

### 5. Subrouting = subgraph

`group*` methods compose controllers into a hierarchy. This hierarchy is simultaneously:

- An HTTP route tree (for `createExedra()`)
- A graph topology (for `ctx.goto()`)
- An introspectable structure (for `listRoutes()`)

```typescript
class SupportController extends Controller {
  groupClassify() {
    return ClassifyNode;
  }
  groupBilling() {
    return BillingNode;
  }
  groupTechnical() {
    return TechnicalNode;
  }
}
```

No other framework lets you define both HTTP routing and graph topology with the same declaration.

---

## Summary

|                | LangGraph                   | Mastra                       | Vercel AI SDK              | exedra-ts                     |
| -------------- | --------------------------- | ---------------------------- | -------------------------- | ----------------------------- |
| **Strength**   | Graph power, time-travel    | Full-stack TS, workflows     | UI integration, simplicity | Convention, unification       |
| **Weakness**   | Verbose, Python-centric     | Many packages, heavy schemas | No graph topology          | Doesn't exist yet             |
| **Best for**   | Complex multi-agent systems | Production AI apps           | Next.js chatbots           | Express apps with agents      |
| **Philosophy** | Explicit graph construction | Composable workflows         | Minimal tool loop          | Convention over configuration |

---

_See [decoupling-for-agentic.md](../decoupling-for-agentic.md) for the full RFC on making exedra-ts support agentic patterns._

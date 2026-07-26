import { Controller, Path, Get } from '../../src';
import type { Request, Response } from 'express';

function landingPage(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>exedra-ts — Class-based Routing for Express</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'Inter', sans-serif; }
    code, pre { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-gray-950 text-gray-100 antialiased">

  <!-- Hero -->
  <header class="relative overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-transparent to-purple-600/20 pointer-events-none"></div>
    <div class="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center relative">
      <div class="inline-block mb-4 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium">
        TypeScript port of exedra-php
      </div>
      <h1 class="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
        <span class="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">exedra-ts</span>
      </h1>
      <p class="text-xl text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed">
        Class and convention-based routing for Express.js.<br />
        Decorators, middleware, dependency injection &mdash; all wired through reflection.
      </p>
      <div class="flex justify-center gap-4">
        <a href="#quickstart" class="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium transition-colors">
          Get Started
        </a>
        <a href="https://github.com/rosengate/exedra-ts" class="px-6 py-3 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-medium transition-colors">
          GitHub
        </a>
      </div>
    </div>
  </header>

  <!-- Features -->
  <section class="max-w-5xl mx-auto px-6 py-20">
    <h2 class="text-3xl font-bold text-center mb-12">Why exedra-ts?</h2>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">

      <div class="p-6 rounded-xl bg-gray-900 border border-gray-800">
        <div class="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4">
          <svg class="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
        </div>
        <h3 class="font-semibold text-lg mb-2">Decorator-driven</h3>
        <p class="text-gray-400 text-sm leading-relaxed">
          Use <code class="text-indigo-300">@Get</code>, <code class="text-indigo-300">@Post</code>, <code class="text-indigo-300">@Path</code> and more to define routes declaratively on your controller classes.
        </p>
      </div>

      <div class="p-6 rounded-xl bg-gray-900 border border-gray-800">
        <div class="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
          <svg class="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
        </div>
        <h3 class="font-semibold text-lg mb-2">Convention over configuration</h3>
        <p class="text-gray-400 text-sm leading-relaxed">
          Method prefixes like <code class="text-purple-300">get*</code>, <code class="text-purple-300">post*</code>, <code class="text-purple-300">middleware*</code> automatically register routes &mdash; no manual wiring needed.
        </p>
      </div>

      <div class="p-6 rounded-xl bg-gray-900 border border-gray-800">
        <div class="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
          <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
        </div>
        <h3 class="font-semibold text-lg mb-2">Dependency injection</h3>
        <p class="text-gray-400 text-sm leading-relaxed">
          Type-based and decorator-based DI. Use <code class="text-emerald-300">@Param</code>, <code class="text-emerald-300">@Body</code>, <code class="text-emerald-300">@Query</code>, <code class="text-emerald-300">@Inject</code> to resolve parameters automatically.
        </p>
      </div>

      <div class="p-6 rounded-xl bg-gray-900 border border-gray-800">
        <div class="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
          <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </div>
        <h3 class="font-semibold text-lg mb-2">Subrouting</h3>
        <p class="text-gray-400 text-sm leading-relaxed">
          Nest controllers with <code class="text-amber-300">group*</code> methods. Express sub-routers or flat routing &mdash; your choice.
        </p>
      </div>

      <div class="p-6 rounded-xl bg-gray-900 border border-gray-800">
        <div class="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center mb-4">
          <svg class="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        </div>
        <h3 class="font-semibold text-lg mb-2">Transformers</h3>
        <p class="text-gray-400 text-sm leading-relaxed">
          Shape responses with <code class="text-rose-300">@Transformer</code> classes. Support includes, validation, and route-level state.
        </p>
      </div>

      <div class="p-6 rounded-xl bg-gray-900 border border-gray-800">
        <div class="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-4">
          <svg class="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
        </div>
        <h3 class="font-semibold text-lg mb-2">Express compatible</h3>
        <p class="text-gray-400 text-sm leading-relaxed">
          Wraps Express, not replaces it. Full access to <code class="text-cyan-300">req</code>, <code class="text-cyan-300">res</code>, <code class="text-cyan-300">next</code> and the Express ecosystem.
        </p>
      </div>

    </div>
  </section>

  <!-- Quick Start -->
  <section id="quickstart" class="max-w-5xl mx-auto px-6 py-20 border-t border-gray-800">
    <h2 class="text-3xl font-bold text-center mb-4">Quick Start</h2>
    <p class="text-gray-400 text-center mb-12 max-w-xl mx-auto">Install, define a controller, and start serving in under a minute.</p>

    <div class="space-y-8">
      <!-- Step 1 -->
      <div class="flex gap-4">
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">1</div>
        <div class="flex-1">
          <h3 class="font-semibold mb-2">Install</h3>
          <pre class="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm overflow-x-auto"><code>npm install @rosengate/exedra-ts express reflect-metadata</code></pre>
        </div>
      </div>

      <!-- Step 2 -->
      <div class="flex gap-4">
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">2</div>
        <div class="flex-1">
          <h3 class="font-semibold mb-2">Create a controller</h3>
          <pre class="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm overflow-x-auto"><code><span class="text-purple-400">import</span> { Controller, Path, Get } <span class="text-purple-400">from</span> <span class="text-emerald-300">'@rosengate/exedra-ts'</span>;

<span class="text-indigo-400">@Path</span>(<span class="text-emerald-300">'/users'</span>)
<span class="text-purple-400">class</span> <span class="text-amber-300">UsersController</span> <span class="text-purple-400">extends</span> <span class="text-amber-300">Controller</span> {
  <span class="text-indigo-400">@Get</span>(<span class="text-emerald-300">''</span>)
  <span class="text-cyan-300">list</span>() {
    <span class="text-purple-400">return</span> [{ id: <span class="text-amber-300">1</span>, name: <span class="text-emerald-300">'Ada'</span> }];
  }
}</code></pre>
        </div>
      </div>

      <!-- Step 3 -->
      <div class="flex gap-4">
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">3</div>
        <div class="flex-1">
          <h3 class="font-semibold mb-2">Bootstrap</h3>
          <pre class="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm overflow-x-auto"><code><span class="text-purple-400">import</span> express <span class="text-purple-400">from</span> <span class="text-emerald-300">'express'</span>;
<span class="text-purple-400">import</span> { createExedra } <span class="text-purple-400">from</span> <span class="text-emerald-300">'@rosengate/exedra-ts'</span>;

<span class="text-purple-400">const</span> app = <span class="text-cyan-300">express</span>();
<span class="text-cyan-300">createExedra</span>(app, { controller: <span class="text-amber-300">UsersController</span> });
app.<span class="text-cyan-300">listen</span>(<span class="text-amber-300">3000</span>);</code></pre>
        </div>
      </div>
    </div>
  </section>

  <!-- Prefix Table -->
  <section class="max-w-5xl mx-auto px-6 py-20 border-t border-gray-800">
    <h2 class="text-3xl font-bold text-center mb-12">Method Prefixes</h2>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-gray-800 text-gray-400">
            <th class="py-3 px-4 font-medium">Prefix</th>
            <th class="py-3 px-4 font-medium">Role</th>
            <th class="py-3 px-4 font-medium">Example</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-800/50">
          <tr><td class="py-3 px-4"><code class="text-indigo-300">get*</code></td><td class="py-3 px-4 text-gray-400">GET route</td><td class="py-3 px-4 text-gray-400"><code>getUsers()</code></td></tr>
          <tr><td class="py-3 px-4"><code class="text-indigo-300">post*</code></td><td class="py-3 px-4 text-gray-400">POST route</td><td class="py-3 px-4 text-gray-400"><code>postUser()</code></td></tr>
          <tr><td class="py-3 px-4"><code class="text-indigo-300">put*</code></td><td class="py-3 px-4 text-gray-400">PUT route</td><td class="py-3 px-4 text-gray-400"><code>putUser()</code></td></tr>
          <tr><td class="py-3 px-4"><code class="text-indigo-300">delete*</code></td><td class="py-3 px-4 text-gray-400">DELETE route</td><td class="py-3 px-4 text-gray-400"><code>deleteUser()</code></td></tr>
          <tr><td class="py-3 px-4"><code class="text-indigo-300">middleware*</code></td><td class="py-3 px-4 text-gray-400">Group middleware</td><td class="py-3 px-4 text-gray-400"><code>middlewareAuth()</code></td></tr>
          <tr><td class="py-3 px-4"><code class="text-indigo-300">group*</code></td><td class="py-3 px-4 text-gray-400">Subrouting</td><td class="py-3 px-4 text-gray-400"><code>groupAdmin()</code></td></tr>
          <tr><td class="py-3 px-4"><code class="text-indigo-300">setup*</code></td><td class="py-3 px-4 text-gray-400">Direct group setup</td><td class="py-3 px-4 text-gray-400"><code>setupRoutes(group)</code></td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- Footer -->
  <footer class="border-t border-gray-800 py-10 text-center text-gray-500 text-sm">
    <p>exedra-ts &mdash; MIT License &mdash; Built on <a href="https://expressjs.com" class="text-indigo-400 hover:text-indigo-300">Express</a></p>
  </footer>

</body>
</html>`;
}

@Path('/')
export default class WebController extends Controller {
  @Get('')
  landing(req: Request, res: Response) {
    res.send(landingPage());
  }
}

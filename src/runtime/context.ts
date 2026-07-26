import express from 'express';
import { Finding } from '../routing/finding';
import { CallStack } from '../routing/callstack';
import { Container, ContainerKey } from '../container';

export class Context extends Container {
  req: express.Request;
  res: express.Response;
  private params_: Record<string, string>;
  private states_: Record<string, any>;
  private flags_: string[];
  private serieses_: Record<string, any[]>;
  private callStack_: CallStack;
  private callPointer = 0;
  private parent_: Container | null;

  constructor(
    req: express.Request,
    res: express.Response,
    params: Record<string, string> = {},
    states: Record<string, any> = {},
    flags: string[] = [],
    serieses: Record<string, any[]> = {},
    callStack?: CallStack,
    parent?: Container,
  ) {
    super();
    this.req = req;
    this.res = res;
    this.params_ = params;
    this.states_ = states;
    this.flags_ = flags;
    this.serieses_ = serieses;
    this.callStack_ = callStack || new CallStack();
    this.parent_ = parent || null;
    this.service(Context, this);
  }

  static fromFinding(
    req: express.Request,
    res: express.Response,
    finding: Finding,
    parent?: Container,
  ): Context {
    const fullProps = finding.route.fullProperties();
    return new Context(
      req,
      res,
      finding.getParameters(),
      fullProps.states || {},
      fullProps.flags || [],
      fullProps.serieses || {},
      finding.getCallStack(),
      parent,
    );
  }

  resolve(name: ContainerKey): any {
    if (this.services.has(name)) return this.services.get(name);
    const factory = this.factories.get(name);
    if (factory) return factory();
    if (typeof name === 'string' && this.callables.has(name)) return this.callables.get(name);
    if (this.parent_) return this.parent_.resolve(name);
    return undefined;
  }

  canResolve(name: ContainerKey): boolean {
    if (this.services.has(name)) return true;
    if (this.factories.has(name)) return true;
    if (typeof name === 'string' && this.callables.has(name)) return true;
    if (this.parent_) return this.parent_.canResolve(name);
    return false;
  }

  param(name: string): string | undefined {
    return this.params_[name];
  }

  hasParam(name: string): boolean {
    return name in this.params_;
  }

  state(key: string, defaultValue?: any): any {
    return key in this.states_ ? this.states_[key] : defaultValue;
  }

  hasState(key: string): boolean {
    return key in this.states_;
  }

  hasFlag(flag: string): boolean {
    return this.flags_.includes(flag);
  }

  flags(): string[] {
    return [...this.flags_];
  }

  series(key: string): any[] {
    return this.serieses_[key] || [];
  }

  hasSeries(key: string): boolean {
    return key in this.serieses_;
  }

  async next(): Promise<any> {
    if (this.callPointer >= this.callStack_.length()) return undefined;

    const callable = this.callStack_.getNextCallable();
    this.callPointer++;
    return callable(this.req, this.res);
  }

  redirect(url: string): void {
    this.res.redirect(url);
  }

  json(data: any): void {
    this.res.json(data);
  }

  send(body?: any): void {
    this.res.send(body);
  }

  status(code: number): this {
    this.res.status(code);
    return this;
  }
}

export class Call {
  callable: Function;
  properties: Record<string, any>;

  constructor(callable: Function, properties: Record<string, any> = {}) {
    this.callable = callable;
    this.properties = properties;
  }

  hasDependencies(): boolean {
    const deps = this.properties.dependencies;
    return Array.isArray(deps) && deps.length > 0;
  }

  getDependencies(): string[] {
    return this.properties.dependencies || [];
  }

  async invoke(...args: any[]): Promise<any> {
    return this.callable(...args);
  }
}

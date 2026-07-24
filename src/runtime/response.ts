export class Response {
  status_: number;
  body: any;
  headers: Record<string, string>;

  constructor() {
    this.status_ = 200;
    this.body = null;
    this.headers = {};
  }

  setStatus(code: number): this {
    this.status_ = code;
    return this;
  }

  setBody(body: any): this {
    this.body = body;
    return this;
  }

  setHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  json(data: any): this {
    this.body = data;
    return this;
  }
}

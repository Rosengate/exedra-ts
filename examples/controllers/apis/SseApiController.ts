import { Controller, Path, Req, Res } from '../../../src';
import express from 'express';

@Path('/sse')
export default class SseApiController extends Controller {
  @Path('/streaming')
  postStreaming(@Req() req: express.Request, @Res() res: express.Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let count = 0;
    const interval = setInterval(() => {
      count++;
      res.write(`data: ${JSON.stringify({ count, time: new Date().toISOString() })}\n\n`);
      if (count >= 10) {
        clearInterval(interval);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }, 1000);
  }
}

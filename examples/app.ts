import 'reflect-metadata';
import express from 'express';
import { createExedra } from '../src';
import RootController from './controllers/RootController';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Wire up exedra routing
const rootGroup = createExedra(app, { controller: RootController });

const PORT = process.env.PORT || 3000;

// --routes flag: list all routes and exit
if (process.argv.includes('--routes')) {
  const routes = rootGroup.listRoutes();
  console.log('');
  console.log(`  Registered routes (${routes.length}):`);
  console.log('');
  console.table(
    routes.map((r) => ({
      Method: r.method,
      Path: r.path,
      Name: r.name,
      Controller: r.controller,
      Action: r.action,
    })),
  );
  process.exit(0);
}

app.listen(PORT, () => {
  console.log('');
  console.log('  exedra-ts example app running');
  console.log('');
  console.log(`  http://localhost:${PORT}/`);
  console.log(`  http://localhost:${PORT}/health`);
  console.log(`  http://localhost:${PORT}/users`);
  console.log(`  http://localhost:${PORT}/users/1`);
  console.log(`  http://localhost:${PORT}/posts`);
  console.log(`  http://localhost:${PORT}/posts/1`);
  console.log(`  http://localhost:${PORT}/admin`);
  console.log(`  http://localhost:${PORT}/admin/settings`);
  console.log(`  http://localhost:${PORT}/admin/stats`);
  console.log('');
});

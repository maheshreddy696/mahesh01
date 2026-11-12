import { createApp } from './app';
import { env } from './lib/env';

const app = createApp();

app.listen(env.port, '0.0.0.0', () => {
  console.log(`Schedulr API listening on http://localhost:${env.port}`);
});


import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const SERVER = fileURLToPath(new URL('../../scripts/serve.js', import.meta.url));

async function freePort() {
  const probe = net.createServer();
  await new Promise((done) => probe.listen(0, '127.0.0.1', done));
  const { port } = probe.address();
  probe.close();
  return port;
}

// The real entrypoint, on its own port, exactly as pm2 runs it.
async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await fetch(`${base}/web/index.html`);
      return { child, base };
    } catch {
      await new Promise((done) => setTimeout(done, 100));
    }
  }
  child.kill();
  throw new Error('test server never came up');
}

async function withServer(run) {
  const { child, base } = await startServer();
  try {
    await run(base);
  } finally {
    child.kill();
    await new Promise((done) => child.on('exit', done));
  }
}

test('the domain root redirects to the atlas page', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/web/index.html');
  });
});

test('the atlas page serves as html', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/web/index.html`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/html/);
  });
});

test('missing paths answer not found', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/nope`);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), 'not found');
  });
});

test('request paths cannot escape the document root', async () => {
  await withServer(async (base) => {
    const { port } = new URL(base);
    const raw = net.connect(Number(port), '127.0.0.1');
    const reply = await new Promise((done, fail) => {
      raw.on('error', fail);
      let text = '';
      raw.on('data', (chunk) => {
        text += chunk;
        if (text.includes('\r\n\r\n') || text.includes('not found')) done(text);
      });
      raw.write(
        'GET /../../etc/passwd HTTP/1.1\r\nHost: test\r\nConnection: close\r\n\r\n',
      );
    });
    raw.destroy();
    assert.match(reply, /^HTTP\/1\.1 404/);
  });
});

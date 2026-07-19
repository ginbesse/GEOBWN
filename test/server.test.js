const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

let server;

function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: '3101' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    server.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    server.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    const timer = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 5000);
    const checkReady = async () => {
      for (let index = 0; index < 20; index += 1) {
        try {
          const response = await fetch('http://127.0.0.1:3101/api/health');
          if (response.ok) {
            clearTimeout(timer);
            resolve();
            return;
          }
        } catch {
          // keep waiting
        }
        await new Promise((waitResolve) => setTimeout(waitResolve, 100));
      }
      reject(new Error(`Server did not start: ${output}`));
    };

    server.on('spawn', () => {
      checkReady();
    });
    server.on('error', reject);
  });
}

function stopServer() {
  if (server) {
    server.kill();
    server = null;
  }
}

test('health endpoint responds', async () => {
  await startServer();
  try {
    const response = await fetch('http://127.0.0.1:3101/api/health');
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.status, 'ok');
  } finally {
    stopServer();
  }
});

test('conversion endpoint creates an Android app scaffold', async () => {
  await startServer();
  try {
    const fixtureDir = path.join(__dirname, 'fixtures');
    await fs.mkdir(fixtureDir, { recursive: true });
    const fixturePath = path.join(fixtureDir, 'sample.html');
    await fs.writeFile(fixturePath, '<html><body>Hello APK</body></html>');

    const response = await fetch('http://127.0.0.1:3101/api/convert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filePath: fixturePath, appName: 'DemoApp' })
    });

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.analysis.kind, 'web');
    assert.match(data.outputPath, /DemoApp/);
    assert.match(data.buildScriptPath, /build-apk\.sh/);
  } finally {
    stopServer();
  }
});

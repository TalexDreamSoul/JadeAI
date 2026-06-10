import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const secret = process.env.MIHOMO_SECRET;
const origin = 'https://clashx.wc1.tagzxia.com';

if (!secret) {
  throw new Error('MIHOMO_SECRET is required');
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
  args: [
    '--proxy-server=direct://',
    '--proxy-bypass-list=*',
    '--host-resolver-rules=MAP clashx.wc1.tagzxia.com 8.160.180.158',
    '--disable-quic',
    '--disable-features=UseDnsHttpsSvcbAlpn,EncryptedClientHello',
    '--ignore-certificate-errors',
  ],
});

const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
const responses = [];

page.on('response', (res) => {
  const url = res.url();
  if (url.includes('clashx.wc1.tagzxia.com')) {
    responses.push({ url, status: res.status() });
  }
});

try {
  await page.goto(`${origin}/__mihomo_probe?ts=${Date.now()}#/setup`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
  const probeText = (await page.locator('body').innerText({ timeout: 5000 })).trim();

  await page.goto(`${origin}/reset#/setup`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
  const resetText = (await page.locator('body').innerText({ timeout: 5000 })).trim().slice(0, 160);

  await page.goto(`${origin}/login`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
  const loginText = (await page.locator('body').innerText({ timeout: 5000 })).trim();
  await page.locator('input[name="secret"]').fill(secret);
  await Promise.all([
    page.waitForURL(`${origin}/`, { timeout: 20000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

  const api = {};
  for (const path of ['/version', '/proxies', '/providers/proxies']) {
    api[path] = await page.evaluate(
      async ({ path, secret }) => {
        const response = await fetch(path, {
          headers: { Authorization: `Bearer ${secret}` },
        });
        return {
          status: response.status,
          contentType: response.headers.get('content-type') || '',
          bodyStart: (await response.text()).slice(0, 80),
        };
      },
      { path, secret },
    );
  }

  const ws = {};
  for (const path of ['/connections', '/traffic', '/memory', '/logs']) {
    ws[path] = await page.evaluate(
      async ({ path, secret }) =>
        new Promise((resolve) => {
          const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
          const query = path === '/logs' ? `token=${secret}&level=info` : `token=${secret}`;
          const socket = new WebSocket(`${protocol}//${location.host}${path}?${query}`);
          const timer = setTimeout(() => {
            try {
              socket.close();
            } catch {}
            resolve({ opened: false, readyState: socket.readyState });
          }, 7000);
          socket.onopen = () => {
            clearTimeout(timer);
            socket.close();
            resolve({ opened: true, readyState: socket.readyState });
          };
          socket.onerror = () => {
            clearTimeout(timer);
            resolve({ opened: false, readyState: socket.readyState });
          };
        }),
      { path, secret },
    );
  }

  const interestingResponses = responses
    .filter((response) => {
      const url = new URL(response.url);
      return /^\/(__mihomo_probe|reset|login|version|proxies|providers\/proxies)(\?|$)/.test(
        url.pathname + url.search,
      );
    })
    .slice(0, 30);

  console.log(
    JSON.stringify(
      {
        probeText,
        resetText,
        loginHasExpectedText:
          loginText.includes('Mihomo Dashboard') &&
          loginText.includes('请输入 dashboard secret 后继续'),
        finalURL: page.url(),
        api,
        ws,
        interestingResponses,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

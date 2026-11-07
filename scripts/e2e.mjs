#!/usr/bin/env node
/**
 * 浏览器级 E2E 冒烟：登录 → 新建文档 → 双用户实时协同 → 在线状态 → 刷新持久化。
 *
 * 前置：本机安装 Google Chrome；首次运行前 pnpm install（含 playwright-core）。
 * 运行：pnpm test:e2e
 * 服务未启动时脚本会自行拉起 `pnpm dev:server` / `pnpm dev`，结束后回收。
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.E2E_API_URL ?? 'http://localhost:3000';
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:8001';
const HEADLESS = process.env.E2E_HEADLESS !== '0';

const spawned = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function isUp(url, init) {
  try {
    const res = await fetch(url, init);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitFor(label, check, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(500);
  }
  throw new Error(`${label} 未在 ${timeoutMs}ms 内就绪`);
}

function runScript(args) {
  const child = spawn('pnpm', args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  spawned.push(child);
  return child;
}

async function ensureServer() {
  const login = () =>
    isUp(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });

  if (await login()) return;
  console.log('[e2e] 启动后端 :3000/:3001 …');
  runScript(['--filter', '@collab/server', 'start:dev']);
  await waitFor('后端', login);
}

async function ensureWeb() {
  const up = () => isUp(WEB);
  if (await up()) return;
  console.log('[e2e] 启动前端 :8001 …');
  runScript(['--filter', '@collab/web', 'dev']);
  await waitFor('前端', up);
}

async function login(page, username, password) {
  await page.goto(`${WEB}/user/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#username', { timeout: 30_000 });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL('**/docs', { timeout: 30_000 }),
    // antd ProForm 的登录按钮不是 type=submit
    page.click('.ant-btn-primary'),
  ]);
}

async function waitEditor(page) {
  await page.waitForSelector('.ProseMirror', { state: 'visible', timeout: 30_000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('.doc-editor__header')
        ?.textContent?.includes('已连接') ?? false,
    undefined,
    { timeout: 30_000 },
  );
}

async function expectEditorText(page, text, timeout = 30_000) {
  await page.waitForFunction(
    (needle) =>
      document.querySelector('.ProseMirror')?.textContent?.includes(needle) ?? false,
    text,
    { timeout },
  );
}

async function main() {
  await ensureServer();
  await ensureWeb();

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: HEADLESS,
  });

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const a = await contextA.newPage();
  const b = await contextB.newPage();

  let docId = '';
  let adminToken = '';

  try {
    console.log('[e2e] 1/5 登录并新建文档');
    await login(a, 'admin', 'admin123');
    adminToken = await a.evaluate(() => localStorage.getItem('token') ?? '');
    assert.ok(adminToken, '登录后应写入 token');

    await a.click('button:has-text("新建文档")');
    await a.waitForURL(/\/docs\/[^/]+$/, { timeout: 30_000 });
    docId = a.url().split('/').pop() ?? '';
    assert.ok(docId, '新建文档后 URL 应包含文档 ID');
    await waitEditor(a);

    console.log('[e2e] 2/5 第二用户打开同一文档');
    await login(b, 'alice', 'alice123');
    await b.goto(`${WEB}/docs/${docId}`, { waitUntil: 'domcontentloaded' });
    await waitEditor(b);

    console.log('[e2e] 3/5 双向实时协同');
    const textA = `E2E-A-${Date.now()}`;
    const textB = `E2E-B-${Date.now()}`;

    await a.locator('.ProseMirror').click();
    await a.keyboard.type(textA);
    await expectEditorText(b, textA);

    await b.locator('.ProseMirror').click();
    await b.keyboard.type(textB);
    await expectEditorText(a, textB);

    console.log('[e2e] 4/5 在线状态');
    await a.waitForFunction(
      () =>
        document.querySelectorAll(
          '.doc-editor__header .ant-avatar-group .ant-avatar',
        ).length >= 1,
      undefined,
      { timeout: 20_000 },
    );

    console.log('[e2e] 5/5 刷新后内容持久化');
    await b.reload({ waitUntil: 'domcontentloaded' });
    await waitEditor(b);
    await expectEditorText(b, textA);
    await expectEditorText(b, textB);

    console.log('PASS: 浏览器 E2E 全部断言通过');
  } finally {
    await contextA.close().catch(() => {});
    await contextB.close().catch(() => {});
    await browser.close().catch(() => {});

    // 清理测试文档，避免污染开发库
    if (docId && adminToken) {
      try {
        await fetch(`${API}/api/docs/${docId}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${adminToken}` },
        });
      } catch {
        /* 清理失败不影响测试结论 */
      }
    }
  }
}

main()
  .catch((err) => {
    console.error('FAIL:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const child of spawned) {
      if (!child.killed) child.kill('SIGTERM');
    }
  });

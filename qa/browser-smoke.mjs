import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {mkdir} from 'node:fs/promises';

const {chromium} = createRequire(process.env.PLAYWRIGHT_PACKAGE_ROOT + '/package.json')('playwright');
const site = 'https://phurinutprotron-droid.github.io/learning-bottleneck-analyzer/';
const api = 'https://lba-api.lba-phurinut.workers.dev';
const suffix = process.env.GITHUB_RUN_ID + '_' + process.env.GITHUB_RUN_ATTEMPT;
const handle = 'qa_browser_' + suffix;
const password = randomBytes(24).toString('base64url');
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.name));
let session;
await mkdir('browser-artifacts', {recursive: true});
try {
  await page.goto(site + '?qa=' + suffix, {waitUntil: 'networkidle', timeout: 60000});
  await page.getByRole('button', {name: /New learner|นักเรียนใหม่/}).click();
  await page.locator('input[name="handle"]').fill(handle);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('select[name="grade"]').selectOption('7');
  const registration = page.waitForResponse(response => response.url() === api + '/api/auth/register' && response.request().method() === 'POST', {timeout: 60000});
  const subjects = page.waitForResponse(response => response.url() === api + '/api/subjects', {timeout: 60000});
  const profile = page.waitForResponse(response => response.url().startsWith(api + '/api/students/') && response.request().method() === 'GET', {timeout: 60000});
  await page.locator('form button.primary').click();
  const registered = await registration;
  assert.equal(registered.status(), 201, 'Browser registration must reach the configured backend');
  session = await registered.json();
  assert.equal((await subjects).status(), 200, 'Browser subject request failed');
  assert.equal((await profile).status(), 200, 'Browser profile request failed');
  await page.locator('.app-shell').waitFor({state: 'visible', timeout: 60000});
  assert.equal(errors.length, 0, 'Unexpected browser runtime errors');
  assert.equal((await page.locator('body').innerText()).includes('Backend is not configured'), false);
  await page.screenshot({path: 'browser-artifacts/student-home-desktop-synthetic.png', fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  await page.waitForTimeout(250);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile page overflows horizontally');
  await page.screenshot({path: 'browser-artifacts/student-home-mobile-synthetic.png', fullPage: true});
  console.log('Live Pages browser registration, CORS, dashboard rendering and mobile layout passed');
} finally {
  try {
    const cleanup = await page.evaluate(async ({api, session, handle, password}) => {
      if (!session) {
        const login = await fetch(api + '/api/auth/login/student', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({handle, password})});
        if (!login.ok) return {created: false};
        session = await login.json();
      }
      const response = await fetch(api + '/api/students/' + session.user.student_id, {method: 'DELETE', headers: {Authorization: 'Bearer ' + session.access_token}});
      return {created: true, status: response.status};
    }, {api, session, handle, password});
    if (cleanup.created) assert.equal(cleanup.status, 204, 'Synthetic browser account cleanup failed');
    console.log('Synthetic browser account cleanup completed');
  } finally { await browser.close(); }
}

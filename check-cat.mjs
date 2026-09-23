import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
let schema = null;
page.on('response', async res => {
  if (res.url().includes('parameter-schema')) {
    try { schema = await res.json(); } catch {}
  }
});
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(1500);
const s = await page.$('button:has-text("Sign In")');
if (s) { await s.click(); await page.waitForTimeout(4000); }
const u = await page.$('input[name="username"], input#username, input[type="text"]');
const p = await page.$('input[type="password"]');
if (u && p) { await u.fill('admin'); await p.fill('admin'); const b = await page.$('button:has-text("Sign In")'); if (b) await b.click(); await page.waitForTimeout(6000); }
await page.goto('http://localhost:3000/create/templates/default/train-track-register', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(6000);
console.log('SCHEMA STEPS:', JSON.stringify((schema?.steps || []).map(s => s.title)));
await browser.close();

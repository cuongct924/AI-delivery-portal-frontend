import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const failed = [];
page.on('response', r => { if (r.status() >= 400 && r.url().includes('/costs')) failed.push(r.status() + ' ' + r.url()); });
await page.goto('http://localhost:3000/cost-insights', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(1500);
const signIn = await page.$('button:has-text("Sign In")');
if (signIn) { await signIn.click(); await page.waitForTimeout(4000); }
const user = await page.$('input[name="username"], input#username, input[type="text"]');
const pass = await page.$('input[type="password"]');
if (user && pass) { await user.fill('admin'); await pass.fill('admin'); const s = await page.$('button:has-text("Sign In")'); if (s) await s.click(); await page.waitForTimeout(6000); }
await page.goto('http://localhost:3000/cost-insights', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(6000);
const body = await page.textContent('body').catch(()=> '');
console.log('BODY:', (body||'').slice(0,1600));
console.log('--- FAILED COST REQS ---');
console.log([...new Set(failed)].slice(0,10).join('\n') || 'none');
await browser.close();

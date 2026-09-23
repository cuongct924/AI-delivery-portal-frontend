import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('response', r => { if (r.url().includes('/datasets')) console.log('HTTP', r.status(), r.url()); });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(1500);
const s = await page.$('button:has-text("Sign In")');
if (s) { await s.click(); await page.waitForTimeout(4000); }
const u = await page.$('input[name="username"], input#username, input[type="text"]');
const p = await page.$('input[type="password"]');
if (u && p) { await u.fill('admin'); await p.fill('admin'); const b = await page.$('button:has-text("Sign In")'); if (b) await b.click(); await page.waitForTimeout(6000); }
await page.goto('http://localhost:3000/create/templates/default/train-track-register', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(6000);
// fill useCase
await (await page.$('#root_useCase')).click(); await page.waitForTimeout(800);
await (await page.$('li[role="option"]:has-text("telco-fraud-detection")')).click(); await page.waitForTimeout(800);
// Next to Architecture, Next to Dataset
for (let i=0;i<2;i++){ const n=await page.$('button:has-text("Next")'); await n.click({force:true}); await page.waitForTimeout(2500); }
const body = await page.$eval('body', el => el.innerText);
const i = body.indexOf('DATASET & TASK');
console.log('DATASET STEP:\n', body.slice(i, i+700));
await browser.close();

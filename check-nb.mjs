import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(1500);
const s = await page.$('button:has-text("Sign In")');
if (s) { await s.click(); await page.waitForTimeout(4000); }
const u = await page.$('input[name="username"], input#username, input[type="text"]');
const p = await page.$('input[type="password"]');
if (u && p) { await u.fill('admin'); await p.fill('admin'); const b = await page.$('button:has-text("Sign In")'); if (b) await b.click(); await page.waitForTimeout(6000); }
await page.goto('http://localhost:3000/create/templates/default/train-track-register', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(6000);
let body = await page.$eval('body', el => el.innerText);
console.log('STEP1 platform has Environment:', body.includes('Environment'));
// select AI Notebook
await (await page.$('#root_trainingMode')).click(); await page.waitForTimeout(800);
await (await page.$('li[role="option"]:has-text("AI Notebook")')).click(); await page.waitForTimeout(2000);
body = await page.$eval('body', el => el.innerText);
console.log('STEP1 notebook has Environment:', body.includes('Environment'));
console.log('STEP1 notebook has CPU cores:', body.includes('CPU cores'));
console.log('STEP1 notebook has Auto-shutdown:', body.includes('Auto-shutdown'));
console.log('STEP1 notebook has Model category:', body.includes('Model category'));
console.log('STEPS:', JSON.stringify(body.match(/\n\d\n[A-Z][^\n]*/g)));
await browser.close();

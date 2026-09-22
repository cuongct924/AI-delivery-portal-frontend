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
await page.goto('http://localhost:3000/docs/default/system/ai-delivery-portal', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(12000);
const els = await page.$$eval('a,button', els => els.map(e => e.tagName+':'+(e.textContent||'').trim().slice(0,30)).filter(t=>t.length>4));
console.log('ELS:', JSON.stringify(els.slice(0,20)));
const link = await page.$('a:has-text("Show Build Logs")');
if (link) { const href = await link.getAttribute('href'); console.log('HREF:', href); }
await browser.close();

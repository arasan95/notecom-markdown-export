const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function main() {
  const url = process.argv[2] || 'https://note.com/koji_doi/n/n50481d881c2f';
  console.log('fetch:', url);
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.9' },
  });
  const html = await res.text();
  console.log('HTML size:', html.length, 'bytes');

  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const ctx = dom.getInternalVMContext();

  const downloads = [];
  dom.window.GM_download = (opts) => downloads.push({ ...opts });
  dom.window.setTimeout = (fn) => { fn(); return 0; };

  const src = fs.readFileSync(path.join(__dirname, '..', 'notecom-export.user.js'), 'utf8');
  vm.runInContext(src, ctx, { filename: 'userscript.js' });

  const btn = dom.window.document.querySelector('#notecom-export-btn');
  if (!btn) { console.error('FAIL: button not found'); process.exit(1); }
  btn.click();

  const status = dom.window.document.querySelector('#notecom-export-status');
  console.log('status:', status ? status.textContent : '(none)');

  const md = downloads.find(d => d.name.endsWith('.md'));
  if (!md) { console.error('FAIL: markdown not downloaded'); console.log(downloads.map(d=>d.name)); process.exit(1); }
  const rel = md.name.indexOf('notecom/') === 0 ? md.name.slice('notecom/'.length) : '';
  if (md.name.indexOf('notecom/') !== 0 || !rel || rel.indexOf('/') !== -1) {
    console.error('FAIL: Markdown should be directly under notecom/: ' + md.name);
    process.exit(1);
  }
  console.log('OK 保存先は notecom/ 直下');
  console.log('--- 保存先 ---');
  console.log(md.name);
  downloads.filter(d => d.name !== md.name).forEach(d => console.log(d.name));

  const content = decodeURIComponent(md.url.split(',')[1]);
  console.log('--- Markdown 内容 ---');
  console.log(content);
  console.log('--- 検証 ---');
  const checks = [
    [/^title: "/m, 'frontmatter: title'],
    [/^date: 20\d\d-\d\d-\d\d$/m, 'frontmatter: date'],
    [/^author: /m, 'frontmatter: author'],
    [/^url: /m, 'frontmatter: url'],
    [/^source: note\.com$/m, 'frontmatter: source'],
    [/!\[.*\]\([^/]+-image-\d+\.\w+\)/, '画像の相対パス'],
  ];
  let ok = true;
  for (const [re, name] of checks) {
    const pass = re.test(content);
    console.log((pass ? 'OK ' : 'NG ') + name);
    if (!pass) ok = false;
  }
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });

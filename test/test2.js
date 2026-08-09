const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

async function run(html, url) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const ctx = dom.getInternalVMContext();
  const downloads = [];
  dom.window.GM_download = (o) => { downloads.push({ ...o }); if (o.onload) o.onload(); };
  dom.window.GM_xmlhttpRequest = (o) => {
    o.onload({ status: 200, response: new Uint8Array([137, 80, 78, 71]).buffer });
  };
  const src = fs.readFileSync(path.join(__dirname, '..', 'notecom-export.user.js'), 'utf8');
  vm.runInContext(src, ctx, { filename: 'userscript.js' });
  const btn = dom.window.document.querySelector('#notecom-export-btn');
  if (!btn) { throw new Error('button not found'); }
  btn.click();
  await new Promise(r => setTimeout(r, 0));
  const status = dom.window.document.querySelector('#notecom-export-status');
  const md = downloads.find(d => d.name.endsWith('.md'));
  return { status: status.textContent, md, imgs: downloads.filter(d => !d.name.endsWith('.md')) };
}

async function main() {
  let ok = true;
  const html = `<!DOCTYPE html><html><head>
<meta property="og:title" content="テスト記事｜太郎">
<meta name="author" content="太郎">
</head><body>
<h1 class="o-noteContentHeader__title">テスト記事</h1>
<time datetime="2024-01-15T10:00:00+09:00">2024年1月15日</time>
<a href="https://note.com/hashtag/技術">#技術</a>
<a href="https://note.com/hashtag/メモ">#メモ</a>
<div class="note-common-styles__textnote-body">
  <h2>コード</h2>
  <pre><code>function hello() {\n  return "world";\n}</code></pre>
  <blockquote><p>引用</p></blockquote>
  <ul><li>項目1</li></ul>
  <ol><li>手順A</li></ol>
  <table><thead><tr><th>列</th></tr></thead><tbody><tr><td>値</td></tr></tbody></table>
  <figure><img data-src="https://assets.st-note.com/production/uploads/images/1/picture_pc_abc.png?width=800" alt="スクショ"></figure>
  <p>空リンクのテスト: <a href="https://example.com/icon"></a>終わり</p>
  <p>前</p>
  <p></p>
  <p></p>
  <p></p>
  <p>後</p>
  <iframe src="https://www.youtube.com/embed/xxxx"></iframe>
</div>
</body></html>`;

  const r = await run(html, 'https://note.com/taro/n/na1b2c3d4e5f6');
  console.log('status:', r.status);
  console.log('downloads:', r.imgs.length ? r.imgs.map(i => i.name).join(', ') : '(md only)');
  if (r.md.name !== 'notecom/テスト記事.md') {
    console.log('NG 保存先: ' + r.md.name);
    ok = false;
  } else {
    console.log('OK 保存先 notecom/テスト記事.md');
  }
  if (r.imgs.length !== 0) {
    console.log('NG 画像ファイルがダウンロードされている');
    ok = false;
  } else {
    console.log('OK 画像ファイルの個別ダウンロードなし');
  }
  const c = decodeURIComponent(r.md.url.split(',')[1]);
  console.log('--- md (先頭のみ) ---');
  console.log(c.split('\n').slice(0, 12).join('\n'));
  const checks = [
    [/^tags: \["技術", "メモ"\]$/m, 'タグ抽出'],
    [/^date: 2024-01-15$/m, '日付'],
    [/^author: "太郎"$/m, '著者'],
    [/```\s*\nfunction hello\(\)/, 'コードブロック'],
    [/^> 引用$/m, '引用'],
    [/^-\s+項目1$/m, 'ul'],
    [/^1\.\s+手順A$/m, 'ol'],
    [/\| 列 \|/, 'テーブル'],
    [/!\[スクショ\]\(data:image\/png;base64,/, '画像のbase64埋め込み'],
  ];
  for (const [re, name] of checks) {
    const pass = re.test(c);
    console.log((pass ? 'OK ' : 'NG ') + name);
    if (!pass) ok = false;
  }
  // 空リンク除去チェック
  if (/\[\]\(/.test(c)) { console.log('NG 空リンク残存'); ok = false; } else console.log('OK 空リンクなし');
  // 空行圧縮: 3連続改行がないこと
  if (/\n{3,}/.test(c)) { console.log('NG 空行圧縮'); ok = false; } else console.log('OK 空行圧縮');

  // サニタイズケース: タイトルに / と : を含む
  const html2 = `<!DOCTYPE html><html><head>
<meta property="og:title" content="3/4 メモ: 詳細｜太郎">
</head><body>
<h1 class="o-noteContentHeader__title">3/4 メモ: 詳細</h1>
<time datetime="2024-01-15T10:00:00+09:00">2024年1月15日</time>
<div class="note-common-styles__textnote-body">
  <p>本文</p>
</div>
</body></html>`;
  const r3 = await run(html2, 'https://note.com/taro/n/na1b2c3d4e5f7');
  console.log('sanitized md name:', r3.md.name);
  if (r3.md.name !== 'notecom/3_4 メモ_ 詳細.md') {
    console.log('NG サニタイズ: ' + r3.md.name);
    ok = false;
  } else {
    console.log('OK サニタイズ: 3/4 メモ: 詳細 -> 3_4 メモ_ 詳細');
  }

  // エラーパス: 本文なし
  const r2 = await run('<!DOCTYPE html><html><body><h1>a</h1></body></html>', 'https://note.com/x/n/n123456789abc');
  console.log('error path status:', r2.status);
  if (!/エラー/.test(r2.status)) { console.log('NG エラーパス'); ok = false; } else console.log('OK エラーパス');

  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('NG throw:', e); process.exit(1); });

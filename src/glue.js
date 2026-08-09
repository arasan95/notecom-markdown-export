
/* ================================================================
 * note.com専用の抽出・変換・ダウンロード部分（本スクリプト独自実装）
 * ================================================================ */
(function () {
  'use strict';

  var DL_ROOT = 'notecom';

  function sanitizeFilename(title) {
    return String(title || '')
      .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_')
      .replace(/^\s+|\s+$/g, '')
      .replace(/\.+$/, '')
      .slice(0, 100);
  }

  function q(sel, el) { return (el || document).querySelector(sel); }
  function qa(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

  function metaContent(prop) {
    var el = q('meta[property="' + prop + '"]') || q('meta[name="' + prop + '"]');
    return el ? (el.content || '').trim() : '';
  }

  function getExt(src) {
    var path = src.split('?')[0];
    var m = path.match(/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i);
    if (m) return m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
    return 'jpg';
  }

  function escYaml(v) {
    return String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function extractArticle() {
    var url = location.href;
    var ogTitle = metaContent('og:title');

    var title = '';
    var h1 = q('h1.o-noteContentHeader__title');
    if (h1) title = h1.textContent.trim();
    if (!title && ogTitle) title = ogTitle.split('｜')[0].trim();

    var author = metaContent('author');
    if (!author && ogTitle) {
      var parts = ogTitle.split('｜');
      if (parts.length >= 2) author = parts[1].trim();
    }

    var date = '';
    var timeEl = q('time[datetime]');
    if (timeEl) date = (timeEl.getAttribute('datetime') || '').trim().slice(0, 10);
    if (!date) {
      var pub = metaContent('article:published_time');
      if (pub) date = pub.slice(0, 10);
    }

    var tags = [];
    qa('a[href*="/hashtag/"]').forEach(function (a) {
      var t = a.textContent.trim().replace(/^#/, '');
      if (t && tags.indexOf(t) < 0) tags.push(t);
    });
    if (!tags.length) {
      var kw = metaContent('keywords');
      if (kw) kw.split(/[,，]/).forEach(function (s) {
        s = s.trim();
        if (s && tags.indexOf(s) < 0) tags.push(s);
      });
    }

    var bodyEl = q('.note-common-styles__textnote-body') || q('.t-content') || q('.o-noteContentText');
    if (!bodyEl) throw new Error('記事本文が取得できませんでした。note.comの記事ページでお試しください');

    var m = url.match(/\/n\/([0-9A-Za-z]{8,})/);
    var noteId = m ? m[1] : 'note' + Date.now();
    var slug = (date ? date + '-' : '') + noteId;
    var safeTitle = sanitizeFilename(title) || slug;

    return { url: url, title: title, author: author, date: date, tags: tags, bodyEl: bodyEl, slug: slug, safeTitle: safeTitle };
  }

  function buildMarkdown(article, bodyMd) {
    var out = [];
    out.push('---');
    out.push('title: "' + escYaml(article.title) + '"');
    if (article.date) out.push('date: ' + article.date);
    if (article.author) out.push('author: "' + escYaml(article.author) + '"');
    if (article.tags.length) {
      out.push('tags: [' + article.tags.map(function (t) { return '"' + escYaml(t) + '"'; }).join(', ') + ']');
    }
    out.push('url: ' + article.url);
    out.push('source: note.com');
    out.push('---');
    out.push('');
    out.push(bodyMd);
    return out.join('\n');
  }

  function render(article) {
    var clone = article.bodyEl.cloneNode(true);
    var images = [];
    qa('img', clone).forEach(function (img) {
      var src = img.getAttribute('data-src') || img.getAttribute('src') || img.getAttribute('data-modal-image-src') || '';
      if (!src) return;
      if (src.indexOf('//') === 0) src = 'https:' + src;
      if (!/^https?:/.test(src)) return;
      var file = article.safeTitle + '-image-' + (images.length + 1) + '.' + getExt(src);
      images.push({ src: src, file: file });
      img.setAttribute('src', file);
    });

    var td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
    if (typeof turndownPluginGfm !== 'undefined') td.use(turndownPluginGfm.gfm);
    var bodyMd = td.turndown(clone);
    bodyMd = bodyMd
      .replace(/(?<!!)\[\]\([^)]*\)/g, '')
      .replace(/\n{3,}/g, '\n\n');

    return { md: buildMarkdown(article, bodyMd), images: images, slug: article.slug, safeTitle: article.safeTitle };
  }

  function downloadAll(safeTitle, md, images) {
    var base = DL_ROOT + '/';
    var failed = 0;
    var failList = [];
    var i;
    for (i = 0; i < images.length; i++) {
      (function (im, idx) {
        setTimeout(function () {
          try {
            GM_download({
              url: im.src,
              name: base + im.file,
              saveAs: false,
              onload: function () { },
              onerror: function () {
                failed++;
                failList.push(im.file);
                console.warn('[notecom] 画像DL失敗:', im.file, im.src);
                setStatus('画像DL失敗: ' + im.file + '（' + failed + '/' + images.length + ' 枚目）', true);
              }
            });
          } catch (e) {
            failed++;
            failList.push(im.file);
            console.warn('[notecom] 画像DL失敗', im.src, e);
            setStatus('画像DL失敗: ' + im.file, true);
          }
        }, idx * 400);
      })(images[i], i);
    }
    setTimeout(function () {
      var dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md);
      GM_download({
        url: dataUrl,
        name: base + safeTitle + '.md',
        saveAs: false,
        onerror: function (e) {
          console.warn('[notecom] Markdown保存失敗', e);
          setStatus('Markdownの保存に失敗しました', true);
        },
        onload: function () {
          if (failed > 0) {
            setStatus('保存しました（画像 ' + failed + ' 枚失敗: ' + failList.join(', ') + '）', true);
          } else {
            setStatus('保存しました: ' + safeTitle + '（画像 ' + images.length + ' 枚）');
          }
        }
      });
    }, images.length * 400 + 300);
  }

  var statusEl = null;
  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.background = isError ? '#e53935' : '#43a047';
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(function () { statusEl.style.opacity = '0'; }, 5000);
  }

  function init() {
    var btn = document.createElement('button');
    btn.id = 'notecom-export-btn';
    btn.textContent = '⇩ note.md';
    btn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;padding:10px 16px;font-size:14px;font-weight:bold;background:#2ea8ff;color:#fff;border:none;border-radius:8px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);font-family:sans-serif;';
    statusEl = document.createElement('div');
    statusEl.id = 'notecom-export-status';
    statusEl.style.cssText = 'position:fixed;bottom:72px;right:24px;z-index:2147483647;padding:8px 12px;font-size:12px;color:#fff;background:#43a047;border-radius:6px;opacity:0;transition:opacity .4s;font-family:sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.2);';

    btn.addEventListener('click', function () {
      statusEl.style.opacity = '1';
      try {
        var article = extractArticle();
        var result = render(article);
        setStatus('保存を開始しました: ' + result.safeTitle + '（画像 ' + result.images.length + ' 枚）…');
        downloadAll(result.safeTitle, result.md, result.images);
      } catch (e) {
        setStatus('エラー: ' + e.message, true);
        console.error('[notecom]', e);
      }
    });

    document.body.appendChild(btn);
    document.body.appendChild(statusEl);
  }

  if (document.body) {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
})();

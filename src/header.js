// ==UserScript==
// @name         note.com Markdownエクスポート（notecomフォルダへ保存）
// @namespace    kf.notecom-export
// @version      0.2.0
// @description  note.comの記事をMarkdown＋画像としてタイトル名でダウンロードフォルダの notecom/ 直下に保存する（YAMLフロントマター付き）
// @author       kf
// @license      MIT
// @homepageURL  https://github.com/arasan95/notecom-markdown-export
// @supportURL   https://github.com/arasan95/notecom-markdown-export/issues
// @downloadURL  https://raw.githubusercontent.com/arasan95/notecom-markdown-export/main/notecom-export.user.js
// @updateURL    https://raw.githubusercontent.com/arasan95/notecom-markdown-export/main/notecom-export.user.js
// @match        https://note.com/*
// @grant        GM_download
// @run-at       document-idle
// @noframes
// ==/UserScript==
/* 変換エンジン: Turndown (https://github.com/mixmark-io/turndown) MIT License
   GFMプラグイン: turndown-plugin-gfm (https://github.com/mixmark-io/turndown-plugin-gfm) MIT License
   ※下記 Turndown 系コードは上記の MIT ライセンスで配布されているライブラリの埋め込みです */

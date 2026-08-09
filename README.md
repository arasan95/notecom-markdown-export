# note.com Markdownエクスポート (notecom-markdown-export)

note.com の記事ページを開いた状態で、右下に表示される「⇩ note.md」ボタンを押すと、記事を Markdown（YAMLフロントマター付き）と画像として保存する UserScript です。

## 保存される内容

ダウンロードフォルダの `notecom/` 直下に、記事タイトルをファイル名とした単一の Markdown ファイルとして保存します。
記事内の画像は base64 で Markdown に埋め込まれるため、画像ファイルはダウンロードされず、`.md` 1つで完結します。

```
notecom/
└── 記事タイトル.md
```

Markdown 内の画像は次のように埋め込まれます。

```markdown
![画像の説明](data:image/png;base64,....)
```

Markdown には次の YAML フロントマターが付与されます。

- `title` / `date` / `author` / `tags` / `url` / `source`

ファイル名に使えない文字（`\ / : * ? " < > |` など）は `_` に置き換えられ、100文字に切り詰められます。

## インストール

- [Greasy Fork](https://greasyfork.org/) または [GitHub のリリースページ](../../releases) から `notecom-export.user.js` を入手
- Tampermonkey などの UserScript マネージャーに追加
- note.com の記事ページを開き、右下の「⇩ note.md」ボタンをクリック

## 開発

```sh
./build.sh                 # src/ の部品から notecom-export.user.js を再構築
node test/test2.js         # 変換・保存先のユニット検証（jsdom が必要）
node test/e2e.js           # 実サイトを使ったエンドツーエンド検証
```

`src/` の構成は以下の通りです。

- `src/header.js` - UserScript のメタデータ
- `src/glue.js` - note.com の抽出・変換・ダウンロード処理
- `src/turndown.js`, `src/turndown-plugin-gfm.js` - HTML を Markdown に変換する組み込みライブラリ

## ライセンス

MIT License。組み込みの Turndown / turndown-plugin-gfm は各ライブラリの MIT License に従います。

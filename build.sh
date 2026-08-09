#!/bin/sh
# notecom-export.user.js を src/ 配下の部品から再構築する
# 使い方: ./build.sh   →  同ディレクトリに notecom-export.user.js を生成
set -e
cd "$(dirname "$0")"
cat src/header.js src/turndown.js src/turndown-plugin-gfm.js src/glue.js > notecom-export.user.js
echo "built: $(pwd)/notecom-export.user.js"

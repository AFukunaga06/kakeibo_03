#!/bin/bash

echo "🔐 セキュア家計簿アプリ - 起動スクリプト"
echo "================================"

# Node.jsのバージョンチェック
if ! command -v node &> /dev/null; then
    echo "❌ Node.jsがインストールされていません"
    echo "Node.js 14以上をインストールしてください: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "❌ Node.js のバージョンが古すぎます (現在: $(node -v))"
    echo "Node.js 14以上が必要です"
    exit 1
fi

echo "✅ Node.js バージョン: $(node -v)"

# npm依存関係のインストール
if [ ! -d "node_modules" ]; then
    echo "📦 依存関係をインストール中..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依存関係のインストールに失敗しました"
        exit 1
    fi
else
    echo "✅ 依存関係は既にインストール済み"
fi

# 環境変数の設定（オプション）
if [ -f ".env" ]; then
    echo "🔧 環境変数を読み込み中..."
    export $(grep -v '^#' .env | xargs)
fi

# Azure環境でのデータディレクトリ作成
if [ -n "$WEBSITE_SITE_NAME" ] || [ -n "$APPSETTING_WEBSITE_SITE_NAME" ]; then
    echo "☁️ Azure環境を検出しました"
    echo "📁 データディレクトリを準備中..."
    mkdir -p /home/data
    DB_PATH="/home/data/kakeibo.db"
else
    DB_PATH="./kakeibo.db"
fi

# データベースの確認
if [ -f "$DB_PATH" ]; then
    echo "📊 既存のデータベースを使用します: $DB_PATH"
else
    echo "📊 新しいデータベースを作成します: $DB_PATH"
fi

echo ""
echo "🚀 サーバーを起動しています..."
echo "📍 URL: http://localhost:${PORT:-3000}"
echo "🔐 デフォルトパスワード: r246"
echo ""
echo "終了するには Ctrl+C を押してください"
echo ""

# サーバー起動
npm start
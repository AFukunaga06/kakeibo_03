# 🔐 セキュア家計簿アプリ v2.0

**サーバーサイド認証・セッション管理・データベース永続化対応版**

## 🛡️ セキュリティ機能

### ✅ **実装済みセキュリティ対策**
- **サーバーサイド認証**: パスワードはサーバーでハッシュ化して保存
- **セッション管理**: 30分でのタイムアウト、HTTPOnlyクッキー
- **Rate limiting**: ログイン試行制限（15分間で5回まで）
- **CSRF対策**: セッション管理による保護
- **SQLインジェクション対策**: パラメータ化クエリ使用
- **セキュリティヘッダー**: Helmet.jsによる各種ヘッダー設定

### 🔒 **クライアントサイド版との違い**
| 項目 | クライアント版 | セキュア版 |
|------|---------------|------------|
| パスワード保存 | 平文でJavaScriptに記載 | bcryptでハッシュ化してDB保存 |
| 認証チェック | ブラウザ側で実行 | サーバー側で検証 |
| データ保存 | localStorage（丸見え） | SQLiteデータベース |
| セッション管理 | なし | Express-session |
| 第三者アクセス | 容易に可能 | **困難** |

## 🚀 起動方法

### **1. 必要環境**
- Node.js 14以上
- npm パッケージマネージャー

### **2. 簡単起動（推奨）**
```bash
# 起動スクリプトを実行
./start.sh
```

### **3. 手動起動**
```bash
# 依存関係をインストール
npm install

# サーバー起動
npm start

# 開発モード（nodemon使用）
npm run dev
```

### **4. アクセス**
```
http://localhost:3000
```

## 🔑 認証情報

### **デフォルトパスワード**
```
r246
```

### **パスワード変更方法**
データベースで直接変更するか、管理用APIを追加実装してください。

## 📊 データ管理

### **データベース**
- **ファイル**: `kakeibo.db`（SQLite）
- **テーブル**: 
  - `users`: ユーザー情報
  - `expenses`: 支出データ

### **バックアップ**
```bash
# データベースをバックアップ
cp kakeibo.db kakeibo.db.backup

# 復元
cp kakeibo.db.backup kakeibo.db
```

## 🌐 本番環境での使用

### **環境変数設定**
`.env` ファイルを作成：
```env
PORT=3000
SESSION_SECRET=your-super-secret-key-here-change-this
NODE_ENV=production
```

### **HTTPS化（重要）**
本番環境では必ずHTTPSを使用してください：
- SSL証明書の設定
- `cookie.secure = true` に変更

### **追加セキュリティ対策**
```javascript
// server.js の session設定で
cookie: {
    secure: true,      // HTTPS必須
    sameSite: 'strict', // CSRF対策強化
    maxAge: 15 * 60 * 1000  // セッション時間短縮
}
```

## 📁 ファイル構成

```
kakeibo_03/
├── server.js              # Express.jsサーバー
├── package.json            # npm設定
├── start.sh               # 起動スクリプト
├── views/
│   └── index.html         # メインページ
├── kakeibo.db             # SQLiteデータベース（起動後作成）
└── README-secure.md       # このファイル
```

## 🔧 開発・カスタマイズ

### **API エンドポイント**
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト  
- `GET /api/auth/status` - 認証状態確認
- `GET /api/expenses` - 支出データ取得
- `POST /api/expenses` - 支出データ作成
- `PUT /api/expenses/:id` - 支出データ更新
- `DELETE /api/expenses/:id` - 支出データ削除

### **データベーススキーマ**
```sql
-- ユーザーテーブル
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 支出テーブル  
CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    item_name TEXT,
    store TEXT,
    amount INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## ⚠️ 制限事項

1. **シングルユーザー**: 現在は1ユーザーのみ対応
2. **マルチテナント未対応**: 複数の家計を管理不可
3. **ファイルアップロード**: レシート画像等の添付機能なし
4. **データエクスポート**: CSV出力等は未実装

## 🔍 トラブルシューティング

### **サーバーが起動しない**
```bash
# ポート使用状況確認
lsof -i :3000

# 他のポートで起動
PORT=3001 npm start
```

### **認証エラー**
- ブラウザのキャッシュをクリア
- セッションクッキーを削除
- サーバーを再起動

### **データベースエラー**
```bash
# データベースファイル権限確認
ls -la kakeibo.db

# 権限修正
chmod 664 kakeibo.db
```

## 📞 サポート

### **ログ確認**
サーバーのコンソール出力でエラーを確認してください。

### **セキュリティ報告**
セキュリティ上の問題を発見した場合は、責任を持って報告してください。

---

**🔐 このセキュア版は本番環境での使用に適しています！**
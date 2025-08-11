# 🚀 Azure App Service デプロイ手順

セキュア家計簿アプリをAzure App Serviceにデプロイする手順です。

## 📋 **前提条件**

- Azureアカウント（無料アカウントでもOK）
- GitHubアカウント
- Azure CLI（オプション）

## 🔧 **手順1: Azure App Service作成**

### **Azure Portalでの作成**

1. **Azure Portal**にログイン: https://portal.azure.com
2. **「App Services」** を検索して選択
3. **「作成」** → **「Web App」** を選択
4. **基本設定**:
   - **リソースグループ**: 新規作成 `kakeibo-rg`
   - **名前**: `kakeibo-secure-app`（任意の一意な名前）
   - **ランタイムスタック**: `Node 18 LTS`
   - **オペレーティングシステム**: `Linux`
   - **リージョン**: `Japan East`
   - **価格プラン**: `Basic B1`（または`Free F1`）

5. **「確認および作成」** → **「作成」**

## 🔗 **手順2: GitHubからのデプロイ設定**

### **継続的デプロイメント設定**

1. **作成したApp Service**を開く
2. **左メニュー**: **「デプロイセンター」** を選択
3. **ソース**: **「GitHub」** を選択
4. **GitHubアカウント**でサインイン
5. **リポジトリ設定**:
   - **組織**: あなたのGitHubアカウント
   - **リポジトリ**: `kakeibo_03`
   - **ブランチ**: `main`
6. **ビルドプロバイダー**: **「App Service ビルドサービス」** を選択
7. **「保存」** をクリック

## ⚙️ **手順3: 環境変数設定**

### **アプリケーション設定**

1. **App Service** → **左メニュー** → **「構成」**
2. **「新しいアプリケーション設定」** をクリック
3. **以下の設定を追加**:

| 名前 | 値 |
|------|-----|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | `your-super-secret-key-change-this-12345` |
| `PORT` | `8080` |

4. **「保存」** をクリック
5. **アプリを再起動**

## 🔒 **手順4: セキュリティ設定**

### **HTTPS強制**

1. **App Service** → **左メニュー** → **「TLS/SSL設定」**
2. **「HTTPS のみ」** を **「オン」** に設定
3. **「保存」**

### **カスタムドメイン（オプション）**

1. **App Service** → **左メニュー** → **「カスタムドメイン」**
2. **独自ドメイン**を設定可能

## 📊 **手順5: データベース永続化**

### **Azure Files（推奨）**

SQLiteファイルを永続化するため：

1. **ストレージアカウント**を作成
2. **ファイル共有**を作成
3. **App Service** → **構成** → **パス マッピング**
4. **マウントパス**: `/home/data`
5. データベースパスを `/home/data/kakeibo.db` に変更

## 🚀 **手順6: デプロイ実行**

### **自動デプロイ**

GitHubにコミット・プッシュすると自動的にデプロイされます：

```bash
git add .
git commit -m "Azure deployment ready"
git push origin main
```

### **デプロイ状況確認**

1. **App Service** → **デプロイセンター** → **ログ**
2. ビルド・デプロイの進行状況を確認

## 🌐 **アクセス確認**

### **URL**
```
https://<your-app-name>.azurewebsites.net
```

例: `https://kakeibo-secure-app.azurewebsites.net`

### **動作確認**
1. サイトにアクセス
2. パスワード「`r246`」でログイン
3. 支出データの入力・編集を確認

## 🔧 **トラブルシューティング**

### **アプリが起動しない**
```bash
# ログストリーム確認
az webapp log tail --resource-group kakeibo-rg --name kakeibo-secure-app
```

### **よくあるエラー**

1. **502 Bad Gateway**
   - `package.json`の`"start"`スクリプトを確認
   - 環境変数`PORT`が設定されているか確認

2. **セッションエラー**
   - `SESSION_SECRET`が設定されているか確認

3. **データベースエラー**
   - ファイル権限の問題
   - Azure Filesのマウント確認

## 🔄 **更新手順**

### **コードの更新**
```bash
# ローカルで変更
git add .
git commit -m "Update feature"
git push origin main

# 自動的にAzureにデプロイされます
```

### **環境変数の更新**
1. **Azure Portal** → **App Service** → **構成**
2. **設定を変更**
3. **「保存」** → **アプリ再起動**

## 💰 **料金について**

### **App Service料金**
- **Free F1**: 無料（60分/日制限）
- **Basic B1**: 約¥1,500/月
- **Standard S1**: 約¥7,500/月

### **ストレージ料金**
- **Azure Files**: 約¥10/月（1GB）

## 🛡️ **本番環境のベストプラクティス**

1. **セッション秘密鍵**: 強力なランダム文字列を使用
2. **HTTPS**: 必ず有効化
3. **ログ監視**: Application Insightsを設定
4. **バックアップ**: 定期的なデータベースバックアップ
5. **スケーリング**: トラフィック増加時の自動スケール設定

---

**🎉 デプロイ完了後、実際のWebアプリとしてセキュアに使用できます！**
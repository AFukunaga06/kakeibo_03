const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Azure環境対応: 書き込み可能なディレクトリを使用
const isAzure = !!(process.env.WEBSITE_SITE_NAME || process.env.APPSETTING_WEBSITE_SITE_NAME || process.env.WEBSITE_INSTANCE_ID);
const DB_PATH = isAzure ? '/home/data/kakeibo.db' : './kakeibo.db';

// Azureの場合、データディレクトリを作成
if (isAzure) {
    const fs = require('fs');
    const dataDir = '/home/data';
    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('✅ データディレクトリを作成しました:', dataDir);
        }
    } catch (error) {
        console.warn('⚠️ データディレクトリの作成に失敗:', error.message);
        console.log('💡 ローカルディレクトリを使用します');
        // フォールバック: ローカルディレクトリを使用
        const DB_PATH_FALLBACK = './kakeibo.db';
    }
}

// セキュリティミドルウェア
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
        },
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 100, // リクエスト数制限
    message: 'リクエスト数が多すぎます。しばらく待ってから再試行してください。'
});
app.use(limiter);

// ログイン専用のより厳しい制限
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 5, // 5回まで
    message: 'ログイン試行回数が多すぎます。15分後に再試行してください。'
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// セッション設定
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
    secret: process.env.SESSION_SECRET || 'kakeibo-secure-session-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction && !isAzure, // AzureのHTTPS terminationに対応
        httpOnly: true,
        sameSite: isProduction ? 'lax' : 'strict', // Azure環境での互換性向上
        maxAge: 30 * 60 * 1000 // 30分でセッション期限切れ
    }
}));

// 静的ファイル配信
app.use(express.static(path.join(__dirname, 'public')));

// データベース初期化
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        console.log('📊 データベース初期化開始:', DB_PATH);
        
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('❌ データベース接続エラー:', err);
                reject(err);
                return;
            }
            console.log('✅ データベース接続成功');
        });
        
        db.serialize(() => {
            // ユーザーテーブル（将来の拡張用）
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE,
                    password_hash TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error('❌ ユーザーテーブル作成エラー:', err);
                else console.log('✅ ユーザーテーブル準備完了');
            });
            
            // 支出テーブル
            db.run(`
                CREATE TABLE IF NOT EXISTS expenses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    category TEXT NOT NULL,
                    item_name TEXT,
                    store TEXT,
                    amount INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error('❌ 支出テーブル作成エラー:', err);
                else console.log('✅ 支出テーブル準備完了');
            });
            
            // デフォルトパスワード (r246) のハッシュを作成してチェック
            const defaultPasswordHash = bcrypt.hashSync('r246', 10);
            db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
                if (err) {
                    console.error('❌ Database query error:', err);
                } else if (row.count === 0) {
                    // デフォルトユーザーを作成
                    db.run(
                        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                        ['admin', defaultPasswordHash],
                        (err) => {
                            if (err) {
                                console.error('❌ Error creating default user:', err);
                            } else {
                                console.log('✅ デフォルトユーザー作成完了: admin/r246');
                            }
                        }
                    );
                } else {
                    console.log('✅ 既存ユーザーを確認しました');
                }
            });
        });
        
        db.close((err) => {
            if (err) {
                console.error('❌ データベース接続終了エラー:', err);
                reject(err);
            } else {
                console.log('✅ データベース初期化完了');
                resolve();
            }
        });
    });
}

// 認証チェックミドルウェア
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        next();
    } else {
        res.status(401).json({ error: '認証が必要です' });
    }
}

// ルート定義

// メインページ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 認証状態チェック
app.get('/api/auth/status', (req, res) => {
    res.json({
        authenticated: !!req.session.authenticated,
        user: req.session.user || null
    });
});

// ログイン
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const { password } = req.body;
    
    if (!password) {
        return res.status(400).json({ error: 'パスワードが必要です' });
    }
    
    const db = new sqlite3.Database(DB_PATH);
    
    db.get(
        "SELECT * FROM users WHERE username = ?",
        ['admin'],
        async (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'データベースエラー' });
            }
            
            if (user && await bcrypt.compare(password, user.password_hash)) {
                req.session.authenticated = true;
                req.session.user = { id: user.id, username: user.username };
                res.json({ 
                    success: true, 
                    message: 'ログインしました',
                    user: { username: user.username }
                });
            } else {
                res.status(401).json({ error: 'パスワードが正しくありません' });
            }
            
            db.close();
        }
    );
});

// ログアウト
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'ログアウトに失敗しました' });
        }
        res.json({ success: true, message: 'ログアウトしました' });
    });
});

// 支出データ取得
app.get('/api/expenses', requireAuth, (req, res) => {
    const { year, month } = req.query;
    const db = new sqlite3.Database(DB_PATH);
    
    let query = "SELECT * FROM expenses ORDER BY date DESC, created_at DESC";
    let params = [];
    
    if (year && month) {
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        query = "SELECT * FROM expenses WHERE date LIKE ? ORDER BY date DESC, created_at DESC";
        params = [`${monthStr}%`];
    }
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'データ取得エラー' });
        }
        res.json(rows);
        db.close();
    });
});

// 支出データ作成
app.post('/api/expenses', requireAuth, (req, res) => {
    const { date, category, item_name, store, amount } = req.body;
    
    // バリデーション
    if (!date || !category || !amount || amount <= 0) {
        return res.status(400).json({ error: '必須項目が不足しているか、金額が無効です' });
    }
    
    const db = new sqlite3.Database(DB_PATH);
    
    db.run(
        "INSERT INTO expenses (date, category, item_name, store, amount) VALUES (?, ?, ?, ?, ?)",
        [date, category, item_name || '', store || '', parseInt(amount)],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'データ保存エラー' });
            }
            
            res.json({
                id: this.lastID,
                date,
                category,
                item_name: item_name || '',
                store: store || '',
                amount: parseInt(amount),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            
            db.close();
        }
    );
});

// 支出データ更新
app.put('/api/expenses/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { date, category, item_name, store, amount } = req.body;
    
    // バリデーション
    if (!date || !category || !amount || amount <= 0) {
        return res.status(400).json({ error: '必須項目が不足しているか、金額が無効です' });
    }
    
    const db = new sqlite3.Database(DB_PATH);
    
    db.run(
        "UPDATE expenses SET date = ?, category = ?, item_name = ?, store = ?, amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [date, category, item_name || '', store || '', parseInt(amount), id],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'データ更新エラー' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'データが見つかりません' });
            }
            
            res.json({
                id: parseInt(id),
                date,
                category,
                item_name: item_name || '',
                store: store || '',
                amount: parseInt(amount),
                updated_at: new Date().toISOString()
            });
            
            db.close();
        }
    );
});

// 支出データ削除
app.delete('/api/expenses/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const db = new sqlite3.Database(DB_PATH);
    
    db.run(
        "DELETE FROM expenses WHERE id = ?",
        [id],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'データ削除エラー' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'データが見つかりません' });
            }
            
            res.json({ success: true, message: 'データを削除しました' });
            db.close();
        }
    );
});

// エラーハンドラー
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
});

// 404ハンドラー
app.use((req, res) => {
    res.status(404).json({ error: 'ページが見つかりません' });
});

// サーバー起動
const server = app.listen(PORT, async () => {
    console.log(`🚀 セキュア家計簿サーバーが起動しました`);
    console.log(`📍 PORT: ${PORT}`);
    console.log(`🔐 デフォルトパスワード: r246`);
    console.log(`📂 データベース: ${DB_PATH}`);
    console.log(`🌐 環境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`☁️ Azure環境: ${isAzure ? 'Yes' : 'No'}`);
    
    // データベース初期化
    try {
        await initializeDatabase();
        console.log('🎉 アプリケーション起動完了');
    } catch (error) {
        console.error('💥 データベース初期化失敗:', error);
        console.log('⚠️ 一部機能が制限される可能性があります');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

module.exports = app;
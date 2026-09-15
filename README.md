# LUXE DAILY / Supabase版

この版は `products.js` を読み込まず、ブラウザから Supabase の `products` テーブルを直接読み込みます。
お気に入りだけはログイン不要の `localStorage` に保存します。カート機能はありません。

## 1. 接続設定

`config.js` に今回の Project URL と Publishable Key を設定済みです。

- Project URL: `https://xncaahdorsczcmisqqgg.supabase.co`
- Table: `products`
- Storage bucket: `product-images`

Publishable Key はブラウザ公開前提のキーです。`sb_secret_...` や service role key は絶対にWebサイトへ置かないでください。

## 2. Supabase側の準備

Supabase Dashboard → SQL Editor で `supabase_setup.sql` を実行してください。

このSQLは以下を行います。

- products に画像・アフィリエイト管理用カラムを追加
- products のRLSを有効化
- 掲載中 (`is_active = true`) の商品だけ公開SELECTを許可
- `product-images` 公開Storage bucketを作成
- 商品画像の公開閲覧ポリシーを作成

## 3. products テーブルの基本項目

サイト側は英語カラム名と日本語カラム名の両方を認識します。

| 意味 | 推奨カラム | 日本語カラムも対応 |
|---|---|---|
| 部門 | `department` | `部門` |
| 品名 | `product_name` | `品名` / `商品名` |
| 原産国 | `origin_country` | `原産国` |
| 円価格 | `price_jpy` | `値段` / `価格` |
| 商品説明・高い理由 | `description` | `商品説明（高い理由）` / `商品説明` / `高い理由` |
| 購入リンク | `purchase_link` | `購入リンク` |

金額は `33000` のように円の整数で保存してください。画面側で `¥33,000` に整形します。

## 4. 通常商品の画像

Supabase Storage の `product-images` に画像をアップロードします。

例:

```
product-images/
  coffee/black-ivory.webp
  tea/gyokuro.webp
  chocolate/toak.webp
```

DBにはフルURLではなく次のように保存します。

```
image_source = supabase
image_path   = coffee/black-ivory.webp
is_affiliate = false
```

## 5. アフィリエイト商品の画像

楽天などから正式に提供されるアフィリエイト画像URLを直接使います。
Supabase Storageへコピーしません。

```
image_source        = affiliate
affiliate_image_url = https://hbb.afl.rakuten.co.jp/...
is_affiliate        = true
shop_name            = 楽天市場
purchase_link        = https://hb.afl.rakuten.co.jp/...
```

購入リンクには、アフィリエイト商品の場合 `rel="sponsored nofollow noopener"` が自動で付きます。

## 6. 商品追加後のサイト更新

HTMLやJavaScriptを書き換える必要はありません。
Supabaseの `products` に1行追加してページを再読み込みすると反映されます。

## 7. 接続エラー時

商品一覧の上に接続状態が表示されます。

- 「SupabaseからN件の商品を読み込みました」→ 正常
- 「0件です」→ productsが空、またはRLSポリシーを確認
- 「商品データを取得できません」→ Project URL / Publishable Key / RLS / テーブル名を確認

## 8. セキュリティ

Webブラウザには Publishable Key のみを置きます。
公開ユーザーには products の SELECT だけを許可し、INSERT / UPDATE / DELETE は許可しません。

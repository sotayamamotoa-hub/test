# VDD Creative Catalog — 公開ギャラリー (GitHub Pages)

映像デザイン室の作例を **一般公開** するための静的サイトです。
閲覧専用で、アップロード・削除機能はありません（入稿は社内のGASツール側で行う）。

## 構成

```
public-gallery/
├─ index.html     公開ギャラリーのページ
├─ styles.css     スタイル（社内版GASと同じデザイン。ダークモード対応）
├─ app.js         ギャラリーのロジック（posts.json を読んで描画するだけ）
├─ posts.json     ★公開データ。GASのパブリッシュ処理が生成・更新する（今はサンプル）
└─ media/         ★公開メディア（画像など）。配置方法は下記「メディア」参照
```

★印の2つは、案A（GAS → GitHub プッシュ）の **①パブリッシュ処理** が自動生成・更新する想定の成果物です。サイト本体（index.html / styles.css / app.js）は基本的に固定で、データだけ差し替わります。

## データ契約 (posts.json スキーマ)

①のGAS側は、この形のJSONを出力してください。`app.js` はこの形だけを前提にしています。

```jsonc
{
  "generatedAt": "ISO8601",   // 生成時刻（任意）
  "version": 13,               // 元デプロイのバージョン等（任意）
  "posts": [
    {
      "id": "string",            // 一意ID
      "title": "string",
      "body": "string",          // 説明・メモ
      "author": "string",        // 表示名（※公開で隠す場合は空文字で出力）
      "category": "完了",         // 進行中/企画/レビュー待ち/完了/メモ/その他
      "type": "photo|video|text",
      "mediaType": "image/jpeg|video/mp4|...",  // 任意
      "imageUrl": "string",       // 一覧サムネ/ポスター画像のURL（相対 or 絶対）
      "videoUrl": "string",       // モーダルでインライン再生する動画URL（任意）
      "drivePreviewUrl": "string",// Drive埋め込み再生URL（videoUrlの代替・任意）
      "createdAt": "ISO8601"
    }
  ]
}
```

メモ:
- `imageUrl` は相対パス（例 `media/abc.jpg`）でも絶対URLでもOK。`app.js` はそのまま `<img src>` に渡すだけ。
- 動画はモーダルを開いたときだけ読み込む。`videoUrl`（直リンク）か `drivePreviewUrl`（Drive埋め込み）のどちらかを入れる。一覧では `imageUrl`（ポスター）のみ表示。
- `author` を公開で隠す方針にするなら、GAS側で空文字 `""` を入れて出力すれば、一覧・詳細とも作者名が消えます（UI側の改修不要）。

## メディアの置き場所（①で確定する論点）

`imageUrl` / `videoUrl` に何を入れるかで、メディアの公開方法が決まります。候補:

1. **リポジトリに同梱**: 画像を `media/` にコミットし `imageUrl: "media/xxx.jpg"`。完全静的・確実。動画はリポジトリ肥大に注意（GitHub目安: 1ファイル100MB / リポジトリ1GB）。
2. **画像はリポジトリ、動画はDriveリンク**: 動画ファイルを「リンクを知る全員」に設定し、`drivePreviewUrl` に Drive の `/preview` URLを入れる。
3. **外部ストレージ/CDN**: URLをそのまま入れる。

→ ②（このサイト）はどれでも動きます。①の実装時に選びます。

## GitHub Pages へのデプロイ

1. このフォルダの中身をリポジトリに置く（リポジトリ直下、または `docs/` 配下）。
2. GitHub の Settings → Pages で、Source を該当ブランチ／フォルダに設定。
3. 数分後に公開URL（`https://<org>.github.io/<repo>/`）で閲覧可能。

注意:
- `app.js` は `fetch("posts.json")` を使うため、**ローカルで `file://` で直接開くと読み込みに失敗します**（CORS制約）。確認時は簡易HTTPサーバ経由で開いてください。GitHub Pages 上（http配信）では問題ありません。
- 会社のGitHub Organizationで **public リポジトリ＋public Pages が許可されているか** を事前に確認してください。

## ローカル確認の例

```powershell
# Python があれば
cd public-gallery
python -m http.server 8000
# → http://localhost:8000 を開く
```

# 競輪ドラゴンLP — Astro静的生成

既存のデザイン・画像・リンク設定を引き継ぎ、配信日程とFAQを編集データからHTMLへ生成します。CMS・DBは使いません。公開先は引き続きGitHub Pagesです。

## 現在の状態と注意

- Astro移行コードは追加済み。本番公開・GitHub設定変更はしていません。
- ルートの `index.html` は移行前の公開用HTMLとして変更せず残しています。旧 `assets/app.*.js` も保管しています。
- **新しいサイトは `src/` を編集します。ルートの `index.html` や生成された `dist/` の直接編集は新サイトに反映されません。**
- 現在のPagesの公開元がbranch/rootなら、引き続き旧HTMLが公開されます。本番切り替え後はActionsが生成した `dist/` だけを公開します。
- `_headers` / `_redirects` は元納品物のNetlify用設定です。新しいGitHub Pagesの公開物には含めていません。
- アーカイブは現在0件です。架空の動画は本番データへ追加していません。

## 初回準備・プレビュー

Node.js 24 LTS（Astroの最低要件は22.12以上）とnpmを使用します。このディレクトリで実行してください。

```sh
npm ci
npm run dev
```

表示されたローカルURL（通常 `http://127.0.0.1:4321/`）を開きます。JSONやCSSの保存でプレビューが更新されます。画像や `site-config.js` を変更したときは開発サーバーを再起動してください。

本番と同じ生成物の確認：

```sh
npm run verify
npm run preview
```

`dist/` を `file://` で直接開く方法は使わないでください。URLはドメイン直下の公開を前提としています。GitHubの `/repository-name/` 配下での公開にはそのまま対応していません。

## 編集する場所

|変更対象|編集箇所|
|---|---|
|配信日程・出演者・大会情報|`src/data/topics/*.json`（大会ごとに1ファイル）|
|FAQ|`src/data/faq.json`|
|公開動画アーカイブ|`src/data/archives.json`|
|サイトの基本メタ情報・トップTopic見出し|`src/data/site.json`|
|登録・LINE・SNSなどのリンク|ルート `site-config.js`|
|見た目の共通CSS|`src/styles/legacy.css`|
|トップの各セクション本文・画像|`src/fragments/home-*.html`|
|配信一覧・詳細・トップ抜粋の表示部品|`src/components/TopicCard.astro` / `BroadcastSchedule.astro` / `TopicTeasers.astro`|
|共通ヘッダー・メタ・スクリプト|`src/layouts/Base.astro`|
|下層ページの共通フッター|`src/components/PageFooter.astro`|
|元画像・PDF|ルート `assets/`|

CSSは既存の指定順を保っています。後ろの指定が前の指定を上書きする箇所があります。デザイン変更は生成HTMLではなく、この共通CSSと部品／セクションへ反映します。

### 日程の更新

例：`src/data/topics/2026-10-08-yahiko.json` の `sessions` の該当回を変更します。

```json
{
  "startsAt": "2026-10-08T21:30:00+09:00",
  "endsAt": "2026-10-08T23:00:00+09:00",
  "approximate": true,
  "stage": "前検日",
  "target": "初日（10/09）",
  "guest": "平原康多"
}
```

- 開始／終了は日本時間、秒は `00`、末尾は `+09:00`。開始より後の終了日時にします。日をまたぐ場合、終了の日付も翌日にします。
- `approximate: true` は表示に「頃」を付けます。日時判定には含めません。
- 大会の `tentative: true` は「暫定」と表示し、確定を前提としたカウントダウンを非表示にします。
- `target` は予想対象レースの表示文です。レース日程まで変わる場合はここも更新してください。配信日の変更からレース日を推測して変更する処理はありません。
- 回は開始順で記入してください。重複・終了の逆転・存在しない日付などは検証でエラーになります。
- 再生成すると、トップ抜粋・次回予定・一覧・詳細・検索の元データへ反映されます。
- 次回予定は「終了日時がまだ来ていない最初の回」です。開始時刻以降は「配信予定の時間帯」と表示します。実際のライブ稼働を検知する機能ではありません。

大会を追加する場合は既存JSONをコピーし、`slug` を重複しない英数字とハイフンへ変更します。ファイル名もslugに合わせてください。slugは詳細URLの識別子なので、日程変更だけでは変えないでください（旧リンクを維持するため）。一覧・詳細・検索・サイトマップへ自動追加されます。

`featuredOrder` はトップ掲載順（1以上の重複しない整数）、トップに載せない大会は `null` にします。トップのスマホ表示件数は元CSSの制限を引き継ぎます。`teaserTitle` / `shortTitle` はトップ用の表示名なので、大会名を変えるときは必要に応じて併せて変更します。

### FAQ

`number` / カテゴリーの `id` は既存リンクの識別子です。既存の番号は維持し、新規追加では重複させないでください。`question` は通常の文章、`answerHtml` は `<p>` / `<strong>` / `<br>` などのHTML文字列です。JSONの引用符は `\"`、文字列内の改行は `\n` と記入します。任意の第三者HTMLを受け入れる管理画面ではありません。

### 公開動画

`src/data/archives.json` の配列へ追加します。

```json
[
  {
    "id": "highlight-20261008",
    "title": "動画タイトル",
    "publishedAt": "2026-10-08",
    "videoUrl": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
    "description": "動画の説明"
  }
]
```

公開日の新しい順にHTMLを生成します。YouTube／Vimeoは埋め込み、HTTPSのMP4は動画プレイヤー、それ以外は外部リンクを表示します。外部プレーヤーは既存同様「この動画を見る」をクリックしてから読み込みます。動画サービス側の公開・埋め込み許可は別途必要です。空配列 `[]` にすると元の公開準備中の表示になります。

## 検証

```sh
npm run validate
npm run verify
npx playwright install chromium
npm run test:browser
```

- `validate`：JSON入力、日時、識別子の重複などを検証。
- `verify`：ビルド、日時境界テスト、本文・メタ・リンク検証、日程変更の反映テスト。変更テストは `test-results/` のコピーだけを変更し、元データと通常の `dist/` は変えません。
- `test:browser`：ローカルHTTPサーバーを自動起動し、390px／1440px、直アクセス・再読み込み、旧ハッシュリンク、検索、FAQ、ダイアログ、画像読込、JavaScript無効時の本文を検証。スクリーンショットは `test-results/` に保存します。
- GitHub Actionsの `verify.yml` はpush／PRで検証のみ実行し、公開しません。

静的HTMLはトップ・一覧・11件の詳細・FAQ・アーカイブ・視聴方法、計16ページ（別途404ページ）を生成します。各ページのtitle・description・canonical・OGP、`sitemap.xml` / `robots.txt` を出力します。FAQ本文はJavaScriptなしでもHTMLに含まれます。検索表示と次回予定の時刻更新、旧ハッシュURLの移動にはJavaScriptを使用します。

## 本番切り替え（今回は未実施）

DNS／Route 53の変更は必要ありません。対象はGitHubリポジトリ `nextgate-developer/lp-keirin-doragon` のPages公開設定です。

1. 移行コードをレビューし、ローカル検証とActionsの検証が成功したことを確認。
2. 承認後にコミット・push。現在のPages公開元、カスタムドメイン、HTTPS設定をGitHub画面で記録する（現在の公開元は未確認）。
3. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする。カスタムドメイン `lp.keirin-dragon.com` とHTTPSは維持する。
4. **Actions → Deploy Astro to GitHub Pages (manual) → Run workflow** を対象ブランチで手動実行。`dist/` だけが公開される。
5. 本番でトップ、詳細URLへの直アクセス／再読み込み、旧 `/#/faq.html` と詳細リンク、PDF、登録リンク、PC／スマホ、canonical、サイトマップを確認。

`deploy.yml` は意図的に手動実行だけです。日常更新もデータを編集→検証→push→手動Run workflowとします。自動公開への切り替えは別途承認後に行ってください。

問題があれば、記録した旧Pages公開元へ戻すことで旧HTMLへ戻せます（再デプロイの時間は必要）。ロールバック確認が済むまではルートの旧HTMLと旧資産を消さないでください。GTMは本番ホストでのみ読み込み、ローカルプレビューでは送信しません（JavaScript有効時）。本番計測・外部登録先・動画再生・GitHub公開設定はローカルテストだけでは検証できません。

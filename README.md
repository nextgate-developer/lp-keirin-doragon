# 競輪ドラゴンLP — Astro静的生成

既存のデザイン・画像・リンク設定を引き継ぎ、配信日程とFAQを編集データからHTMLへ生成します。CMS・DBは使いません。公開先は引き続きGitHub Pagesです。

## 現在の状態と注意

- Astro版を https://lp.keirin-dragon.com/ で本番公開しています。
- **mainへのpushは自動公開を開始します。** GitHub Pagesの公開元はGitHub Actionsで、`deploy.yml` の検証成功後に生成された `dist/` を公開します。
- **サイトの修正は `src/` を編集します。** ルートの `index.html` と旧 `assets/app.*.js` は移行前の保管用です。生成された `dist/` はビルドで作り直されます。
- `_headers` / `_redirects` は元納品物のNetlify用設定です。現在のGitHub Pagesの公開物には含めていません。
- YouTubeの新着動画は `src/data/youtube.json` で管理し、RSSで自動更新します。手動登録アーカイブは別の `src/data/archives.json` で管理します。

## 修正作業のルール

1. 最新のmainから `feature/修正内容` ブランチを作成し、そのブランチで作業します。
2. デザイン修正はAstroの構成と共通部品を維持し、依頼された範囲のCSS・HTML断片・Astro表示部品を編集します。日程処理、自動更新、計測、公開設定の変更が必要な場合は、理由と影響を担当者へ確認します。
3. ローカルでPC・スマホの表示を確認し、`npm run verify` と `npm run test:browser` を実行します。
4. 編集担当者は変更内容・確認結果・作業ブランチ名を本番反映の担当者へ共有します。本番反映の担当者が確認後にmainへ取り込み・pushします。

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
|サイトの基本メタ情報・JavaScript無効時のトップTopic見出し|`src/data/site.json`|
|登録・LINE・SNSなどのリンク|ルート `site-config.js`|
|見た目の共通CSS|`src/styles/legacy.css`|
|トップの各セクション本文・画像|`src/fragments/home-*.html`|
|トップのお知らせカード（スペシャル配信など。最初の画面のすぐ下）|`src/fragments/home-special.html`（文と `data-show-until` の日時を書き換える。日時を過ぎると、ビルドでは `src/pages/index.astro` が出さず、開いたままの画面では `src/scripts/home-special.js` が隠す。配信の回は `src/data/topics/*.json` にも入れる）|
|トップの見た目（2026-11 刷新。トップだけに効く）|`src/styles/home-2026-11.css`（`body.kd-top` の下だけを指定。龍の顔などの画像は `assets/images/rd/`）|
|下のページ（配信予定・配信の詳細・アーカイブ・視聴方法・よくある質問）の見た目と、トップとの共通部分（2026-11 刷新）|`src/styles/kd-2026-11.css`（`body.kd-page` と共通の色・追従バー。書体と一緒に `src/components/KdHead.astro` で読み込む。404 は刷新していないので legacy.css のまま）|
|配信一覧・詳細・トップ抜粋の表示部品|`src/components/TopicCard.astro` / `BroadcastSchedule.astro` / `TopicTeasers.astro`|
|共通ヘッダー・メタ・スクリプト|`src/layouts/Base.astro`|
|下層ページの共通フッター|`src/components/PageFooter.astro`|
|X広告から公式LINEへ通す中継ページ（`/line.html`。検索・メニュー・サイトマップに出さない）|`src/pages/line.astro`（文・見た目）と `src/scripts/line-bridge.js`（iPhoneは `line://`、Androidは `intent://` でLINEアプリを開く）。QRは `assets/images/rd/line-add-qr.png`。押した数は `kd_line_click` の `line_bridge_app`／`line_bridge_web`|
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

配信予定一覧とトップのTopic欄では、大会の最後の配信枠の `endsAt` に達すると、その大会を自動で非表示にします。閲覧端末の現在時刻で判定し、ページを開いたままでも更新します。一覧の検索・件数・リセットも終了済み大会を除外します。トップは `featuredOrder` の掲載指定・順番を維持し、スマホの3件制限も終了済みを除いた件数で適用します。Topicの見出しは「次回の配信予定」と同じ日時判定で大会を選び、`teaserTitle`（PC）／`shortTitle`（スマホ）へ自動追従します。予定が尽きた場合は準備中の案内に切り替えます。`site.json` の見出しはJavaScript無効時・実行前の表示用です。ファイルと詳細URLは残ります。静的HTMLには過去の大会も含まれるため、JavaScript無効時や実行前は過去の大会も表示されます。

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

優先度「中」までのクリック計測をGTMのdataLayerへ送信します。対象、送信情報、GTM／GA4側で必要な設定は [docs/CLICK_TRACKING.md](docs/CLICK_TRACKING.md) を参照してください。GTM／GA4の現在の設定・公開状態は、それぞれの管理画面で確認します。

```sh
npm run validate
npm run verify
npx playwright install chromium
npm run test:browser
```

- `validate`：JSON入力、日時、識別子の重複などを検証。
- `verify`：ビルド、日時境界テスト、本文・メタ・リンク検証、日程変更の反映テスト。変更テストは `test-results/` のコピーだけを変更し、元データと通常の `dist/` は変えません。
- `test:browser`：ローカルHTTPサーバーを自動起動し、390px／1440px、直アクセス・再読み込み、旧ハッシュリンク、検索、FAQ、ダイアログ、画像読込、JavaScript無効時の本文を検証。スクリーンショットは `test-results/` に保存します。
- GitHub Actionsの `verify.yml` はmain以外へのpush／PRで検証のみ実行し、公開しません。
- mainへのpushは `deploy.yml` がビルド・入力検証・HTML検証・ブラウザ検証を実行し、すべて成功した場合だけ `dist/` を自動公開します。検証用成果物の保存は失敗時にも試みますが、公開処理は進みません。

静的HTMLはトップ・一覧・11件の詳細・FAQ・アーカイブ・視聴方法、計16ページ（別途404ページと、検索に出さない公式LINEへの中継ページ）を生成します。各ページのtitle・description・canonical・OGP、`sitemap.xml` / `robots.txt` を出力します。FAQ本文はJavaScriptなしでもHTMLに含まれます。検索表示と次回予定の時刻更新、旧ハッシュURLの移動にはJavaScriptを使用します。

## YouTubeのRSS自動更新

PR動画は `PromoVideoPreview.astro` でメインビジュアル・最初の登録ボタン直後、Topicの前に固定配置しています。動画ID・タイトル・サムネイルは `src/data/youtube.json` の `promotion` で管理します。PRは新着順で入れ替えず、新着カードからも同じIDを除外します。RSS取得時も `promotion` は上書きしません。

トップのLIVE紹介直後とアーカイブの「ライブの魅力を切り抜きで」は、共通の `LiveClipsPreview.astro` と `src/data/youtube.json` から生成します。トップは最新3本、アーカイブは最新6本。アーカイブはPC・スマホとも1列の横スクロール／スワイプで、前後ボタンも使えます。既存の `archives.json` の手動登録動画は別枠で維持します。プレーヤーはクリック後に読み込み、サムネイル取得失敗時も再生ボタンを残します。通常動画もRSSに含まれれば掲載し、横長サムネイルは切り取らず枠内に収めます。

取得元は競輪ドラゴン公式チャンネルの公開RSSです。YouTube APIキーや追加の有料サービスは不要です。

```powershell
npm run sync:youtube -- --check # 取得・検証・差分確認のみ
npm run sync:youtube           # ローカルデータを更新
npm run verify
npm run test:browser
```

HTTPエラー（404を含む）・タイムアウト・不正XML・必須項目欠落・0件応答は、1分待って1回再試行します。各回で通常のチャンネルRSSが失敗したらアップロード一覧RSSを試します。最大2回×2経路＝4リクエスト、各15秒、待機込み約2分です。Actionsの取得ステップは状態保存も含め5分、ジョブ全体は30分で打ち切ります。正常な動画データに差分がなければ書き込みません。チャンネルID・動画ID・URL・日時を検証し、取得サイズも制限します。正常データは一時ファイルから置換します。ローカルの `npm run sync:youtube` は全試行失敗時に従来どおり終了コード1になります。

`.github/workflows/update-youtube.yml` は本番運用中で、6時間ごと（05:23／11:23／17:23／23:23 JST、GitHub側の遅延あり）に取得します。定期実行はデフォルトブランチのmain上で動きます。正常取得して差分があれば入力・生成HTML・ブラウザ検証後に動画データだけをbotがコミット・pushし、既存の `deploy.yml` を明示的に起動します。取得失敗時は動画データの保存・公開に進みません。保存後の公開起動や公開が失敗した場合は、次回の正常取得時に未公開のmainを再度公開要求します。

Actionsでは `--managed` を付け、最後の正常取得・通知判定時刻を `automation/youtube-rss-health` ブランチの `state.json` に保存します。新着なしでも正常なRSSなら成功時刻を更新します。24時間以上正常取得できず、前回の通知判定からも24時間以上経過した実行だけ、状態保存後に専用ステップを失敗させます。それ以外のRSS取得失敗はジョブを失敗させず、ログ・Summary・HTTP成果物に残します。GitHub標準のActions失敗通知を利用し、直接メールは送信しません。メール配送はユーザーのGitHub通知設定に従います。1日1回とはJSTの日付区切りではなく、前回の通知判定から24時間以上です。コード不具合・入力不備・状態保存失敗・ビルド／公開失敗はこの抑制対象にせず、通常の失敗とします。

履歴がまだない初回は、その時点から24時間の観測を開始します。成功時刻を推定・捏造しません。状態保存用ブランチは公開ソースとは別のルートコミットで、`state.json` だけを持ちます。状態が壊れた場合は黙って初期化せず停止します。通知判定を先に保存してからActionsを失敗させるため、手動再実行でも24時間以内のRSS障害通知を繰り返しません。状態保存とGitHub通知は一体の処理ではないため、保存直後のジョブ中断などで通知が送られない可能性はあります。

**検証手順：Actions → Update YouTube RSS → Run workflow → Use workflow from: `investigation/youtube-rss`**。検証では `--check` 相当を強制し、動画データのコミット・公開は行いません。状態は別の `automation/youtube-rss-health-test` に保存し、本番履歴と混ぜません。24時間の境界、通知の重複防止、取得回復、新着なし、保存失敗は自動テストで検証します。

GitHub標準の `GITHUB_TOKEN` に、このジョブだけ `contents: write` と `actions: write` を付与しています。追加のPATは不要です。自動pushはpushワークフローを起動しないため、`workflow_dispatch` を使います（[GitHub公式仕様](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)）。ブランチ保護などでbotのpushが禁止されている場合は保存ジョブが失敗するため、実際のActionsで確認してください。競合時は強制pushせず停止します。

復旧確認は **Actions → Update YouTube RSS → Run workflow → main**。取得ジョブと公開ジョブの成功はそれぞれ確認します。公開前の検証失敗なら前回の公開内容が維持されます。公開リポジトリでは60日間リポジトリ活動がないと定期実行が無効になるため、その場合はActions画面で再有効化してください。RSSは最新分のみで、全過去動画の取得・削除の即時反映・埋め込み再生可否は保証できません。公開元リンクも残しています。

### RSS障害の応答診断

更新処理がHTTPエラーを受け取った場合、URL・取得日時・ステータス・応答ヘッダー・本文の先頭32KiB・本文サンプルのハッシュを `test-results/youtube-http/` に保存します。Cookie・認証ヘッダーは除外します。Actionsの `youtube-http-failures-...` 成果物は失敗時も保存し、7日間保持します。ジョブが正常終了してもSummaryに取得成否を表示し、取得失敗時の前回データ保持と公開停止は継続します。診断追加前の失敗応答は復元できません。

**Actions → Diagnose YouTube RSS → Run workflow** ではUbuntu／WindowsとNode.js／curlを比較します。curlでは接続先IP・HTTPバージョン・リダイレクト・所要時間も記録します。`negative control: trailing slash` は意図的な不正URLで、本番RSSの障害件数には含めません。`no-www` はリダイレクト比較用です。HTTPクライアントとUser-Agentも異なるため、両者の差だけで原因を断定しないでください。結果はログと `youtube-http-diagnostic-...` 成果物に保存します。手動診断で再現しない場合も、本番更新処理の失敗応答を次回以降取得できます。

#### 条件を固定した追加調査（検証用ブランチ）

追加調査は `investigation/youtube-rss` で行い、手動実行時の **Use workflow from** もこのブランチを選びます。本番の取得方法・動画データは変更しません。`diagnose-youtube-controlled.mjs` はDNSで得たIPv4を最大2個選び、ホスト名・TLS検証を維持したまま接続先を固定します。curlのHTTP/1.1を基準に、User-Agent、圧縮設定、HTTP/2（対応環境のみ）、Node.jsのHTTPSクライアントを一つずつ比較し、2巡目は順序を逆転します。リクエストは各10秒、全体約3分で打ち切り、Actionsの比較ステップ4分・ジョブ10分以内に収めます。IP固定は調査専用で、本番の固定IP運用には使いません。

2026-11-02 09:01〜09:02 JSTの [調査実行](https://github.com/nextgate-developer/lp-keirin-doragon/actions/runs/41364931589) は、このブランチの `15e3a41` を使用しています。

- 競輪ドラゴンRSSの比較36回中、正常XMLは7回（Ubuntu 3/20、Windows 4/16）、残りは404／500。同じIP・同じヘッダー・同じクライアントでも、反復すると成功と失敗が入れ替わりました。設定変更だけで安定する傾向は確認できませんでした。
- 同じIP・同じ取得条件で競輪ドラゴンと別チャンネル（Google公式ドキュメントに例示されたID）を交互に取得した8回も、すべて404／500でした。競輪ドラゴンだけのチャンネル設定が原因という説明には合いません。
- ローカルでの先行試験は16/16成功しました。ただし実行場所と時刻が異なるため、これだけでGitHubのIP制限や地域差とは断定できません。
- 確認できたのは、YouTube RSSからの応答が同条件でも変わることです。YouTube内部の障害・振り分け・制限・キャッシュのどれかは、この調査だけでは確定できません。HTTP/2、User-Agent、圧縮、接続先IPの変更を本番の修正策として採用する根拠は得られていません。

比較用IDの出典：[Googleの公式ドキュメント](https://developers.google.com/youtube/data/getting-started)。APIは利用していません。診断ジョブの成功は証拠採取の完了を表し、RSSの正常取得率を表すものではありません。

## 本番公開と確認

GitHubリポジトリは `nextgate-developer/lp-keirin-doragon`、公開先は https://lp.keirin-dragon.com/ です。GitHub Pagesの **Settings → Pages → Build and deployment → Source** は **GitHub Actions** に設定済みです。

1. 作業ブランチで修正し、ローカル検証と変更内容の確認を行います。
2. 本番反映の担当者がmainへ取り込み・pushすると、**Actions → Verify and deploy Astro to GitHub Pages** が自動実行されます。
3. `build` と `deploy` の両方が成功したことを確認します。
4. 本番で変更した箇所を確認します。ページ構造を変更した場合は、PC・スマホ表示、リンク、詳細URLへの直アクセス・再読み込みも確認します。

通常の公開はmainへのpushで始まります。再実行が必要なときは、Actions画面のRe-run jobs、またはmainを選んだRun workflowを使用できます。

ビルド・検証に失敗すると公開ジョブはスキップされ、最後に正常公開できたサイトが維持されます。GitHubにはpushしたコミットが残るため、修正して再pushしてください。公開処理自体の途中で失敗した場合はActionsのログと実際の公開状態を確認します。

公開済みの変更を取り消す場合は、担当者が該当変更を取り消すコミットをmainへ反映し、公開Actionsの成功と本番表示を確認します。GTMは本番ホストでのみ読み込みます。本番計測・外部登録先・動画再生の確認は、本番環境でも行ってください。

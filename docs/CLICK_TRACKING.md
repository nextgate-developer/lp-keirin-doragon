# LPのクリック計測（サイト側実装・GTM設定手順）

## 現在の状態

サイト側のイベント送信コードは `src/scripts/click-tracking.js` です。既存のGTMコンテナ `GTM-W8P92CGH` を使い、`dataLayer.push()` で情報を渡します。GA4の測定IDをHTMLへ新しく埋め込む実装ではありません。

**GTMを読み込むだけでは、以下のイベントはGA4へ記録されません。** GTMにカスタムイベントのトリガーとGA4イベントタグが必要です。この作業ではGTM／GA4の管理画面を変更・公開していません。既存タグの内容、GA4の送信先、同意設定は未確認です。

本番ホスト `lp.keirin-dragon.com` のみで送信します。ローカルや別ホストのプレビューではGTM読み込み・今回のイベント送信を行いません（JavaScript有効時）。テストでは本番ホストをローカル生成物に割り当てて検証し、外部リクエストを遮断してGTM／GA4へ送信しません。

## 対象イベント

|dataLayerのevent|対象|補足|
|---|---|---|
|`kd_registration_click`|会員登録ボタン|hero／下部／追従／視聴方法・アーカイブ内の登録ボタンを区別|
|`kd_live_click`|ライブ配信を見る|参加完了や実際のライブ開始ではない|
|`kd_line_click`|公式LINEのカード・SNSアイコン|会員登録ボタン経由とは区別。友だち追加完了ではない|
|`kd_schedule_click`|配信予定一覧へのリンク|トップTopic、ライブ、関連ページ、パンくず、一覧へ戻るリンクなど|
|`kd_topic_click`|大会詳細へのリンク|トップ抜粋／次回予定／一覧タイトル／詳細ボタン。大会slugも送信|
|`kd_faq_click`|FAQページへのリンク|現在はトップのフッター|
|`kd_faq_open`|FAQ回答を開く|質問番号・カテゴリー。マウスとキーボード対応、閉じる操作は数えない|
|`kd_viewing_guide_click`|視聴方法へのリンク|FAQ関連リンク・アーカイブ関連リンクなど|
|`kd_content_click`|イベント・会員限定MOVIE・対談予告|未公開中は `coming_soon`。公開後は実際の遷移先種別|
|`kd_sns_click`|YouTube・X|公式LINEは `kd_line_click` に分ける|

優先度「低」の運営者・規約・プライバシー・特商法、および「公開後」候補のアーカイブ再生は今回の独自計測対象外です。GTM／GA4の既存の外部リンク・PDF自動計測で収集される場合はあります。

登録・ライブ・LINEは現在同じLINE URLへ遷移しますが、リンク先URLではなく `data-link` と設置場所で区別します。Coming soonのクリックは関心の指標であり、登録・視聴の完了とは扱いません。

## イベントに付ける情報

|dataLayer変数名|意味|GA4へ渡すパラメータ名の提案|
|---|---|---|
|`kd_tracking_version`|送信形式の版（1）|`tracking_version`|
|`kd_page_path`|クリックしたページのパス|`lp_page_path`|
|`kd_placement`|設置位置|`placement`|
|`kd_target`|registration／live／line／topics／topic／faq／viewing_guide／events／movie／previewMovie／youtube／x／faq_question|`link_target`|
|`kd_destination_type`|internal／external／coming_soon／expand|`destination_type`|
|`kd_topic_slug`|大会の識別子。それ以外は空文字|`topic_slug`|
|`kd_faq_number`|FAQ番号。それ以外は空文字|`faq_number`|
|`kd_faq_category`|FAQカテゴリーID。それ以外は空文字|`faq_category`|

位置は `hero`、`bottom_registration`、`floating`、`service_registration`、`contents_cards`、`contents_movie`、`contents_preview`、`footer_sns`、`next_live`、`live_section`、`top_topics`、`topic_list`、`topic_detail`、`breadcrumbs`、`faq_related`、`service_nav`、`footer_nav`、`viewing_help`、`faq_question`、`page_content` です。

既存の `data-link`・リンク先パス・部品クラスから判定します。新しい部品を追加する場合は必要に応じてコードの分類を更新してください。位置だけを指定したい場合は、リンクまたは親要素に `data-track-placement="任意の固定識別子"` を付けられます。利用者の入力値は使わないでください。

送信例：

```js
{
  event: 'kd_registration_click',
  kd_tracking_version: 1,
  kd_page_path: '/',
  kd_placement: 'hero',
  kd_target: 'registration',
  kd_destination_type: 'external',
  kd_topic_slug: '',
  kd_faq_number: '',
  kd_faq_category: ''
}
```

全フィールドを毎回設定するため、直前に開いたFAQ番号などが次のクリックへ持ち越されません。本コードでは氏名・メールアドレス・ユーザーID・検索語句・完全なリンクURL・ページのクエリ／ハッシュを送信しません。ただし、既存のGA4自動計測や他のタグが送る情報まで抑止するものではありません。

## GTM側の設定（別途必要）

以下はこのLP用の入力値を含む手順です。画面名は表示言語・Google側の更新で多少変わる場合があります。実際の管理画面の既存設定はまだ確認していません。

作成するのは、データレイヤー変数8個、カスタムイベントトリガー1個、GA4イベントタグ1個です。イベントごとに10個のタグを作る必要はありません。

### 0. 作業の前提と公開順

- GTMコンテナを編集できる権限が必要です。公開権限は編集権限とは別なので、ない場合は公開担当者へ依頼します。
- GA4の対象プロパティを確認できる権限が必要です。カスタムディメンション作成には編集者以上の権限を用意します。
- GTMの設定は先に保存できますが、実クリックでの検証には今回のサイト側コードが `https://lp.keirin-dragon.com/` に反映されている必要があります。旧HTMLのままでは `kd_...` イベントは出ません。
- 推奨順は「GTMの未公開設定を作成 → サイト側コードを本番反映 → GTMプレビューで確認 → GTM公開」です。サイトの公開とGTMの公開は別操作です。
- この手順書の更新だけでは、サイトもGTMも公開されません。プレビュー中でもテスト操作のイベントはGA4へ送られ得ます。

### 1. 既存の送信先と重複を確認する

1. [GTM](https://tagmanager.google.com/) にログインし、コンテナIDが **`GTM-W8P92CGH`** のWebコンテナを開きます。名前だけでなくIDを確認します。
2. 作業するワークスペースを開き、他の人の未公開変更がないか確認します。ある場合は、今回の設定と一緒に公開してよいか確認するまで公開しません。
3. 左メニューの「タグ」で、種類が「Google タグ」または旧「GA4設定」のタグを探します。対象GA4の測定ID・送信先、発火条件、既存の同意設定を記録します。
4. [GA4](https://analytics.google.com/) の対象プロパティを開き、「管理 → データの収集と修正 → データ ストリーム → 対象のウェブストリーム」で **`G-...` の測定ID**を確認します。GTMのコンテナID `GTM-...` とは別物です。
5. GTM内で既に登録・LINE・ライブのクリックタグや `kd_...` イベントタグがないか調べます。重複している場合は、既存を利用するか置き換えるかを決めてから進みます。無関係な既存タグは削除しません。
6. GA4ウェブストリームの「拡張計測機能」で、外部リンク・ファイルダウンロードなどの既存計測も確認します。これらは今回の独自イベントと別に発生し得ます。

既存のGoogleタグが対象GA4へ送信している場合は、それをそのまま使います。基本タグがない場合は、追加の初期設定が必要です。GA4ウェブストリームの「タグの実装手順」と既存の同意方針を確認してからGoogleタグを用意してください。既存タグの有無が不明なまま、All Pagesの基本タグを重ねて追加しないでください。

### 2. データレイヤー変数を8個作る

まず設置位置用の変数を作ります。

1. GTM左メニュー「変数」を開きます。
2. 「ユーザー定義変数」の「新規」を押します。
3. 上部の名前を **`DLV - kd_placement`** にします。
4. 「変数の設定」をクリックし、「データレイヤーの変数」を選びます。
5. 「データレイヤーの変数名」に **`kd_placement`** と入力します。ここには `{{ }}` を付けません。
6. 「データレイヤーのバージョン」を **バージョン2** にします。「デフォルト値を設定」は今回は不要です。
7. 保存します。

同じ操作で、以下の8個をそろえます。左列はGTM画面上の管理名、右列はサイト側コードのキーです。表のとおり大文字・小文字も合わせます。

|GTM変数の管理名|データレイヤーの変数名|バージョン|
|---|---|---|
|`DLV - kd_tracking_version`|`kd_tracking_version`|2|
|`DLV - kd_page_path`|`kd_page_path`|2|
|`DLV - kd_placement`|`kd_placement`|2|
|`DLV - kd_target`|`kd_target`|2|
|`DLV - kd_destination_type`|`kd_destination_type`|2|
|`DLV - kd_topic_slug`|`kd_topic_slug`|2|
|`DLV - kd_faq_number`|`kd_faq_number`|2|
|`DLV - kd_faq_category`|`kd_faq_category`|2|

続けて「変数 → 組み込み変数 → 設定」を開き、**`Event`** を有効にします。既に有効なら変更不要です。この変数は `kd_registration_click` など、その操作のイベント名を取得します。Click TextやClick URLを使って判定する方式ではありません。

### 3. カスタムイベントトリガーを1個作る

1. 左メニュー「トリガー → 新規」を開きます。
2. 名前を **`CE - KD LP interactions`** にします。
3. 「トリガーの設定 → カスタムイベント」を選びます。「クリック - すべての要素」ではありません。
4. 「イベント名」に以下を1行で貼り付け、**「正規表現一致を使用」**をオンにします。コードブロックの囲み記号は貼り付けません。

```text
^kd_(registration_click|live_click|line_click|schedule_click|topic_click|faq_click|faq_open|viewing_guide_click|content_click|sns_click)$
```

5. 発生場所を対象LPに限定するため「一部のカスタムイベント」を選び、条件を **`Page Hostname` / `等しい` / `lp.keirin-dragon.com`** にします。Page Hostnameが候補にない場合は「変数 → 組み込み変数 → 設定」で有効にします。
6. 保存します。

この正規表現は10種類だけに一致します。`^kd_` だけにすると、将来追加する未確認イベントまで拾うため、上記の完全一致を使います。

### 4. GA4イベントタグを1個作る

1. 左メニュー「タグ → 新規」を開きます。
2. 名前を **`GA4 - KD LP interactions`** にします。
3. 「タグの設定 → Google アナリティクス → Google アナリティクス: GA4 イベント」を選びます。種類の表示が多少違っても、カスタムHTMLではなくGA4のイベントタグを選びます。
4. 「測定ID」に手順1で確認した **実際の `G-...`** を入力します。既存の測定ID変数があれば、同じ送信先であることを確認して選択しても構いません。画面に既存Googleタグの検出状況が出る場合は、対象のタグが見つかることを確認します。
5. 「イベント名」を **`{{Event}}`** にします。右側の変数選択ボタンから「Event」を選ぶと入力ミスを避けられます。
6. 「イベント パラメータ」を開き、「行を追加」で以下の8行を設定します。パラメータ名は文字列で入力し、値は作成した変数を選びます。

|GA4のパラメータ名|値（GTM変数）|
|---|---|
|`tracking_version`|`{{DLV - kd_tracking_version}}`|
|`lp_page_path`|`{{DLV - kd_page_path}}`|
|`placement`|`{{DLV - kd_placement}}`|
|`link_target`|`{{DLV - kd_target}}`|
|`destination_type`|`{{DLV - kd_destination_type}}`|
|`topic_slug`|`{{DLV - kd_topic_slug}}`|
|`faq_number`|`{{DLV - kd_faq_number}}`|
|`faq_category`|`{{DLV - kd_faq_category}}`|

7. 下部の「トリガー」で **`CE - KD LP interactions`** を選びます。All Pagesや別のクリックトリガーは、このイベントタグに追加しません。
8. 同意設定は既存の運用に合わせます。テストで送信されないからといって同意を不要にする設定へ変更しないでください。
9. 保存します。まだ「公開」は押しません。

`{{Event}}` を使うため、同じタグでも登録時は `kd_registration_click`、FAQ回答を開くと `kd_faq_open` になります。GA4側で同名イベントを別途「作成」する必要はありません。

### 5. Tag Assistantで実クリックを確認する

今回のサイト側コードが本番反映済みであることを先に確認します。ローカルURLはホスト制限により対象外です。

1. GTM右上「プレビュー」を押します。
2. Tag Assistantで `https://lp.keirin-dragon.com/` を入力し、「Connect／接続」を押します。
3. 開いたサイトで、必要な同意操作を既存の方針どおり行います。
4. ヒーローの会員登録ボタンを1回クリックします。LINEへ移動・別タブ表示される場合もあるので、Tag Assistantのタブへ戻って確認します。
5. 左側のイベント一覧で **`kd_registration_click`** を選びます。`gtm.click` ではなく `kd_...` の行を選びます。
6. 「Tags／タグ」で **`GA4 - KD LP interactions` が1回発火**していることを確認します。
7. 「Variables／変数」で `Event = kd_registration_click`、`DLV - kd_placement = hero`、`DLV - kd_target = registration` になっていることを確認します。「Data Layer／データレイヤー」でも該当キーを確認できます。
8. 対象ページへ戻り、以下を順に確認します。デスクトップとスマホ幅の両方で操作します。

|操作|期待するイベント|確認ポイント|
|---|---|---|
|ヒーロー・下部・追従の登録ボタン|`kd_registration_click`|位置がそれぞれ `hero` / `bottom_registration` / `floating`|
|ライブ配信を見る|`kd_live_click`|LINEと同じURLでも登録クリックと混ざらない|
|公式LINEのカード・SNSアイコン|`kd_line_click`|`link_target = line`|
|配信予定一覧へのリンク|`kd_schedule_click`|ページ遷移してもイベントが確認できる|
|大会詳細へのリンク|`kd_topic_click`|`topic_slug` がクリックした大会のID|
|FAQページへのリンク|`kd_faq_click`|FAQ回答を開く操作とは別|
|FAQ回答を開く・閉じる・再度開く|`kd_faq_open`|開くたび1回、閉じるとき0回。番号・カテゴリーが正しい|
|FAQを開いた後、視聴方法へ移動|`kd_viewing_guide_click`|FAQ番号・大会IDの変数が空で、前の操作の値を引き継がない|
|イベント・会員MOVIE・対談予告|`kd_content_click`|未公開なら `destination_type = coming_soon`。ダイアログが動く|
|YouTube・X|`kd_sns_click`|`link_target = youtube` / `x`|

各操作の `kd_...` が1個、そのイベントに対する今回のGA4タグが1回なら合格です。既存の `gtm.click` やGA4自動計測の `click` が別に発生すること自体は、今回のタグの二重発火とは異なります。

### 6. GA4への受信を確認する

1. 対象GA4プロパティの「管理 → データの表示 → DebugView」を開きます。
2. Tag Assistant接続中の自分のデバッグデバイスを選びます。Tag Assistantで自分のブラウザをデバッグ対象にする方法を使い、全利用者に `debug_mode = true` を付ける設定は追加しません。
3. もう一度対象ボタンを操作し、`kd_registration_click` などが届くことを確認します。
4. イベントを選択し、「パラメータ」で `placement`、`link_target` などが想定どおりか確認します。FAQや大会以外では、その固有パラメータが空または送信先画面で省略されているのは問題ありません。
5. GA4の「レポート → リアルタイム」でも対象イベントを確認します。通常レポートの反映を待つだけで受信成功と判断しないでください。

Tag Assistantの「発火」はGTM側の実行確認であり、GA4側の受信保証ではありません。受信先の測定ID・同意状態・ブロッカー・GA4フィルタも含めて確認します。

### 7. 集計したい項目をGA4のカスタムディメンションに登録する

イベント件数だけなら、これらの独自ディメンションを作らなくても受信イベントを確認できます。設置位置やFAQ番号で分けて集計したい場合は登録します。

1. GA4「管理 → データの表示 → カスタム定義」を開きます。
2. 「カスタム ディメンションを作成」を押します。
3. 例として、ディメンション名を **`LP 設置位置`**、範囲を **`イベント`**、イベントパラメータを **`placement`** にして保存します。ここには `kd_placement` や `{{DLV - kd_placement}}` を入れません。
4. 必要に応じて次も作ります。通常は位置・対象・遷移種別から始め、大会・FAQを分析する場合に残りを登録します。

|表示名の例|イベントパラメータ|範囲|
|---|---|---|
|LP 設置位置|`placement`|イベント|
|LP 操作対象|`link_target`|イベント|
|LP 遷移種別|`destination_type`|イベント|
|LP 大会ID|`topic_slug`|イベント|
|LP FAQ番号|`faq_number`|イベント|
|LP FAQカテゴリー|`faq_category`|イベント|
|LP ページパス（必要な場合）|`lp_page_path`|イベント|

`tracking_version` は実装確認用なので通常は登録不要です。カスタムディメンションは作成後すぐ通常レポートで利用できるとは限らず、Googleの案内では24〜48時間が目安です。過去データへの遡及適用を前提にせず、分析開始前に用意します。

分析例はGA4「探索」で、行を「LP 設置位置」、指標を「イベント数」、フィルタを「イベント名が `kd_registration_click` に完全一致」とします。ヒーロー・下部・追従の登録ボタンを比較できます。指標はクリック数であり、登録完了数ではありません。

今回はすべてをキーイベントにしません。登録意向をキーイベントとして扱う場合でも、`kd_registration_click` は登録ボタンのクリックであり、`sign_up` やLINE友だち追加完了とは区別してください。

### 8. 確認後にGTMを公開する

1. GTMのワークスペースの変更一覧で、今回作った変数・トリガー・タグと、他の変更が混ざっていないか確認します。
2. 右上「公開／送信（Submit）」を押し、「バージョンの公開と作成」を選びます。
3. バージョン名は例 **`競輪ドラゴンLP クリック計測追加`**、説明には対象10イベントとサイト側反映日を記載します。
4. 内容を確認して公開します。コンテナが他サイトでも使われている場合は、今回のトリガーのホスト条件も再確認します。
5. プレビューを終了した通常のブラウザから操作し、GA4リアルタイムで受信を再確認します。

戻す必要があれば、GTMの「バージョン」から公開前の版を確認して再公開できます。ただし、その版以降の他の変更も戻るため、差分と担当者を確認してから実施します。GTMを戻してもサイト側のコードは戻らず、保存されるdataLayerの情報がGA4へ転送されなくなる構成です。

### うまく動かない場合

|症状|先に確認すること|
|---|---|
|Tag Assistantに `kd_...` が出ない|サイト側コードの本番反映、対象ホスト、接続したページ、ブラウザのエラー。旧HTMLやlocalhostでは出ない|
|`kd_...` は出るがタグが発火しない|カスタムイベントの正規表現・チェック欄・ホスト条件、タグへのトリガー設定、同意状態|
|変数が `undefined`|データレイヤーのキーの綴り、バージョン2、`kd_...` のイベント行を選択しているか|
|タグは発火するがGA4に見えない|測定ID・対象プロパティ、Tag Assistantのデバッグ接続、同意・ブロッカー・データフィルタ|
|1操作で同じ独自イベントが2回届く|同じイベントを送る旧タグ・別コンテナ・重複タグやリスナーがないか|
|DebugViewにはあるが集計画面で位置を選べない|GA4カスタム定義の登録名と範囲、登録後の反映待ち|

GTMに別のクリック計測JavaScriptを追加する必要はありません。サイト側のリスナーを二重に置かず、GTM側は上のイベントを受けて送信するタグを設定します。GA4の外部リンク `click`・PDF `file_download` は今回の独自イベントと別イベントとして収集され得るため、「全部のイベント数」をクリック数として合算しないでください。

外部リンクへ移動する操作を待機させたり、遷移を妨げたりはしません。実際のGA4への受信はネットワーク、タグ設定、同意状態、広告ブロッカーなどの影響を受けるため、dataLayerへの格納成功だけでGA4への受信成功とは判断しません。

## 検証

`npm run verify` で分類・パラメータ・本番ホスト判定の単体検証、`npm run test:browser` でPC／スマホの実クリック、FAQキーボード操作、閉じる操作、ローカル無送信、1操作1イベント、不要なFAQ情報の持ち越し、クエリ／ハッシュ未収集を確認します。外部のGTM／GA4サーバーへの送信・受信テストは含みません。

参考（Google公式）：

- [dataLayer](https://developers.google.com/tag-platform/tag-manager/datalayer)
- [カスタムイベントトリガー](https://support.google.com/tagmanager/answer/7679219?hl=ja)
- [GTMでのGA4イベント設定](https://support.google.com/tagmanager/answer/13034206?hl=ja)
- [GA4のDebugView](https://support.google.com/analytics/answer/7201382?hl=ja)
- [GA4のカスタムディメンション](https://support.google.com/analytics/answer/14240153?hl=ja)
- [GA4拡張計測](https://support.google.com/analytics/answer/9216061?hl=ja)

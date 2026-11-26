# さらば碧き面影（ロードオブメジャー原唱／V西2025 翻唱）

- 音訊為使用者提供的 `後はやるだけ！.mp3`，224.92 秒；內附 metadata 指向[原影片](https://www.youtube.com/watch?v=GGWhqMmOC3E)，本版翻唱《メジャー》第二季片頭曲〈さらば碧き面影〉，原唱為ロードオブメジャー。參見[日本媒體藝術資料庫](https://mediaarts-db.artmuseums.go.jp/id/C13091)。
- 兩張團體截圖 `source-a.png`、`source-b.png` 各有八位球員；`source-lead.png` 是監督樋口楓。合計十六位演唱／出場球員與一位監督。角色名稱依影片 credit 及[官方角色資料](https://www.nijisanji.jp/talents)核對。
- 歌詞 PV 編號 `13`（歌曲選單第 14 首）；第二版 YouTube ID `GGWhqMmOC3E`。預設舞台主唱為壱百満天原サロメ；樋口楓在選單中標示為「監督」。
- `lyrics-ja.txt` 逐行保存使用者提供的 41 行日文；`lyrics-zh.txt` 為繁中翻譯。以 faster-whisper medium 詞級時間戳對齊，補查末段英文重複句；不把間奏期間的辨識幻覺寫進字幕。輸出為根目錄的 `後はやるだけ！.srt`，時間不重疊且均在音訊長度內。
- 後半段另以獨立裁切音訊核對日文入唱點與英文重複句，修正第二次副歌部分句子提早約 0.6～0.8 秒、末段副歌及三句 Run 的時間，並保留換氣空檔。最後一段 Run 另以 214.3～217.0 秒裁切確認；完整 41 行歌詞不變。已核對的起訖保存在 [timings.json](timings.json)，執行 `node tools/build-vwest-subtitles.mjs` 可重建字幕。

## 人物與原圖位置

前三排索引按照 source-a、source-b 的「後排由左至右，再前排由左至右」，最後為監督。

| 索引 | 人物 | 參考圖 | imagegen 完整人物 | 播放器使用 |
| --- | --- | --- | --- | --- |
| 0 | 壱百満天原サロメ | source-a.png | [原圖](transparent-0.png) | [使用中切圖](../cast/vwest-0.png) |
| 1 | 家長むぎ | source-a.png | [原圖](transparent-1.png) | [使用中切圖](../cast/vwest-1.png) |
| 2 | Zeal Ginjoka | source-a.png | [原圖](transparent-2.png) | [使用中切圖](../cast/vwest-2.png) |
| 3 | 小野町春香 | source-a.png | [原圖](transparent-3.png) | [使用中切圖](../cast/vwest-3.png) |
| 4 | 矢車りね | source-a.png | [原圖](transparent-4.png) | [使用中切圖](../cast/vwest-4.png) |
| 5 | ハユン | source-a.png | [原圖](transparent-5.png) | [使用中切圖](../cast/vwest-5.png) |
| 6 | 早瀬走 | source-a.png | [原圖](transparent-6.png) | [使用中切圖](../cast/vwest-6.png) |
| 7 | Etna Crimson | source-a.png | [原圖](transparent-7.png) | [使用中切圖](../cast/vwest-7.png) |
| 8 | 渋谷ハジメ | source-b.png | [原圖](transparent-8.png) | [使用中切圖](../cast/vwest-8.png) |
| 9 | 戌亥とこ | source-b.png | [原圖](transparent-9.png) | [使用中切圖](../cast/vwest-9.png) |
| 10 | 狂蘭メロコ | source-b.png | [原圖](transparent-10.png) | [使用中切圖](../cast/vwest-10.png) |
| 11 | 本間ひまわり | source-b.png | [原圖](transparent-11.png) | [使用中切圖](../cast/vwest-11.png) |
| 12 | Nagisa Arcinia | source-b.png | [原圖](transparent-12.png) | [使用中切圖](../cast/vwest-12.png) |
| 13 | ラトナ・プティ | source-b.png | [原圖](transparent-13.png) | [使用中切圖](../cast/vwest-13.png) |
| 14 | エリー・コニファー | source-b.png | [原圖](transparent-14.png) | [使用中切圖](../cast/vwest-14.png) |
| 15 | 緋八マナ | source-b.png | [原圖](transparent-15.png) | [使用中切圖](../cast/vwest-15.png) |
| 16 | 樋口楓（監督） | source-lead.png | [原圖](transparent-16.png) | [使用中切圖](../cast/vwest-16.png) |

## 製作與重建

使用內建 imagegen，每位人物獨立生成透明 PNG，保留臉型、髮色、眼睛、原姿勢、棒球制服與自己的球具，補齊被其他成員遮住的輪廓及參考圖外的腿與鞋。下半身與被遮擋部分包含生成補全。所有原始截圖與完整生成圖均留在此資料夾。

執行 `node tools/build-vwest.mjs` 會清理生成 alpha 的低透明度殘留、確保白鞋與衣服實心、裁去透明空白、等比縮至最高 1100 像素、加上透明邊距，建立 `../cast/vwest-0.png`～`vwest-16.png` 與 `cast.json.vwest`，再合成 1920×1080 的 `group.png`。其他卡司群組不變。

歌詞舞台、人物 PV 與尾聲合照使用三排站位以容納全員；人物 PV 固定此十七人組，以 6×3 排列。球具與原本舉手姿勢使用保守的手腳擺幅。動畫快取容量依這組人數調整，避免十七人輪流被逐幀重新烘焙。

## imagegen 提示與模式

全部使用內建 image_gen，`transparent_background=true`，每位人物一個獨立呼叫。完整最終提示與對應參考路徑保存於 [prompts.json](prompts.json)；參考人物描述也保存在 [roster.json](roster.json)。監督圖另作一次定向修改，移除生成時多出的長外套衣襬；紅髮球員的頭盔會保留原圖款式。

# 我與國中畢業紀念冊的對話

四版歌名、分享網址及全文由使用者提供，各自保存完整 192 kbps MP3 與同步 SRT。兩版播放器及人物 PV 使用幸運八人，鋒兄、塗哥預設並列中央，歌詞 PV 使用金黃配色（`yearbook` 主題：牛皮紙與午後陽光，暗部也不帶紫）。

| 版本 | Suno 來源 | 曲目 ID | PV 編號 | 時長（秒） |
| --- | --- | --- | --- | --- |
| 中文 | [分享頁](https://suno.com/s/4psZ5vqffw3AswgQ) | `790c9c71-81f3-4f72-ad72-f5197c4390ee` | 34 | 234.57 |
| 英文 | [分享頁](https://suno.com/s/LQBoI5qzKMWSAzo5) | `de68c226-faf8-49fb-808d-6b1870f6d635` | 35 | 275.53 |
| 日文 | [分享頁](https://suno.com/s/cZc5IDNWbXaBatlo) | `ca32a0f1-d93d-46d7-ae9a-f998071d081e` | 36 | 253.61 |
| 粵文 | [分享頁](https://suno.com/s/p5P1LZ4dA4pjgtKe) | `9bd33601-d65a-4550-83c8-3df4a51ce1fe` | 37 | 263.17 |

第二版歌曲 ID 分別為 `suno-790c9c71`、`suno-de68c226`、`suno-ca32a0f1`、`suno-9bd33601`。所有原文、數字、姓名與用字均保留，不以語音辨識結果改寫。

中文長篇原文保存在 `lyrics-original.txt`，依語句拆成 `lyrics-zh.txt` 的 95 個短句；重建時比較去除空白的全文，確認分段沒有刪改文字。英文、日文、粵文原文分別保存在 `lyrics-en.txt`（92 行）、`lyrics-ja.txt`（108 行）、`lyrics-yue.txt`（109 行）。粵語實際重唱的「五同十八」與跳過兩句，在時間軸再次引用同一組原文行。

字幕以各版音訊的 faster-whisper 詞級時間戳對齊，對數字、繁簡字與日文讀音做比對時的正規化，僅用於找時間，不改寫字幕。片頭模糊段落另切段複核，職稱及末句核對演唱段落邊界；各語言時間軸獨立保存於 `timings-*.json`。

執行 `node tools/build-yearbook-subtitles.mjs` 可重建四版 SRT，驗證完整原文覆蓋、句子長度、無重疊及未超過音源長度。MP3、SRT、原文與時間軸均隨 repo 部署。

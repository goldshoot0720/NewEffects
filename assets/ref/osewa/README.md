# 最最最高級のお世話して：angela

TV 動畫《才女のお世話 高嶺の花だらけな名門校で、学院一のお嬢様(生活能力皆無)を陰ながらお世話することになりました》片頭曲。PV 編號 51，長度 194.11 秒。

## 素材

- 音源：使用者提供的 `angela「最最最高級のお世話して」Lyric Video.mp3`，另存為 repo 內的 `最最最高級のお世話して [angela].mp3`。
- 歌詞：使用者提供的日文原文，未改寫；長句依實際唱出的樂句拆成 46 句，重唱段落各自獨立成句（第二輪副歌比第一輪短，與原曲一致）。
- 繁中翻譯：本專案翻譯，逐句對應，寫在 `tools/build-osewa-subtitles.mjs` 的 `LINES`。
- 人物：使用者提供的八張官方全身立繪（`01-itsuki.png`～`08-kagen.png`），白底或已去背。

## 字幕時間軸

`faster-whisper large-v3-turbo`（`language=ja`、`word_timestamps`）先取詞級時間戳，再逐句核對樂句起訖；`tools/align-lyrics.py` 的 Levenshtein 對齊流程用在同一份 ASR 結果上。輸出時每句開頭提前 0.15 秒、句尾最多延 0.9 秒且不越過下一句，間奏時字幕不會停在畫面上。

```bash
node tools/build-osewa-subtitles.mjs   # → 最最最高級のお世話して.srt（46 句日中雙語）
```

## 人物切圖

八張立繪各自一位角色，PNG 已帶透明去背、JPG 是純白底；`tools/build-osewa.mjs` 對 PNG 直接用 alpha、對 JPG 從邊緣做白色洪水填充（白制服與白襪被線稿包住，不會被吃掉），只保留最大前景連通塊，等比縮到 976 px 高。

```bash
node tools/build-osewa.mjs   # → assets/ref/cast/osewa-0..7.png、cast.json 的 osewa 群組、群像 group.png
```

索引順序就是 PV 卡司順序，主唱（友成伊月）放第一位，舞台會排到正中央：

| # | 角色 | 出處 |
|---|------|------|
| 0 | 友成伊月 | 男主角，此花雛子的侍從 |
| 1 | 此花雛子 | 女主角，此花集團千金 |
| 2 | 天王寺美麗 | 天王寺家千金，學生會長 |
| 3 | 都島成香 | 伊月的青梅竹馬 |
| 4 | 鶴見静音 | 此花家女僕，侍從訓練負責人 |
| 5 | 大将勝也 | 同班同學 |
| 6 | 朝日花蓮 | 同班同學 |
| 7 | 此花華玄 | 此花家當主 |

名字依官方與 Anime News Network 的配音名單對照外型判定；5～7 號沒有出現在主要宣傳圖上，若之後有正式譯名再改 `pv.js`、`v2.html` 與 `cast.json` 的 `name` 即可。

## 群像

`assets/ref/osewa/group.png` 是 1920×1080 的學院禮堂群像：後排三人、前排五人，主角與大小姐在中央，底部打一盞暖光。`pv.js` 的 `ARTS.osewa.faces` 使用 `build-osewa.mjs` 印出的臉部座標。

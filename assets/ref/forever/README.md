# Forever＆ever

彩音的〈Forever＆ever〉，恋愛アドベンチャー《メモリーズオフ 双想 Break out of my shell》片頭曲。作詞彩音，作曲・編曲磯江俊道。使用者提供的音訊約 256.92 秒，檔案內的 YouTube ID 是 `31bvn6GUtaI`。

- `lyrics-ja.txt` 是使用者提供的 43 行日文，保留全形 `＆`、`Story－旅路－` 與 `Storyー旅路ー` 的兩種寫法、`扉ードアー`，以及「“約束”」「“誓い”」的空格。
- `lyrics-zh.txt` 是對應的 43 行繁中。
- `timings-ja.json` 是對到音訊後的 43 段時間軸，與 `lyrics-ja.txt` 逐行對應。片尾在第二次「世界まで変えよう」之後是間奏，接著只再唱「Storyー旅路ー」與「あの潮風に乗って」。
- 封面是使用者提供的單曲ジャケット，存成 `cover.png`。六位女主角的全身立繪來自 `standing.jpg`，去背後存成 `../cast/forever-0.png`～`forever-5.png`：フェルスター・マリー・暁空、田中結、北方和音、洲宮紗絵、天羽ねね、中森雪加。原圖手勢和抬腳都留著，所以 `armScale` 是 0.08、`legScale` 是 0.15。預設主唱是洲宮紗絵。

時間軸用本機 faster-whisper medium 的詞級時間戳，再以 `tools/align-lyrics.py` 對到歌詞。片尾那六句曾因詞級時間戳擠在一起、改依前段副歌句長平移，畫面會在沒有演唱的間奏裡把前段副歌再播一次；這六句已拿掉。「踏み出そう　明日へ」改對到實際起唱（約 177.9 秒），最後兩句改對到約 228.7 秒與 235.2 秒。`tools/build-srt.py` 寫成根目錄的 `Forever＆ever.srt`。

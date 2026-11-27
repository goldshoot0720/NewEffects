# 最瞎結婚理由：中、英、粵、日四版

四首均由使用者提供 Suno 分享網址及完整歌詞，分別保存 MP3 與單語 SRT。使用者原文保存在本目錄的 `lyrics-zh.txt`、`lyrics-en.txt`、`lyrics-yue.txt`、`lyrics-ja.txt`；保留牙妹／魚妹、Ya Girl／Yu Girl、日文假名與空格等原文，不用語音辨識結果替換歌詞。

| 版本 | 來源 | Suno 曲目 ID | PV 編號 | 播放器 ID |
| --- | --- | --- | --- | --- |
| 中文 | [Suno](https://suno.com/s/VCpupfbF5YCIhf4r) | `a5f4dd34-ebe3-45c7-b5bd-2b4881f5823a` | 14 | `suno-a5f4dd34` |
| 英文 | [Suno](https://suno.com/s/8M3vUnOKsoo5vw5g) | `c7446110-06dc-49d4-a70f-5657453fb3de` | 15 | `suno-c7446110` |
| 粵文 | [Suno](https://suno.com/s/GeQk8VNJzfBZuocn) | `06d8d042-e382-4a70-931b-aeb6b0c7d9c3` | 16 | `suno-06d8d042` |
| 日文 | [Suno](https://suno.com/s/EERzGqMqJEbTWNzZ) | `1989dbe7-a696-48ca-8636-4ce544d42f72` | 17 | `suno-1989dbe7` |

分享頁模型皆為 `v6-mini`。中文原曲標題為「最瞎結婚理由 鋒兄 小塗 牙妹 魚妹 歌詞微調」，其他三版各有語言前綴。介面簡稱「最瞎結婚理由」，另三版加上「英文歌詞」、「粵文歌詞」及「日文歌詞」以區別。

音源由公開分享頁的播放來源取得，轉為 192 kbps MP3。中文約 165.89 秒、英文約 179.37 秒、粵文約 164.01 秒、日文約 190.81 秒，均為全曲。字幕使用本機 faster-whisper medium 的詞級時間戳，日文模糊段落另以 small 模型切段複核，依使用者原文逐句核對斷句；保留片頭、吉他間奏與片尾空白，沒有將整曲歌詞平均分配到音訊長度。

`timings-zh.json`（33 句）、`timings-en.json`（34 句）、`timings-yue.json`（34 句）、`timings-ja.json`（34 句）保存時間軸。執行 `node tools/build-wedding-subtitles.mjs` 可重建`subtitles/` 下的四份 SRT，並檢查句數、時間先後、重疊及音源長度。

兩版播放器與人物 PV 沿用現有幸運八人（含 Claude 娘與 GPT 娘），鋒兄、塗哥預設並列中央，其他人物輪流出現。這次未更換既有人物素材，也未修改其他歌曲。

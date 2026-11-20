# TRAIN-TRAIN（カバー）

長度 246.13 秒，52 句日中雙語字幕。

## 檔案

| 檔案 | 內容 |
| --- | --- |
| `asr-ja.json` | `tools/asr.py`（faster-whisper large-v3-turbo）的逐句時間 |
| `../../TRAIN-TRAIN.srt` | 字幕，由 `tools/build-cover5-subtitles.mjs` 產生 |

角色素材沿用 `assets/ref/rolling/`（ローリング☆ガールズ 四人），沒有另外切圖。

## 時間軸

ASR 很準，主要是把「走って行け／どこまでも」照歌詞拆成獨立句。

ASR 有多處名詞聽錯（例如「金網」「ハックルベリー」「本当の声」），字幕一律以使用者提供的歌詞為準。

重建：

```bash
node tools/build-cover5-subtitles.mjs
```

# 夕暮れ（カバー）

長度 251.97 秒，26 句日中雙語字幕。

## 檔案

| 檔案 | 內容 |
| --- | --- |
| `asr-ja.json` | `tools/asr.py`（faster-whisper large-v3-turbo）的逐句時間 |
| `../../夕暮れ.srt` | 字幕，由 `tools/build-cover5-subtitles.mjs` 產生 |

角色素材沿用 `assets/ref/rolling/`（ローリング☆ガールズ 四人），沒有另外切圖。

## 時間軸

整首 ASR 漏掉第一句，16.96 秒起用 6–24 秒的局部視窗補；112.61–148.40 秒是間奏。

ASR 有多處名詞聽錯（例如「金網」「ハックルベリー」「本当の声」），字幕一律以使用者提供的歌詞為準。

重建：

```bash
node tools/build-cover5-subtitles.mjs
```

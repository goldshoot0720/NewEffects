# 終わらない歌（カバー）

長度 179.12 秒，32 句日中雙語字幕。

## 檔案

| 檔案 | 內容 |
| --- | --- |
| `asr-ja.json` | `tools/asr.py`（faster-whisper large-v3-turbo）的逐句時間 |
| `../../終わらない歌.srt` | 字幕，由 `tools/build-cover5-subtitles.mjs` 產生 |

角色素材沿用 `assets/ref/rolling/`（ローリング☆ガールズ 四人），沒有另外切圖。

## 時間軸

整首 ASR 只抓到第 1、4 句，中間兩句用 6–34 秒的局部視窗補齊。

ASR 有多處名詞聽錯（例如「金網」「ハックルベリー」「本当の声」），字幕一律以使用者提供的歌詞為準。

重建：

```bash
node tools/build-cover5-subtitles.mjs
```

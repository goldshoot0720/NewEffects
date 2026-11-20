# 脳天気（カバー）

PV 編號見 README。長度 257.13 秒，17 句日中雙語字幕。

## 檔案

| 檔案 | 內容 |
| --- | --- |
| `asr-ja.json` | `tools/asr.py`（faster-whisper large-v3-turbo）的逐句時間 |
| `../../脳天気.srt` | 字幕，由 `tools/build-notenki-subtitles.mjs` 產生 |

角色素材沿用 `assets/ref/rolling/`（ローリング☆ガールズ 四人），沒有另外切圖。

## 時間軸

0–30 秒前奏，102–131 秒是「いい天気だ」呼喊段。

ASR 有多處名詞聽錯（例如「金網」聽成「花網」、「ハックルベリー」聽成「ハッフルデリー」、「行きたい」聽成「生きたい」），字幕一律以使用者提供的歌詞為準。

重建：

```bash
node tools/build-notenki-subtitles.mjs
```

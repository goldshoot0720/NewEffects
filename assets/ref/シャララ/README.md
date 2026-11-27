# シャララ（カバー）

長度 169.61 秒，18 句日中雙語字幕。

## 檔案

| 檔案 | 內容 |
| --- | --- |
| `asr-ja.json` | `tools/asr.py`（faster-whisper large-v3-turbo）的逐句時間 |
| `../../../subtitles/シャララ.srt` | 字幕，由 `tools/build-cover5-subtitles.mjs` 產生 |

角色素材沿用 `assets/ref/rolling/`（ローリング☆ガールズ 四人），沒有另外切圖。

## 時間軸

開頭 7 秒是「シャララ」的清唱，中間 111–131 秒是「Oh-oh-oh」呼喊段。

ASR 有多處名詞聽錯（例如「金網」「ハックルベリー」「本当の声」），字幕一律以使用者提供的歌詞為準。

重建：

```bash
node tools/build-cover5-subtitles.mjs
```

2026-11-21：拆出 131.60–134.54 秒的歌詞與前後長音，下一句在 138.18 秒才開始。見 `../sync-audit/2026-11-21.md`。

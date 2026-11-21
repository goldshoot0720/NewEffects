# Chase the Light!（Fear, and Loathing in Las Vegas）

PV 編號 57，長度 221.77 秒。

## 檔案

| 檔案 | 內容 |
| --- | --- |
| `asr-ja.json` | `tools/asr.py`（faster-whisper large-v3-turbo）的逐句時間，**僅供段落邊界參考** |
| `../../Chase the Light!.srt` | 39 句日中雙語字幕，由 `tools/build-chase-subtitles.mjs` 產生 |

## 時間軸

這首是高速電子金屬，英文段落 ASR 幾乎全錯。實測兩次（無提示詞、帶歌詞提示詞）都只得到類似下面的幻聽：

```
Time to die / I feel like I need to enjoy / My friend took us all to fight you all
I can't do it with my life / Paranacally / FERONOCALLY
```

所以時間軸不用逐句 ASR，而是用**段落錨點＋段內字數比例分配**：

| 區段 | 範圍 | 內容 |
| --- | --- | --- |
| 前奏 | 0–30.00 | 無字幕 |
| 日文主歌 | 30.00–39.70 | 3 句，用 ASR 的詞邊界定錨 |
| 英文 A | 39.70–66.18 | 12 句，其中 55.18–57.98 秒兩句呼喊另有獨立切片錨點，其餘按字數分配 |
| 英文 A′ | 69.80–76.38 | 2 句 |
| 日文副歌 | 78.20–98.12 | 6 句，用 ASR 的詞邊界定錨 |
| 嘶吼／間奏 | 98.12–151.70 | 無字幕（能量持續但無對應歌詞） |
| 英文 B | 151.70–216.34 | 16 句，段內按字數分配 |
| outro | 216.34–221.77 | 無字幕 |

**已知限制**：英文段落的句內時間是比例推估，不是逐句實測，可能與實際咬字差 0.5–1.5 秒。若要更準，需要人耳逐句校對後直接改 `LINES`／`SPANS` 裡的時間再重跑。

重建：

```bash
node tools/build-chase-subtitles.mjs
```

2026-11-21：獨立英文切片再次確認「Take it easy」與「It's gonna be alright」的段落，見 `../sync-audit/2026-11-21-probes.json`；其餘英文仍不能宣稱逐句同步。兩版舞台與人物 PV 統一使用 kaiji 八人。

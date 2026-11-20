# 人にやさしく（THE ROLLING GIRLS）

TV 動畫《ローリング☆ガールズ》ED 主題曲的翻唱版。PV 編號 54，長度 201.45 秒。

## 檔案

| 檔案 | 內容 |
| --- | --- |
| `lineup.jpg` | 使用者提供的四人並排立繪（純白背景，1024×1536），切圖來源 |
| `asr-ja.json` | `tools/asr.py`（faster-whisper large-v3-turbo）的逐句與逐詞時間 |
| `../../人にやさしく.srt` | 35 句日中雙語字幕，由 `tools/build-rolling-subtitles.mjs` 產生 |

## 字幕時間軸

`asr-ja.json` 的逐句結果直接當底：0–103.4 秒是兩段主歌，103.4–136 秒是純間奏（波形能量連續、沒有換氣，ASR 在 130–136 秒冒出的「はんばれ」是幻聽，不收），136–171.5 秒是最後一段，171.5 秒之後進 outro。長句依樂句切開，例如「気が狂いそう」與「やさしい歌が好きで」中間隔了 2.3 秒，就分成兩句。

重建：

```bash
node tools/build-rolling-subtitles.mjs
```

## 角色切圖

四位角色森友望未、御園千綾、響逢衣、小坂結季奈由 `tools/cutout-rolling.py` 從 `lineup.jpg` 切出：

1. 依列佔用率的谷值定分界（286 / 528 / 822），第三位舉起的手臂會伸進第四位的區域，所以邊界要取到 822。
2. 近白像素從邊界連通才移除，裙子的白色不會被吃掉。
3. **只保留最大連通域，而且不要先做 closing**——先 closing 會把鄰人的身體和本人黏成一塊，切出來的圖右側會多一塊別人的衣服。
4. 輸出 `assets/ref/cast/rolling-0..3.png`，寫入 `assets/ref/cast/cast.json` 的 `rolling` 群組，並拼成群像 `assets/ref/rolling-group.png`（1920×1080，夜景街道）。

重建：

```bash
python3 tools/cutout-rolling.py
```

## 已知限制

這首沒有逐字填色（`fill`），卡拉OK 填色走 `pv.js` 的線性＋能量估算。若要逐字對時，可仿 `tools/build-perfect-fill.mjs`，以 `asr-ja.json` 的詞級時間對齊。

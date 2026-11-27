# マトリョーシカ（NICO Touches the Walls）／[C] OP

PV 編號 59，長度 300.35 秒。同作的 ED「RPG」為 PV 60，共用這組素材。

## 檔案

| 檔案 | 內容 |
| --- | --- |
| `lineup-clean.jpg` | 使用者提供的九人立繪（黑底、無名牌，1821×864），目前切圖來源 |
| `lineup.jpg` | 較早的版本（附名牌，1822×863），僅作備份 |
| `asr-ja.json` | `tools/asr.py`（faster-whisper large-v3-turbo）的逐句時間 |
| `../../../subtitles/マトリョーシカ.srt` | 33 句日中雙語字幕，由 `tools/build-matryoshka-subtitles.mjs` 產生 |

## 字幕時間軸

整首 ASR **漏掉開頭**（兩次都從 30.00 秒才開始），23.00 秒的第一句是另外用 16–36 秒的局部視窗補回來的。段落：

- 0–23.00 前奏
- 23.00–134.48 第一、二段
- 134.48–156.72 間奏
- 156.72–217.12 第三段
- 217.12–234.12 間奏
- 234.12–245.87 收尾（含最後一句「マトリョーシカ」）
- 245.87–300.35 outro

ASR 把「マトリョーシカ」聽成「惑う力」、「引っ剥がして」聽成「引っ張らして」、「ありったけ」聽成「ありった元気」，字幕一律以使用者提供的歌詞為準。

## 角色切圖

`tools/cutout-matryoshka.py` 從黑底立繪切出九人：

優先使用無名牌原圖，保留完整鞋底。從邊界移除相連的黑色背景，清除零星的 JPEG 雜點，再沿相鄰人物的輪廓分開手指、衣物與鞋子。帶名牌的備用原圖才會裁去底部名牌。

輸出為 `assets/ref/cast/matryoshka-0..8.png`。原圖座標與尺寸存於 `cast.json`，群像為 `assets/ref/matryoshka-group.png`。

重建：

```bash
python3 tools/cutout-matryoshka.py
```

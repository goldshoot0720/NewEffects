# RPG（School Food Punishment）

PV 編號 60，長度 245.32 秒。

## 檔案

| 檔案 | 內容 |
| --- | --- |
| `asr-ja.json` | `tools/asr.py`（faster-whisper large-v3-turbo）的逐句時間 |
| `../../../subtitles/RPG.srt` | 43 句日中雙語字幕，由 `tools/build-rpg-subtitles.mjs` 產生 |

角色素材沿用 `assets/ref/matryoshka/`（同一組九人精靈），沒有另外切圖。

## 時間軸

整首 ASR **漏掉開頭兩句**（從 31.18 才開始），22.94 起是另外用 18–36 秒的局部視窗補的：

- 22.94–26.42 窓からそっとエスケープして
- 26.42–33.84 夜の街が RPGに変わる

120–135 秒那段也用局部視窗細分（逐詞：闇 120.18、play 122.92、君 127.14、リセット 132.88）。

段落：22.94–79.54 第一段、89.76–147.24 第二段、168.20–212.86 第三段、212.86–245.32 outro。

ASR 把「RPG」聽成「ロールブレイク／Row Break Game」、「AorB」聽成「A.O.P.J.」，字幕一律以使用者提供的歌詞為準。

重建：

```bash
node tools/build-rpg-subtitles.mjs
```

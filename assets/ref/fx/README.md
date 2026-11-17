# FX戦士くるみちゃん：福賀くるみ(CV.鈴木愛奈)

TV 動畫《FX戦士くるみちゃん》片頭曲。PV 編號 53，長度 203.75 秒。

## 素材

- 音源：使用者提供的 `FX戦士くるみちゃん.mp3`（5,101,721 bytes）。
- 日文原文：歌ネット（uta-net.com/song/400331）公開歌詞，未改寫；依實際唱出的樂句拆成 60 句，重複的「押せ！」保留四段。
- 繁中翻譯：本專案翻譯，逐句對應，寫在 `lyrics-zh.txt`。
- 人物：使用者提供的四張官方透明立繪（`kurumi.png`、`mochiko.png`、`mebuki.png`、`yasuko.png`），由 `tools/cutout-fx.py` 裁切並拼成群像 `assets/ref/fx-group.png`。

## 字幕時間軸

這首節奏快、口白與喊唱交錯，`whisper-cli large-v3-turbo` 的辨識文字不可用，但分段時間可靠：以 ASR 的分段邊界當錨點，逐段核對樂句起訖後寫進 `timings-ja.json`（每句標 `final: true`，不再提前或延長）。間奏 59–78 秒與 89–91 秒不掛字幕。

```bash
python3 tools/build-srt.py assets/ref/fx/timings-ja.json assets/ref/fx/lyrics-zh.txt FX戦士くるみちゃん.srt
```

## 卡司

四位：福賀くるみ（主唱，索引 0）、小金萌智子、山師芽吹、高根やす子。舞台分鏡對四人卡司另有一組站位（兩側、後排中央、主唱前方），見 `pv.js` 的 `shotStage`。

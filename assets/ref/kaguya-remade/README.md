# 超かぐや姫！三人重製（補回手腳）

原始素材是三張歌詞影片定格（`../kaguya-casual.jpg`、`kaguya-beach.jpg`、`kaguya-fox.jpg`）。定格裡人物被畫面邊緣裁切：

- かぐや（黑色連身裙）：站立的腳在畫面下緣之外，切圖只剩一條腿。
- 彩葉（沙灘跑步）：往前伸的手與前腳被畫面右緣切掉。
- ツキ（祭典彈鍵盤）：只有上半身，欄杆以下完全看不到。

因此改用內建 imagegen 依原圖逐位重畫成完整全身立繪，保留臉、髮色、眼睛、服裝與姿勢，補回被裁掉的手掌、腿與腳。

## 檔案

| 索引 | 人物 | 模型原圖 | 前景遮罩 | 透明立繪 | 使用中的切圖 |
| --- | --- | --- | --- | --- | --- |
| 0 | かぐや · 黑色連身裙、銀灰長髮、紅眼、赤腳 | generated-0.png | matte-0.png | transparent-0.png | ../cast/kaguya-0.png |
| 1 | 彩葉 · 深紫高馬尾、薄荷綠兩件式、白鞋、跑步 | generated-1.png | matte-1.png | transparent-1.png | ../cast/kaguya-1.png |
| 2 | ツキ · 金色狐狸、奶油白口鼻、深棕手腳、彈鍵盤 | generated-2.png | matte-2.png | transparent-2.png | ../cast/kaguya-2.png |

模型輸出是 1024×1536、`background: transparent`，但實際回傳的是把棋盤格畫進去的全不透明 PNG；因此再用 `tools/matte-vision.py` 產生 `matte-N.png`（右下角的浮水印不會被選為前景），合成後才是真正的透明圖。

## 重建

```bash
python3 tools/build-kaguya-remade.py
```

裁透明邊、加 8px 邊距後覆寫 `assets/ref/cast/kaguya-0..2.png`，更新 `cast.json` 的 `kaguya` 群組（三張都標 `intact: true`），並重建 1920×1080 群像 `../kaguya-group.png`（彩葉左、ツキ右、かぐや站前排中央）。

舊的 `tools/cutout-kaguya.py` 仍保留，用來從原始定格重建對照用的切圖；`cast.json` 的 `source` 欄位沿用舊切圖的座標。

## imagegen 提示重點

每位各呼叫一次，`image1` 是對應的定格，`aspect_ratio` 取直式（1024×1536），`quality=high`、`input_fidelity=high`：

```text
Use case: identity-preserve. Asset type: exactly ONE isolated full-body anime character sprite
for a browser dance rig, on a fully transparent background.
Input image: <該位角色所在的定格與外觀描述>
Primary request: reconstruct this exact character as ONE complete full-body sprite. Keep the exact
face, hair, eye colour, costume and pose. Because the source frame cuts off <缺漏部位>,
redraw the missing <手／腿／腳> so both hands and both feet are complete.
Remove <背景物件>. No text, no watermark, no ground shadow. Single character only, full body
from head to toes, transparent background.
```

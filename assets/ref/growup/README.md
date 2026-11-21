# ユラリユレル：ひまわりサーカス十人

歌曲：NOMELON NOLEMON〈ユラリユレル〉，音訊為使用者提供的 yurariyureru.mp3（208 秒），內含 YouTube ID `2SHNY5v6DnM`。歌名與作品關係參照 [Sony Music 官方歌曲資訊](https://www.sonymusic.co.jp/PR/NOMELONNOLEMON/info/584231)，人物名稱與圖片順序核對 [動畫官方角色資料](https://growupshow.com/)。

本曲為 2026 年 TV 動畫《グロウアップショウ ～ひまわりのサーカス団～》OP，ED 為 Aooo〈DAYS!〉（[動畫官方主題歌資訊](https://growupshow.com/news/?id=70612)）。兩段式選單依日文歌名辨認作品，兩曲共用同一動畫分類；不以音檔別名 `yurariyureru` 建立獨立分類。

使用者提供十張人物圖，原圖保存為 `source-0.png`～`source-9.png`。以內建 imagegen 逐張去除黃色背景、地面及側邊文字，保留服裝、臉型、髮型與原本姿勢；透明輸出為 `transparent-0.png`～`transparent-9.png`，沒有把合掌、叉腰、抱臂或抬腿姿勢改成 T-pose。

| 索引 | 人物 | 透明原圖 | 使用中的切圖 |
| --- | --- | --- | --- |
| 0 | 鶴巻瑞佳 | transparent-0.png | ../cast/growup-0.png |
| 1 | 川澄桜翔 | transparent-1.png | ../cast/growup-1.png |
| 2 | 吾野伊万里 | transparent-2.png | ../cast/growup-2.png |
| 3 | 五十土五十鈴 | transparent-3.png | ../cast/growup-3.png |
| 4 | 由良 葵 | transparent-4.png | ../cast/growup-4.png |
| 5 | 由良 茜 | transparent-5.png | ../cast/growup-5.png |
| 6 | 酒匂 雫 | transparent-6.png | ../cast/growup-6.png |
| 7 | スヴェトラーナ | transparent-7.png | ../cast/growup-7.png |
| 8 | 間宮 凛 | transparent-8.png | ../cast/growup-8.png |
| 9 | 麻利亜 | transparent-9.png | ../cast/growup-9.png |

`node tools/build-growup.mjs` 保留既有 alpha，裁掉外側透明留白並加上 8 像素透明邊距，更新 `cast.json` 的 growup 群組，並拼成 1920×1080 的 `group.png`。十人以 5×2 排列；人物 PV 固定這組卡司，預設主唱為鶴巻瑞佳。原圖包含合掌、抱臂、長裙與單腳抬起等姿勢，故設定 `armScale: 0.08`、`legScale: 0.15` 降低四肢轉角，保留跳躍、側擺與輕踏步；其他卡司未指定這些值時維持原擺幅。吾野伊万里的綠裙另以內建 imagegen 修補衣服內部的透明瑕疵。

`yurariyureru.srt` 有 39 段逐句日中雙語字幕。日文逐行保留使用者歌詞中的「あたし／わたし」差異；「新增歌曲和歌詞」屬於操作指示，未納入歌詞。時間軸依本機 faster-whisper medium 詞級時間戳整理，對重複副歌、和聲與間奏另做分段核對。每段第一行日文、第二行繁中，時間不重疊且位於音訊長度內。

## 內建 imagegen 最終提示（十張各使用相同提示）

```text
Use case: background-extraction.
Asset type: one transparent full-body anime character sprite for a browser music stage.
Edit target: the single full-body character in the supplied yellow promotional character image.
Primary request: remove ONLY the yellow/orange geometric background, patterned ground, ground shadow, and all vertical promotional text at the left edge. Keep the exact original single character: same recognizable face, expression, hair, eyes, costume, original pose, proportions, colors, fine outlines and soft anime cel shading. Preserve every part of the silhouette including fingers, sleeves, shoes, socks, hair strands, hats, ribbons, and clothing panels. This is a faithful clean cutout, not a redesign. Do not change the pose or invent a T-pose; preserve hands clasped, hands behind the body, crossed arms or bent leg exactly when present.
Background: genuinely alpha transparent, including enclosed spaces between arms and body, between legs, and around hair. Remove background through those gaps without removing white garments, skin, yellow/orange costume elements or light-colored shoes.
Framing: the complete character from hair/hat top to both shoe soles, with clear transparent margin on all sides. Keep proportions, no stretching. No extra person, text, logo, ground, glow, shadow or painted checkerboard. Output transparent RGBA PNG.
```

## 吾野伊万里透明度修補提示

```text
Use case: precise-object-edit.
Edit target: reference 1, the existing transparent pink twin-tail girl sprite wearing a yellow-and-white striped blouse and green long skirt. Reference 2 is her original yellow-background character art for accurate colors and details.
Change ONLY the defective transparency mask. Keep exact face, hair, expression, pose, body, costume, folds, colors and outline. The current transparent sprite has translucent cloudy holes INSIDE the green skirt. Make ALL interior areas of her green skirt, blouse, skin, hair, socks and shoes fully opaque. Alpha should only vary at the actual outer contour and true gaps between body parts. Do not change green skirt color, folds, pose, geometry, proportions or any painted interior pixels. Remove tiny detached background specks outside the silhouette and any yellow/white edge halos. Keep all strands, fingers and both shoes. Everything outside the true silhouette must be alpha zero. No yellow background, no floor, no text, no glow, no new objects. Output a genuinely transparent RGBA PNG of this same single complete character.
```

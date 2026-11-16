# 黃昏舞台服九人重製

原始合圖保存為 `source.webp`（同 `assets/ref/stage9.webp`，1774 × 887）。九位角色在同一張照片裡互相重疊：裙襬、手臂與頭髮橫跨彼此的範圍。

舊的 `tools/cutout.mjs` 以固定垂直分割線（x = 257 / 419 / 590 / 780 / 972 / 1153 / 1320 / 1496）切 `stage9-matte.png`，第二輪允許角色擴張越過分割線，於是每張切圖都黏著鄰居的裙襬碎片，邊緣是直切的垂直硬邊——這是本組素材嚴重破圖的原因。

本組改用內建 imagegen 逐位重製：輸入都是 `source.webp`，`Selected character` 代入下一節對應敘述，並要求只輸出該位角色的透明立繪。生成結果存為 `generated-N.jpg`（模型原始輸出，底色為白或黑），再交給專用去背工具轉成 `transparent-N.png`（RGBA，900 × 1820）。去背服務在較大的輸入上偶爾逾時，重試時把輸入縮到 700 寬即可。

## 索引與來源

| 索引 | 人物特徵 | 去背後透明原圖 | 原始生成圖 | 使用中的切圖 |
| --- | --- | --- | --- | --- |
| 0 | 最左，銀金長髮，單手高舉揮手 | transparent-0.png | generated-0.jpg | ../cast/stage-0.png |
| 1 | 左二，淺棕髮紮起配大白蝴蝶結 | transparent-1.png | generated-1.jpg | ../cast/stage-1.png |
| 2 | 左三，深棕長髮，眨眼並比 V 手勢 | transparent-2.png | generated-2.jpg | ../cast/stage-2.png |
| 3 | 左四，蜜桃橘長髮配白蝴蝶結，綠眼 | transparent-3.png | generated-3.jpg | ../cast/stage-3.png |
| 4 | 左五，棕髮，紫眼，雙手合十 | transparent-4.png | generated-4.jpg | ../cast/stage-4.png |
| 5 | 左六，赭紅長髮，綠眼，一手向前伸出 | transparent-5.png | generated-5.jpg | ../cast/stage-5.png |
| 6 | 左七，棕色短鮑伯頭，青綠眼 | transparent-6.png | generated-6.jpg | ../cast/stage-6.png |
| 7 | 左八，及膝黑色長直髮，藍眼 | transparent-7.png | generated-7.jpg | ../cast/stage-7.png |
| 8 | 最右，深棕髮帶棕梢與黑色蝴蝶結，琥珀眼，單手高舉 | transparent-8.png | generated-8.jpg | ../cast/stage-8.png |

九人穿著同一套服裝：白色荷邊短袖上衣（荷邊領口與袖口）、胸前深藍蝴蝶結、金色菱形鈕扣、 waist 深藍緞帶蝴蝶結、淺藍多層荷邊裙、白色蕾絲邊過膝襪、白色高跟鞋配深藍踝蝴蝶結。

## 重建與使用

執行 `node tools/build-stage-remade.mjs`：保留透明原圖的 alpha，裁去外側透明空白並加 8 像素透明邊距，替換 `cast/stage-0.png`～`stage-8.png` 與 `cast.json` 的 stage 群組。完整重建入口 `node tools/cutout.mjs` 會略過 stage 舊的垂直分割切割，改用這組重製素材。

人物 PV 的舞台段落是整張群像 `assets/ref/stage9-matte.png` 畫的（`pv.js` 的 `group.matte`），本組切圖只用於 `cast.html` 素材頁與下載。因此 `cast.json` 的 `source` 欄位沿用舊切圖的中線與底線，讓 PV 上的編號與光暈仍對準群像裡的同一位角色。

## 內建 imagegen 最終提示模板

每位人物各呼叫一次工具；輸入皆為 `source.webp`，`Selected character` 代入下一節對應敘述，並設定 `aspect_ratio=1:2`、`area=2K`、`output_format=png`。

```text
Use case: identity-preserve.
Asset type: exactly ONE isolated transparent full-body anime character sprite for a browser dance rig.
Input image: Picture 1 is a dusk concert-stage photo of nine anime girls standing in a row from left to right. They wear the same frilly white-and-blue idol dress and they overlap each other, so each girl's skirt and hair partly covers her neighbours.
Selected character: <insert the indexed character description below>.
Primary request: isolate ONLY this selected character and reconstruct a clean, independent sprite. Keep her exact recognizable face, hairstyle, eye color, expression, original pose, body proportions and every costume detail of the shared idol dress (white frilled short-sleeve blouse with a ruffled collar and ruffled cuffs, a navy-blue bow at the chest, small gold diamond buttons, a navy-blue sash bow at the waist, a layered pale-blue frilly tiered skirt, white lace-top thigh-high stockings, and white high-heeled shoes with navy ankle bows). Remove the other eight people, ALL background scenery, sky, stage structure, floor and floor reflections, and every tiny neighboring-person fragment. Where her outer silhouette is hidden by a neighboring character, reconstruct ONLY the missing garment, hair or body edge consistently with her own original design. Do not retain any neighbor body parts, neighbor hair, neighbor hands, or neighbor dress edges.
Composition: a single complete figure from hair top to both shoe soles, with generous transparent padding on all four sides. No clipping, no stretching. Keep the original pose; do not invent a T-pose or a new costume.
Alpha requirements: actual transparent background including true gaps between legs, hair, arms and body. All interiors of skin, white blouse, white stockings and white shoes must be fully opaque; no cloudy transparent holes. Clean antialiased outline with no white, blue or colored halo. Preserve complete hands, all fingers, shoe tips and hair tips. No scenery, no ground, no shadows, no glow, no painted checkerboard, no captions, no extra characters, no duplicated limbs, no stray fabric rectangles.
Output: portrait RGBA PNG containing just the one selected full-body character.
```

完整請求保存在本機的 `imagegen-request.json`（已加入 `.gitignore`，不進 repo；參考圖網址以 `__UPLOADED_TEMP_URL__` 占位，避免把簽名網址寫進版控）。重跑流程：`mcode-tools upload_temp_url assets/ref/stage-remade/source.webp` 取得 `temp_url`，再執行 `REF_URL=<temp_url> node tools/build-stage-request.mjs` 產生帶真實網址的請求檔，接著 `mcode-tools connector call connector__matrix__generate_image --args-file assets/ref/stage-remade/imagegen-request.json`。生成結果是白底或黑底的不透明 PNG，再交給去背工具轉成 `transparent-N.png`。

## 各人物的 Selected character 敘述

### 0

far-left character, number 1 of 9: very long light ash-blonde hair reaching past her hips, pink-red eyes, cheerful open smile, her right arm raised high above her head with an open waving palm, her left hand held near her chest, and a white rose hair ornament with a gold ribbon on the right side of her head

### 1

second from left, number 2 of 9: light brown hair tied up with a large white bow at the back of her head, blue eyes, open-mouth smile, and both hands raised in front of her chest as small curled fists

### 2

third from left, number 3 of 9: long dark brown hair, winking with one eye closed and a wide open smile, her right hand making a V peace sign beside her face, and a white rose ornament with a gold ribbon on the right side of her head

### 3

fourth from left, number 4 of 9: very long peach-orange hair with a large white bow on the left side of her head, green eyes, bright smile, and both hands clasped together in front of her chest

### 4

fifth from left, number 5 of 9: medium brown hair, violet-purple eyes, gentle smile, both hands clasped together in front of her chest, and a white rose ornament with a gold ribbon on the left side of her head

### 5

sixth from left, number 6 of 9: long auburn reddish-brown hair, green eyes, cheerful smile, her right arm extended forward toward the viewer with an open upturned palm and her left hand at her chest, and a white rose ornament with a gold ribbon on the left side of her head

### 6

seventh from left, number 7 of 9: short brown bob haircut, teal-blue eyes, open-mouth smile, her right hand placed over her chest, and a white rose ornament with a gold ribbon on the left side of her head

### 7

eighth from left, number 8 of 9: extremely long straight black hair reaching past her knees, blue eyes, calm soft smile, both hands clasped together in front of her chest, and a white rose ornament with a gold ribbon on the left side of her head

### 8

far-right character, number 9 of 9: long dark brown hair with lighter brown tips and a large black hair bow on top of her head, amber-golden eyes, confident grin, and her left arm raised high above her head with an open hand

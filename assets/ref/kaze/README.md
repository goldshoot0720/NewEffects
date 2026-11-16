# 風の中は走るっきゃないっ！ 七人（生徒会にも穴はある！）

「風の中は走るっきゃないっ！」是三月のパンタシア演唱的 TV 動畫《生徒会にも穴はある！》片頭曲（2026 年 10 月播出，單曲 11 月 25 日發行）。這首歌原本沿用 ED 曲「ぴ」的 anaru 群組（站姿看板圖），本組改用官方網站公開的 OP 版角色立繪：六人各自單獨去背、正在跑步的造型，正好對應歌名；第七位是使用者另外指定的單曲封面少女。

## 素材來源

| 檔案 | 內容 | 出處 |
| --- | --- | --- |
| `op-chara-1.png` … `op-chara-6.png` | 官方網站的六人 OP 立繪（2880 × 1500 RGBA，每張單獨一人，已去背） | [生徒会にも穴はある！官方網站](https://nama-anaru.com/) `teaser_assets/img/op/op_chara_1..6.png` |
| `cover-girl-raw.png` | 封面少女的 imagegen 原圖（1024 × 1536，白底） | 內建 imagegen 參照 `../kaze-cover.jpg` 重畫 |
| `cover-girl.png` | 同一張去背後的全身透明立繪（1024 × 1536 RGBA），`build-kaze.mjs` 的輸入 | `tools/key-white-bg.py` 白底連通填色去背 |
| `group.png` | 由七張切圖拼出的 1920 × 1080 群像主視覺（青藍到粉紅漸層，沿用單曲封面配色） | 由 `node tools/build-kaze.mjs` 產生 |
| `../kaze-cover.jpg` | 使用者提供的單曲封面（1279 × 720），作為這首歌的背景主視覺 | 使用者提供　©むちまろ／講談社・アニプレックス |

## 索引對照

切圖索引沿用 anaru 群組的順序（梅／寿子／こころ／たん／有栖／敏深），方便兩首歌互相對照；封面少女排在最後：

| 索引 | 角色 | 官方立繪 | 使用中的切圖 |
| --- | --- | --- | --- |
| 0 | 水之江 梅（主人公，書記） | op-chara-3.png | ../cast/kaze-0.png |
| 1 | 古都吹 寿子（生徒會長） | op-chara-1.png | ../cast/kaze-1.png |
| 2 | 陸奥 こまろ（庶務，貓系少女） | op-chara-5.png | ../cast/kaze-2.png |
| 3 | 尾鳥 たん（広報） | op-chara-6.png | ../cast/kaze-3.png |
| 4 | 照井 有栖（會計） | op-chara-4.png | ../cast/kaze-4.png |
| 5 | 平塚 敏深（班主任） | op-chara-2.png | ../cast/kaze-5.png |
| 6 | 封面少女（單曲封面持旗的少女） | cover-girl.png | ../cast/kaze-6.png |

## 封面少女（第七位）

單曲封面只畫到她腰際，雙腿被畫面下緣裁掉，直接去背只會得到半身像，因此依封面重畫成完整全身的跑步立繪：保留深藍短髮與側邊長髮束、藍灰眼睛、深藍西裝外套、白襯衫與粉紅圍巾，補上裙襬、白襪與深藍樂福鞋。旗子、粉紅布幕、熊貓、海豚、狗、紙飛機、書與水面背景全部移除；旗子沒有保留，因為七人隊形裡會蓋到鄰居的頭。

去背沒用 Vision（本機的 python3 沒有 pyobjc），改用白底連通填色：`tools/key-white-bg.py` 從邊界往內填掉接近純白的像素，角色身上的白襯衫與白襪被深色線稿包住，不會被挖掉，邊緣再收 1 像素避免白邊。

```text
Use case: identity-preserve character extraction.
Asset type: one transparent full-body anime character sprite for a browser dance stage.
Input image: the attached CD single cover. The identity reference is the only human girl in it:
dark navy-blue bob hair with one longer strand on the side, blue-gray eyes, calm face, dark navy
school blazer over a white collared shirt, a SMALL pale pink neck scarf, navy pleated skirt.
On the cover she is running while holding a large flag; her legs are cut off by the crop.
Primary request: redraw exactly that one girl as a complete full-body anime sprite standing alone,
mid-run: torso leaning slightly forward, one leg striding forward and the other trailing behind,
LEFT arm bent forward and RIGHT arm bent back, both hands fully visible with five clear fingers,
both arms clearly separated from the torso and from each other.
Very important: the pale pink scarf is only a small neck scarf around her collar, close to the neck.
Do NOT draw any large pink cape, banner, ribbon, sash, cloth or fabric flowing around her body,
no flag and no flagpole.
Preserve: face shape, navy-blue bob hair with the long side strand, blue-gray eyes, navy blazer
design with white shirt collar, navy pleated skirt, overall teal-navy and pale pink palette.
Reconstruct: the lower body consistent with the uniform - navy pleated skirt, bare legs, white
crew socks, dark navy loafers, both shoes fully inside the frame.
Style: clean modern TV-anime cel shading with crisp line art and soft flat colors, like a
professional anime character sheet; not sketchy, not painterly.
Remove: flag, flagpole, pink banner, all animals (panda, dolphin, dog, birds, fish), paper plane,
book, signboard, watercolor background, all lettering and logos.
Background: flat pure white (#ffffff) with no pattern, no checkerboard, no shadow, no glow, no scenery.
Composition: exactly one person, centered, complete figure from top of hair to both soles,
generous empty margin on all four sides, portrait 1024x1536.
Constraints: one character only, two arms, two hands, two legs, two shoes, no props, no text,
clean readable silhouette, age-appropriate modest school uniform.
```

## 重建

執行 `node tools/build-kaze.mjs`：裁去每張立繪外的透明空白、補 8 像素透明邊距並限制在 900 像素高，寫入 `cast/kaze-0.png`～`kaze-6.png` 與 `cast.json` 的 kaze 群組，再拼出 `group.png`（4 × 2，第二列三人置中）。

七張都是「跑起來」的姿勢畫，伸出的手臂和跨開的腿一旦被拆成手腳層就會從肩膀或大腿撕開，因此全部標記 `intact: true`，讓 `dance-rig.js` 整張畫只做跳躍、微跳與傾斜。群像圖以等高縮放（跑步姿勢的張開幅度差很多，壽子的長髮最寬，用等寬會把她壓得比其他人大一截）。

角色設定與配音：[生徒会にも穴はある！](https://nama-anaru.com/)（原作 むちまろ／講談社・アニプレックス，角色設計 今村 亮）。

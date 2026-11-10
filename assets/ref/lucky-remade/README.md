# 幸運八人：透明人物素材

使用內建 imagegen 逐張去背，保存工具輸出的 RGBA 透明圖；建置時保留 alpha，只裁空白及加透明邊距。索引 1–5 沿用先前提供的 T-pose 人物；索引 6 已由牙妹替換成橘髮持書的 Claude 娘，索引 7 已由魚妹替換成白髮龍角的 GPT 娘。新兩人保留使用者圖中的原站姿、服裝與配件。

| lucky 索引 | 人物 | 使用者來源檔 | 透明原圖 | 使用中的切圖 |
| --- | --- | --- | --- | --- |
| 0 | 鯨魚娘 | [角色圖鑑三視圖](../../characters/whale-sheet.webp)的正面 | macOS Vision 前景遮罩 | [lucky-0.png](../cast/lucky-0.png) |
| 1 | 咕咕嘎嘎 | ChatGPT Image 2026年9月22日 上午12_07_22.png | lucky-1.png | ../cast/lucky-1.png |
| 2 | 鋒兄 | ChatGPT Image 2026年9月22日 上午12_13_00.png | lucky-2.png | ../cast/lucky-2.png |
| 3 | 塗哥 | ChatGPT Image 2026年9月22日 上午12_13_57.png | lucky-3.png | ../cast/lucky-3.png |
| 4 | 喵布布 | ChatGPT Image 2026年9月22日 上午12_14_54.png | lucky-4.png | ../cast/lucky-4.png |
| 5 | 喵白白 | ChatGPT Image 2026年9月22日 上午12_15_54.png | lucky-5.png | ../cast/lucky-5.png |
| 6 | Claude 娘 | [claude-source.png](claude-source.png) | [lucky-6.png](lucky-6.png) | [lucky-6.png](../cast/lucky-6.png) |
| 7 | GPT 娘 | [gpt-source.png](gpt-source.png) | [lucky-7.png](lucky-7.png) | [lucky-7.png](../cast/lucky-7.png) |

索引 0 的鯨魚娘取自使用者指定三視圖的正面，並保留原圖手部輪廓。八人編制與主唱鋒兄不變；國語、英語、日語與粵語四版的歌詞 PV、人物 PV、第二版播放器及人物圖庫均透過同一份 cast.json 載入新素材與名稱。第二版四首的封面也使用更新後的本機八人群像。

Claude 娘保留書本、花飾與長裙；GPT 娘保留白色服裝、龍角、翅膀、尾巴、鞋與 GPT 紋飾。兩張皆使用內建 image_gen 的 `background-extraction`，`transparent_background=true`，一位人物一個獨立呼叫；GPT 娘再依使用者後續要求，以定向修改移除右上方的藍色 Sora2 符號及軌跡，該區恢復透明。完整提示與原始路徑見 [ai-replacements-prompts.json](ai-replacements-prompts.json)。兩人使用較保守的手腳擺幅，讓長裙與配件保持完整。

## 重建

`node tools/rebuild-lucky.mjs` 裁切此資料夾的七張圖，更新 `assets/ref/cast/cast.json` 與 `lucky-1.png`～`lucky-7.png`，再重建 `assets/ref/lucky8.png`。舊入口 `node tools/cutout-solo.mjs` 偵測到這組素材後也會走此流程，避免重新把白鞋挖空。建置後會印出群像的臉部座標，對應 pv.js 的 ARTS.lucky8.faces。

## 初次重製的 imagegen 共用提示（索引 1–5 沿用）

```text
Use case: background-extraction.
Asset type: one transparent full-body T-pose character sprite for an existing browser dance rig.
Edit target: the single full-body character in the supplied image.
Primary request: Remove ONLY the background, floor and cast shadow to actual alpha transparency. Preserve the exact original character's face, identity, expression, hair or fur, clothing, skin colors, textures, rendering style, proportions, full T pose, position and scale. This is a faithful cutout, NOT a redesign. Keep every part of both outstretched hands or paws, every finger, shoes and their white panels, all hair, ears, and any tail, accessories or backpack straps. Include both complete soles. Keep the original portrait framing with a small clear alpha margin around the complete figure; do not clip fingertips or hair. Make the gaps between the legs, under the arms, and around the tail transparent.
Constraints: exactly the one original character, no new objects or characters, no redraw, no altered anatomy, no altered clothing, no new text, no change of pose. No background color, no scenery, no floor, no cast shadow, no glow, no painted checkerboard. Output a genuinely transparent RGBA PNG.
```

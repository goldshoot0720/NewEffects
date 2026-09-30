# 人物素材

`rise-dancers.png` 是內建 imagegen 產生的 1536 × 1024 RGBA 人物圖集，布局為三欄兩列，依使用者提供的 SUNRISE、RISE 演出與人物封面作為造型參考。生成後再次使用內建工具去背，未附原始參考封面。

完整生成提示：

```text
Use case: identity-preserve / stylized-concept.
Asset type: transparent dance sprite atlas for a browser music player.
Input images: reference 1 SUNRISE cover: six character identities and their school uniforms; reference 2 idol cover: joyful dancing mood; reference 3 portrait grid: facial details.
Primary request: Draw exactly SIX separate full-body anime female character sprites in a precisely aligned 3-column by 2-row grid. Transparent background. Each equal cell contains exactly one entire character, centered horizontally, same height, with 10% padding and nothing crossing a cell boundary. First row left to right: brown side ponytail blue eyes green bow school blouse; brown high side ponytail purple eyes pink vest pink bow; light brown bob blue eyes white blouse navy tie plaid gray skirt. Second row left to right: long brown hair green eyes cream sailor blouse burgundy ribbon navy skirt; long dark navy hair blue eyes white blouse purple ribbon navy skirt; long blonde hair green eyes navy blazer skirt with small teal ribbon. Match their distinctive hair and eyes in references. No guitar or props. Graceful cheerful closed smile, eyes open, both arms angled out from shoulders in a relaxed dance pose, hands at hip height and clear of body. Feet apart. Clean polished original anime cel shading, full size anime proportions with slightly larger heads for readable faces. Preserve recognizable identities and reference uniform colors. All six stand upright facing viewer, fully visible shoes. No labels, no text, no scenery, no ground shadows. Actual alpha transparency. Output image rectangular landscape atlas.
```

最終去背提示：

> Use case: background-extraction. Edit target: attached six-character sprite atlas. Remove ONLY the dark brown/gray background and all surrounding glow. Preserve all six anime characters pixel-faithfully: exact positions, scale, poses, faces, colors and clean line art. Make every empty area genuinely alpha-transparent, including between arms and torsos, between legs and between hair strands. No background, no glow, no checkerboard painted in, no floor or shadows. Keep current image dimensions and exact 3-column 2-row layout. This is a PNG alpha sprite sheet for a game.

實際 PNG 的空白區域包含 alpha 0，人物區域最高 alpha 254；瀏覽器依透明度擷取各人物輪廓，再以網格變形產生舞動。

# 複雜場景去背與人物切圖

共 40 張切圖：色條 12、屋頂 6、RISE 演出服 5、黃昏舞台 9、生徒会 6、招財喵布布 8（單張立繪）。人物索引依每張原圖由左至右排列；造型包含重複人物。

白底與色條底沿用 `tools/cutout.mjs` 的背景填充。屋頂與舞台使用內建 imagegen 分離背景，保留生成 PNG 的 alpha，再使用同一個切圖工具切分角色。這是 2D 素材，未補畫原圖中被其他人物遮擋的部位。

## 招財喵布布八人（單張立繪）

`assets/ref/lucky1.png`～`lucky8.png` 是一張一位角色的 T-pose 立繪，不是多人合圖，改用另一條工具鏈：

- 兩隻貓（`lucky5.png`、`lucky6.png`）的背景是場景照，先用 macOS Vision 的前景遮罩產生灰階 alpha，存成 `assets/ref/lucky5-matte.png`、`lucky6-matte.png`：

  ```sh
  python3 tools/matte-vision.py assets/ref/lucky5.png assets/ref/lucky5-matte.png
  ```

- 其餘六張是白／淺灰底，直接用邊緣背景填充去背。

  ```sh
  node tools/cutout-solo.mjs     # → assets/ref/cast/lucky-0.png … lucky-7.png
  node tools/build-group.mjs     # → assets/ref/lucky8.png（1920×1080 群像主視覺）
  ```

`build-group.mjs` 會印出 `pv.js` 的 `ARTS.lucky8.faces` 要用的臉部座標；主視覺是拼出來的，不是使用者提供的合圖。

## 屋頂透明圖層

保存於 `assets/ref/rooftop6-matte.png`。最終提示：

```text
Use case: background-extraction. Edit target: the six school-uniform anime characters on a rooftop. Remove ONLY the entire background (sky, plants, buildings, bench, floor, shadows) to actual alpha transparency. Keep EXACTLY the six original characters and the guitar: same pixels/linework, colors, faces, costumes, proportions, poses, positions, scale, and original 1536x1024 canvas. Preserve all six full bodies including every shoe and the leftmost extended hands. The central guitar remains with its owner. Remove background through all gaps between arms, hair, legs. No redraw, no new pose, no new costume, no labels, no background, no glow, no painted checkerboard. Output transparent PNG.
```

## 黃昏透明圖層

保存於 `assets/ref/stage9-matte.png`。最終提示：

```text
Use case: background-extraction. Edit target: nine anime idols in matching white-and-blue dresses at sunset. Remove ONLY all background (sunset sky, buildings, floor, reflections and shadows) to real alpha transparency. Preserve EXACTLY all nine original full-body characters including every shoe, raised hand, ribbons, flowing hair and detailed layered skirts. Match original linework, colors, faces, poses, positions and proportions. Keep original wide composition and 1774x887 canvas framing; no character clipped. No redraw, no new characters, no altered clothes, no text, no glow, no painted checkerboard. Make transparent all visible empty gaps between limbs and skirts. Output transparent PNG.
```

## 重建

```sh
node tools/cutout.mjs          # 合圖：色條、屋頂、RISE、黃昏
node tools/cutout-solo.mjs     # 單張立繪：招財喵布布八人
node tools/build-group.mjs     # 招財喵布布的群像主視覺
node render-pv.mjs --mode characters --out pv/characters
```

黃昏人物裙襬相互遮擋，PV 使用完整透明群像搭配同步側彎，避免分離人物時露出裁切接縫。個別 PNG 可在 `cast.html` 檢查與下載。

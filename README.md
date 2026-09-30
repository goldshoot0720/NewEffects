# NewEffects

動態歌詞播放器：在 YouTube 影片或本機 MP3 上疊加動態歌詞特效，並有原創 Q 版偶像「載歌載舞」舞台。

## 啟動

```bash
./serve.sh
```

會在 http://localhost:8765 啟動伺服器並開啟頁面（按 Ctrl+C 停止）。YouTube 嵌入需要透過網址開啟，不能直接雙擊 HTML。

## 功能

- 歌詞特效：卡拉OK填色、逐字彈跳、霓虹燈、逐字浮現、柔焦夢幻
- 和聲（`［］`、`《》`、`[]` 內文字）以小字淺藍色顯示；`漢字(かな)` 顯示為注音假名
- 載歌載舞：舞者跟著 MP3 節拍跳舞，主唱依歌聲對嘴並冒出音符
- 打點對時：貼上歌詞後按「開始打點」，每句開始時按 Space，可匯出 LRC
- 支援匯入 LRC／SRT，歌曲清單可新增 YouTube 網址

## 歌曲檔案

MP3 與字幕檔（SRT／LRC）有版權，不放在這個 repo（見 `.gitignore`）。
把檔案放在與 `index.html` 同一個資料夾，並在 `index.html` 的 `DEFAULT_SONGS` 設定檔名：

```js
{id: 'YouTube 影片 ID', title: '歌名', audio: '歌曲.mp3', subs: '字幕.srt', lead: 0}
```

`lead` 是站在中間當主唱的舞者（0–4）。

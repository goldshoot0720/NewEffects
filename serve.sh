#!/bin/zsh
# 啟動本機伺服器並開啟動態歌詞播放器
cd "$(dirname "$0")"
PORT=${1:-8765}
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT 已有伺服器在執行，直接開啟頁面"
else
  echo "啟動伺服器：http://localhost:$PORT  （按 Ctrl+C 停止）"
  (sleep 1 && open "http://localhost:$PORT") &
  exec python3 -m http.server "$PORT"
fi
open "http://localhost:$PORT"

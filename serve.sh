#!/bin/sh
# 從任意目錄啟動；預設只允許本機連線。
set -eu
TASK_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TASK_PORT=${1-8765}
case "$TASK_PORT" in ''|*[!0-9]*) echo '請指定有效埠號（1–65535）' >&2; exit 1;; esac
if [ "${#TASK_PORT}" -gt 5 ] || [ "$TASK_PORT" -lt 1 ] || [ "$TASK_PORT" -gt 65535 ]; then
  echo '請指定有效埠號（1–65535）' >&2; exit 1
fi
command -v python3 >/dev/null 2>&1 || { echo '找不到 python3，請先安裝 Python 3。' >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo '找不到 curl，無法確認本機伺服器狀態。' >&2; exit 1; }
TASK_URL="http://127.0.0.1:$TASK_PORT"
open_page() {
  if command -v open >/dev/null 2>&1; then open "$TASK_URL" || echo "請在瀏覽器開啟 $TASK_URL";
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$TASK_URL" || echo "請在瀏覽器開啟 $TASK_URL";
  else echo "請在瀏覽器開啟 $TASK_URL"; fi
}
if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$TASK_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  if curl -fsS --connect-timeout 1 --max-time 2 "$TASK_URL/index.html" 2>/dev/null | grep -q 'id="dance"'; then
    echo "播放器已啟動：$TASK_URL"
    open_page
    exit 0
  fi
  echo "埠號 $TASK_PORT 已被其他程式使用，請執行 ./serve.sh 8766。" >&2
  exit 1
fi
python3 -m http.server "$TASK_PORT" --bind 127.0.0.1 --directory "$TASK_DIR" &
TASK_PID=$!
trap 'kill "$TASK_PID" 2>/dev/null || true' EXIT
trap 'exit 0' INT TERM
TASK_ATTEMPT=0
until curl -fsS --connect-timeout 1 --max-time 2 "$TASK_URL/index.html" >/dev/null 2>&1; do
  TASK_ATTEMPT=$((TASK_ATTEMPT + 1))
  if [ "$TASK_ATTEMPT" -ge 30 ] || ! kill -0 "$TASK_PID" 2>/dev/null; then
    echo '伺服器啟動失敗。' >&2
    exit 1
  fi
  sleep 0.1
done
echo "播放器已啟動：${TASK_URL}（按 Ctrl+C 停止）"
open_page
wait "$TASK_PID"

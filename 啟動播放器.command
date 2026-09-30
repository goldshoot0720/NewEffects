#!/bin/sh
# macOS：雙擊此檔即可啟動伺服器與瀏覽器。
TASK_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "$TASK_DIR/serve.sh" "$@"

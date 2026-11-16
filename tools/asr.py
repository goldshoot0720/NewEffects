import json, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

audio = sys.argv[1]
out = sys.argv[2]
model_name = sys.argv[3] if len(sys.argv) > 3 else "large-v3-turbo"

# 這台機器的 PyAV 與 faster-whisper 的 decode_audio 不相容（metadata_errors 參數），
# 因此改用 ffmpeg 解成 16 kHz 單聲道 float32 再交給模型。
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", audio, "-ac", "1", "-ar", "16000",
                      "-f", "f32le", "-"], capture_output=True, check=True).stdout
samples = np.frombuffer(raw, dtype=np.float32)

model = WhisperModel(model_name, device="cpu", compute_type="int8")
segments, info = model.transcribe(samples, language="ja", word_timestamps=True,
                                  vad_filter=False, beam_size=5,
                                  condition_on_previous_text=False)
data = []
for s in segments:
    data.append({
        "s": round(s.start, 3), "e": round(s.end, 3), "t": s.text.strip(),
        "words": [{"w": w.word, "s": round(w.start, 3), "e": round(w.end, 3)} for w in (s.words or [])],
    })
json.dump(data, open(out, "w"), ensure_ascii=False, indent=1)
for d in data:
    print(f'{d["s"]:7.2f} {d["e"]:7.2f} {d["t"]}')

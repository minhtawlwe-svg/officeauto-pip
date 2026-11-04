"""Pip natural-voice helper: stays running so each sentence is fast.

Reads one JSON request per line on stdin:  {"id": 1, "text": "...", "voice": "my-MM-NilarNeural", "rate": "+0%", "pitch": "+0Hz"}
Writes one JSON reply per line on stdout:  {"id": 1, "ok": true, "b64": "<mp3 base64>"}
Requests run concurrently, so the next sentence is ready while the current one plays.
Needs: pip install edge-tts
"""
import asyncio
import base64
import json
import sys
import threading

import edge_tts

sys.stdin.reconfigure(encoding="utf-8")


async def synth(req):
    try:
        com = edge_tts.Communicate(req["text"], req["voice"], rate=req.get("rate", "+0%"), pitch=req.get("pitch", "+0Hz"))
        audio = bytearray()
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                audio += chunk["data"]
        out = {"id": req["id"], "ok": bool(audio), "b64": base64.b64encode(bytes(audio)).decode("ascii")}
    except Exception as e:  # network down, bad voice name...
        out = {"id": req.get("id"), "ok": False, "error": str(e)[:200]}
    sys.stdout.write(json.dumps(out) + "\n")
    sys.stdout.flush()


async def main():
    loop = asyncio.get_running_loop()
    lines = asyncio.Queue()

    def read_stdin():  # blocking reads in a thread, handed to the event loop
        for line in sys.stdin:
            loop.call_soon_threadsafe(lines.put_nowait, line)
        loop.call_soon_threadsafe(lines.put_nowait, None)

    threading.Thread(target=read_stdin, daemon=True).start()
    tasks = set()
    while True:
        line = await lines.get()
        if line is None:
            break
        try:
            req = json.loads(line)
        except ValueError:
            continue
        task = asyncio.create_task(synth(req))
        tasks.add(task)
        task.add_done_callback(tasks.discard)
    if tasks:
        await asyncio.gather(*tasks)


asyncio.run(main())

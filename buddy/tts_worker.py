"""Pip natural-voice helper: stays running and KEEPS ITS CONNECTIONS OPEN so each sentence is fast.

Opening a new connection to the voice service costs ~3 s from Myanmar (DNS + TCP + TLS), while the
speech itself takes well under a second - so this helper reuses two open websocket connections
instead of the one-connection-per-request edge_tts.Communicate. If that ever fails it falls back
to edge_tts.Communicate.

stdin  (one JSON per line): {"id": 1, "text": "...", "voice": "my-MM-NilarNeural", "rate": "+0%", "pitch": "+0Hz"}
                            {"warm": true}   -> open the connections now (sent when the user asks something)
stdout (one JSON per line): {"id": 1, "ok": true, "b64": "<mp3 base64>"}
Needs: pip install edge-tts
"""
import asyncio
import base64
import json
import sys
import threading
import time
from xml.sax.saxutils import escape

import aiohttp
import edge_tts
from edge_tts import communicate as cm
from edge_tts.data_classes import TTSConfig

sys.stdin.reconfigure(encoding="utf-8")

SPEECH_CONFIG = (
    "Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n"
    '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"true",'
    '"wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n'
)
CONNECT_TIMEOUT = 8   # s to open a connection
REPLY_TIMEOUT = 6     # s of silence from the service before the connection counts as dead
STALE_AFTER = 60      # s idle after which a connection is replaced (the service drops idle ones after ~1-1.5 min)


class Connection:
    """One reusable websocket to the voice service; one sentence at a time."""

    def __init__(self, session):
        self.session, self.ws, self.lock, self.last = session, None, asyncio.Lock(), 0.0
        self.opening = asyncio.Lock()   # warm-up and a sentence must not both open a connection

    async def open(self):
        async with self.opening:
            await self._open()

    async def _open(self):
        if self.ws is not None and not self.ws.closed:
            if time.monotonic() - self.last < STALE_AFTER:
                return
            await self.close()   # idle too long: the service has probably dropped it, so reconnect now
        self.last = time.monotonic()
        url = (f"{cm.WSS_URL}&ConnectionId={cm.connect_id()}"
               f"&Sec-MS-GEC={cm.DRM.generate_sec_ms_gec()}&Sec-MS-GEC-Version={cm.SEC_MS_GEC_VERSION}")
        self.ws = await self.session.ws_connect(url, compress=15, headers=cm.DRM.headers_with_muid(cm.WSS_HEADERS), ssl=cm._SSL_CTX)

    async def close(self):
        if self.ws is not None:
            try:
                await asyncio.wait_for(self.ws.close(), 2)   # a dead connection never answers the close
            except Exception:
                pass
        self.ws = None

    async def synth(self, text, voice, rate, pitch):
        await asyncio.wait_for(self.open(), CONNECT_TIMEOUT)
        ws = self.ws
        await ws.send_str(f"X-Timestamp:{cm.date_to_string()}\r\n" + SPEECH_CONFIG)
        ssml = cm.mkssml(TTSConfig(voice, rate, "+0%", pitch, "SentenceBoundary"), escape(cm.remove_incompatible_characters(text)))
        await ws.send_str(cm.ssml_headers_plus_data(cm.connect_id(), cm.date_to_string(), ssml))
        audio = bytearray()
        while True:
            # a connection the server silently dropped never answers: give up after a few seconds
            # (before this, it waited forever and kept the connection locked -> the voice went silent)
            msg = await ws.receive(timeout=REPLY_TIMEOUT)
            if msg.type == aiohttp.WSMsgType.TEXT:
                raw = msg.data.encode("utf-8")
                headers, _ = cm.get_headers_and_data(raw, raw.find(b"\r\n\r\n"))
                if headers.get(b"Path") == b"turn.end":
                    self.last = time.monotonic()
                    return bytes(audio)
            elif msg.type == aiohttp.WSMsgType.BINARY:
                n = int.from_bytes(msg.data[:2], "big")
                headers, data = cm.get_headers_and_data(msg.data, n)
                if headers.get(b"Path") == b"audio" and data:
                    audio += data
            else:  # closed / error: the server dropped an idle connection
                break
        raise ConnectionError("connection closed before the sentence finished")


class Pool:
    def __init__(self, size=2):
        self.size, self.conns, self.session, self.turn = size, [], None, 0

    async def start(self):
        if self.session is None:
            self.session = aiohttp.ClientSession(trust_env=True, timeout=aiohttp.ClientTimeout(total=None, sock_connect=10, sock_read=30))
            self.conns = [Connection(self.session) for _ in range(self.size)]

    async def warm(self):
        # sent when the user asks something: (re)open the connections while the AI is still writing
        await self.start()
        await asyncio.gather(*(asyncio.wait_for(c.open(), CONNECT_TIMEOUT) for c in self.conns if not c.lock.locked()), return_exceptions=True)

    def pick(self):
        free = [c for c in self.conns if not c.lock.locked()]
        if free:
            return free[0]
        self.turn = (self.turn + 1) % self.size
        return self.conns[self.turn]

    async def synth(self, text, voice, rate, pitch):
        await self.start()
        conn = self.pick()
        async with conn.lock:
            for attempt in range(2):   # retry once on a fresh connection if the old one went stale
                try:
                    audio = await conn.synth(text, voice, rate, pitch)
                    if audio:
                        return audio
                except Exception:
                    await conn.close()
                    if attempt:
                        break
        # last resort: the normal edge_tts way (new connection), also time-limited
        async def fresh():
            audio = bytearray()
            async for chunk in edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).stream():
                if chunk["type"] == "audio":
                    audio += chunk["data"]
            return bytes(audio)
        return await asyncio.wait_for(fresh(), 15)


POOL = Pool(3)


def reply(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


async def handle(req):
    if req.get("warm"):
        await POOL.warm()
        return
    try:
        audio = await POOL.synth(req["text"], req["voice"], req.get("rate", "+0%"), req.get("pitch", "+0Hz"))
        reply({"id": req["id"], "ok": bool(audio), "b64": base64.b64encode(audio).decode("ascii")})
    except Exception as e:  # network down, bad voice name...
        reply({"id": req.get("id"), "ok": False, "error": str(e)[:200]})


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
        task = asyncio.create_task(handle(req))
        tasks.add(task)
        task.add_done_callback(tasks.discard)
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
    if POOL.session is not None:
        await POOL.session.close()


asyncio.run(main())

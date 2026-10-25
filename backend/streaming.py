import base64
import io
import json
import logging
import queue
import re
import threading
import wave
from collections.abc import Callable, Iterator
from typing import Any

from fastapi.responses import StreamingResponse

from backend.services.tts_service import tts_service

logger = logging.getLogger("streaming")

StreamEmitter = Callable[[str, dict[str, Any]], None]


class StreamingSpeech:
    def __init__(self, voice: str, emit: StreamEmitter, enabled: bool) -> None:
        self.voice = voice
        self.emit = emit
        self.enabled = enabled
        self.pending_text = ""
        self.audio_chunks: list[bytes] = []
        self.audio_queue: queue.Queue[str | None] = queue.Queue()
        self.worker: threading.Thread | None = None

        if enabled:
            self.worker = threading.Thread(target=self._synthesize_audio, daemon=True)
            self.worker.start()

    def add_text(self, text: str) -> None:
        if not self.enabled:
            return

        self.pending_text += text
        # Fast streaming dispatch: split on sentence ends (.!?؟۔\n) or pauses (،,؛) if >= 3 words
        while True:
            # 1. Terminal sentence punctuation (.!?؟۔ or newline)
            term_match = re.search(r"(?<=[.!?؟۔\n])\s*", self.pending_text)
            if term_match:
                sentence = self.pending_text[:term_match.start()].strip()
                self.pending_text = self.pending_text[term_match.end():]
                if sentence:
                    self.audio_queue.put(sentence)
                continue

            # 2. Mid-sentence pause punctuation (Arabic comma '،', latin ',', '؛', ':') with >= 3 words
            pause_match = re.search(r"(?<=[،,؛:])\s+", self.pending_text)
            if pause_match:
                candidate = self.pending_text[:pause_match.start()].strip()
                if len(candidate.split()) >= 3:
                    self.pending_text = self.pending_text[pause_match.end():]
                    self.audio_queue.put(candidate)
                    continue
            break

    def finish(self, remaining_text: str = "") -> str | None:
        if not self.enabled or self.worker is None:
            return None

        self.add_text(remaining_text)
        if sentence := self.pending_text.strip():
            self.audio_queue.put(sentence)
        self.audio_queue.put(None)
        self.audio_queue.join()
        self.worker.join()

        if not self.audio_chunks:
            return None

        try:
            return base64.b64encode(self._combine_wav_chunks()).decode("ascii")
        except (ValueError, wave.Error) as error:
            logger.warning("Could not combine streamed speech audio: %s", error)
            return None

    def _synthesize_audio(self) -> None:
        has_failed = False
        while True:
            text = self.audio_queue.get()
            try:
                if text is None or has_failed:
                    return
                audio, _ = tts_service.synthesize(text, voice_name=self.voice)
                self.audio_chunks.append(audio)
                self.emit(
                    "audio_chunk",
                    {"audio_base64": base64.b64encode(audio).decode("ascii")},
                )
            except Exception as e:
                logger.exception("Streaming TTS sentence synthesis failed: %s", e)
                has_failed = True  # Stop further attempts immediately to prevent UI freeze
            finally:
                self.audio_queue.task_done()

    def _combine_wav_chunks(self) -> bytes:
        first = wave.open(io.BytesIO(self.audio_chunks[0]), "rb")
        parameters = first.getparams()
        frames = [first.readframes(first.getnframes())]
        first.close()

        for chunk in self.audio_chunks[1:]:
            current = wave.open(io.BytesIO(chunk), "rb")
            if current.getparams()[:3] != parameters[:3]:
                current.close()
                raise ValueError("TTS audio chunks use incompatible WAV formats")
            frames.append(current.readframes(current.getnframes()))
            current.close()

        output = io.BytesIO()
        with wave.open(output, "wb") as combined:
            combined.setparams(parameters)
            combined.writeframes(b"".join(frames))
        return output.getvalue()


def create_sse_response(task: Callable[[StreamEmitter], None]) -> StreamingResponse:
    events: queue.Queue[str | None] = queue.Queue()

    def emit(event: str, data: dict[str, Any]) -> None:
        payload = json.dumps(data, ensure_ascii=False)
        events.put(f"event: {event}\ndata: {payload}\n\n")

    def run_task() -> None:
        try:
            task(emit)
        except Exception:
            logger.exception("Streaming request failed")
            emit("error", {"message": "The request could not be completed"})
        finally:
            events.put(None)

    def stream() -> Iterator[str]:
        worker = threading.Thread(target=run_task, daemon=True)
        worker.start()
        while True:
            item = events.get()
            if item is None:
                break
            yield item

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )

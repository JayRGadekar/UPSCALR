"""Local media upscale worker with a real Real-ESRGAN runner."""
import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2


IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}


def emit(message: str) -> None:
    print(message, flush=True)


def emit_progress(value: int) -> None:
    bounded = max(0, min(100, int(value)))
    emit(f"progress:{bounded}%")


def ensure_command(name: str) -> None:
    if shutil.which(name):
        return
    raise RuntimeError(f"Required command '{name}' was not found in PATH.")


def run_command(args, check=True):
    return subprocess.run(args, check=check, capture_output=True, text=True)


def parse_frame_rate(raw_value) -> float:
    if not raw_value:
        return 24.0
    if "/" in raw_value:
        numerator, denominator = raw_value.split("/", 1)
        numerator = float(numerator or 0)
        denominator = float(denominator or 1)
        return numerator / denominator if denominator else 24.0
    return float(raw_value)


def probe_media(input_path: Path, forced_media_type: str) -> dict:
    if forced_media_type == "image" or input_path.suffix.lower() in IMAGE_SUFFIXES:
        image = cv2.imread(str(input_path))
        if image is None:
            raise RuntimeError(f"Could not open image: {input_path}")
        return {
            "media_type": "image",
            "width": image.shape[1],
            "height": image.shape[0],
        }

    ensure_command("ffprobe")
    result = run_command(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=avg_frame_rate,width,height",
            "-of",
            "json",
            str(input_path),
        ]
    )
    payload = json.loads(result.stdout or "{}")
    stream = (payload.get("streams") or [{}])[0]
    return {
        "media_type": "video",
        "width": stream.get("width"),
        "height": stream.get("height"),
        "fps": parse_frame_rate(stream.get("avg_frame_rate")),
    }


def stage_input(source: Path, staging_dir: Path) -> Path:
    staged = staging_dir / f"input{source.suffix or '.bin'}"
    shutil.copy2(source, staged)
    return staged


def extract_frames(input_path: Path, frames_dir: Path) -> None:
    ensure_command("ffmpeg")
    frames_dir.mkdir(parents=True, exist_ok=True)
    run_command(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(input_path),
            "-qscale:v",
            "1",
            "-qmin",
            "1",
            "-qmax",
            "1",
            "-vsync",
            "0",
            str(frames_dir / "frame_%08d.png"),
        ]
    )


def extract_audio(input_path: Path, audio_path: Path) -> bool:
    ensure_command("ffmpeg")
    result = run_command(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(input_path),
            "-vn",
            "-acodec",
            "copy",
            str(audio_path),
        ],
        check=False,
    )
    return result.returncode == 0 and audio_path.exists()


def encode_video(frames_dir: Path, fps: float, audio_path: Path, output_path: Path) -> None:
    ensure_command("ffmpeg")
    command = [
        "ffmpeg",
        "-loglevel",
        "error",
        "-y",
        "-framerate",
        f"{fps:.6f}",
        "-i",
        str(frames_dir / "frame_%08d.png"),
    ]

    if audio_path.exists():
        command.extend(["-i", str(audio_path), "-map", "0:v:0", "-map", "1:a:0"])

    command.extend(
        [
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "medium",
            "-crf",
            "18",
        ]
    )

    if audio_path.exists():
        command.extend(["-c:a", "copy"])

    command.append(str(output_path))
    run_command(command)


def run_realesrgan(executable: Path, models_path: Path, cli_model_name: str, factor: int, input_path: Path, output_path: Path) -> None:
    if not executable.exists():
        raise RuntimeError(f"Real-ESRGAN executable is missing: {executable}")
    if not models_path.exists():
        raise RuntimeError(f"Real-ESRGAN models directory is missing: {models_path}")

    if input_path.is_dir():
        output_path.mkdir(parents=True, exist_ok=True)
    else:
        output_path.parent.mkdir(parents=True, exist_ok=True)
    run_command(
        [
            str(executable),
            "-i",
            str(input_path),
            "-o",
            str(output_path),
            "-m",
            str(models_path),
            "-n",
            cli_model_name,
            "-s",
            str(factor),
            "-f",
            "png",
        ]
    )


def process_with_realesrgan(args, input_path: Path, media_info: dict) -> None:
    executable = Path(args.executable_path)
    models_path = Path(args.models_path)
    output_path = Path(args.output).expanduser().resolve()

    with tempfile.TemporaryDirectory(prefix="upscalr-") as temp_root:
      temp_root_path = Path(temp_root)
      staged_input = stage_input(input_path, temp_root_path)

      if media_info["media_type"] == "image":
          emit("status: running official Real-ESRGAN on image")
          emit_progress(15)
          run_realesrgan(executable, models_path, args.model_cli_name, args.factor, staged_input, output_path)
          emit_progress(100)
          emit(f"done: saved to {output_path}")
          return

      frames_dir = temp_root_path / "frames"
      upscaled_dir = temp_root_path / "upscaled"
      audio_path = temp_root_path / "audio.m4a"

      emit("status: staging source media")
      emit_progress(5)
      emit("status: extracting video frames")
      extract_frames(staged_input, frames_dir)
      frame_paths = sorted(frames_dir.glob("frame_*.png"))
      if not frame_paths:
          raise RuntimeError("No frames were extracted from the input video.")

      emit_progress(30)
      emit("status: running official Real-ESRGAN")
      run_realesrgan(executable, models_path, args.model_cli_name, args.factor, frames_dir, upscaled_dir)
      emit_progress(80)

      audio_exists = extract_audio(staged_input, audio_path)
      emit("status: encoding output video")
      encode_video(upscaled_dir, media_info.get("fps") or 24.0, audio_path if audio_exists else Path("__missing__"), output_path)
      emit_progress(100)
      emit(f"done: saved to {output_path}")


def parse_args():
    parser = argparse.ArgumentParser(description="Local media upscale worker.")
    parser.add_argument("--input", required=True, help="Path to video or image input")
    parser.add_argument("--media-type", default="video", choices=["video", "image"], help="Input media kind")
    parser.add_argument("--model", default="realesrgan-x4plus", help="Selected local model")
    parser.add_argument("--model-runtime", default="unknown", help="Runner runtime identifier")
    parser.add_argument("--model-cli-name", default="", help="Runtime-specific model name")
    parser.add_argument("--models-path", default="", help="Runtime-specific models directory")
    parser.add_argument("--executable-path", default="", help="Runtime-specific executable path")
    parser.add_argument("--factor", type=int, default=2, help="Upscale factor")
    parser.add_argument("--gpu", action="store_true", help="Use GPU acceleration if available")
    parser.add_argument("--cpu", action="store_true", help="Force CPU fallback")
    parser.add_argument("--output", required=True, help="Destination path for upscaled output")
    return parser.parse_args()


def main():
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()

    if not input_path.exists():
        raise RuntimeError(f"Input path does not exist: {input_path}")

    media_info = probe_media(input_path, args.media_type)
    emit(
        f"status: starting upscale with {args.model} x{args.factor} "
        f"(gpu={args.gpu and not args.cpu}) for {media_info['media_type']}"
    )

    if args.model_runtime == "realesrgan-ncnn":
        process_with_realesrgan(args, input_path, media_info)
        return

    if args.model_runtime == "ltx2-diffusers":
        raise RuntimeError(
            "LTX-2 checkpoints can be downloaded, but local inference still needs the official LTX-2 "
            "PyTorch/diffusers stack and is not executed by this lightweight runner yet."
        )

    raise RuntimeError(f"Unsupported runtime: {args.model_runtime}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pylint: disable=broad-except
        emit(f"error: {exc}")
        sys.exit(1)

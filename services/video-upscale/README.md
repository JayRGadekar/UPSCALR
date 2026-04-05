# Video Upscale Microservice

This worker now has two distinct paths:

- **Real runnable path**: official `Real-ESRGAN` macOS `ncnn` bundle from the upstream GitHub release
- **Heavyweight download-only path**: official `LTX-2` upscaler checkpoints from Hugging Face, which still need the separate official LTX-2 PyTorch/diffusers stack for inference

## Real runnable models today

- `realesrgan-x4plus`
- `realesrgan-x4plus-anime`
- `realesr-animevideov3`

The worker extracts video frames with `ffmpeg`, runs the official `realesrgan-ncnn-vulkan` executable, then remuxes the final video back to mp4.

## Local model storage

`~/Library/Application Support/UPSCALR/models`

The shared Real-ESRGAN runtime is stored under:

`~/Library/Application Support/UPSCALR/models/_runtime/realesrgan-ncnn-v0.2.5.0-macos`

## Example usage

```bash
python3 server.py \
  --input /path/to/file.mp4 \
  --media-type video \
  --model realesr-animevideov3 \
  --model-runtime realesrgan-ncnn \
  --model-cli-name realesr-animevideov3 \
  --models-path "$HOME/Library/Application Support/UPSCALR/models/_runtime/realesrgan-ncnn-v0.2.5.0-macos/models" \
  --executable-path "$HOME/Library/Application Support/UPSCALR/models/_runtime/realesrgan-ncnn-v0.2.5.0-macos/realesrgan-ncnn-vulkan" \
  --factor 2 \
  --output "$HOME/Downloads/out.mp4"
```

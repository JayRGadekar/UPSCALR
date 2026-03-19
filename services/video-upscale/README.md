# Video Upscale Microservice

A lightweight Python worker that wraps Real-ESRGAN/Video2X for offline upscaling. It is intended to be spawned by the Node backend and communicate progress via stdout/stderr.

## Usage
```
python server.py --input /path/to/file.mp4 --factor 4 --gpu
```

The backend should watch stdout for `progress:` tokens and relay them to the frontend via WebSocket.

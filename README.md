# AI Upscaler Desktop Suite

This repo hosts a modular desktop application that orchestrates local Ollama models, provides a ChatGPT-style interface, and handles video upscaling via Python microservices. The stack is:

- **Desktop**: Electron (or Tauri) wrapper that bundles the React UI, Node backend, and services.
- **Backend**: Node.js (Express/Fastify) API + WebSocket streams for chat, model management, video jobs, resource monitoring, and plugin registry.
- **Frontend**: React + Tailwind UI with sidebar navigation (`Chat`, `Models`, `Video Upscale`, `Logs`), streaming chat, and recommendations.
- **Services**: Python-based video upscaling (Real-ESRGAN/Video2X) plus Ollama helpers.
- **Shared Config**: Common types, hardware heuristics, and packaging instructions.

## Top-Level Layout

```
/root/
├── frontend/          # React + Tailwind UI + renderer entry
├── backend/           # Node API, plugins, resource manager, job queue
├── services/          # Python-based helpers (ollama-manager, video-upscale)
├── shared/            # Shared types, config, models metadata
├── config/            # Environment thresholds, packaging hints
├── electron/           # Packaging scripts + native bridge
├── ARCHITECTURE.md    # Opinionated system diagram
└── README.md          # This overview
```

Refer to `ARCHITECTURE.md` for the layered design and module map.

## Development

- `npm run dev` starts the desktop app in Electron on Windows and macOS.
- `npm run dev:web` keeps the browser-only workflow if you want the Vite preview in a tab.

# AI Upscaler Desktop Suite Architecture

## Goal
Build a modular desktop application that orchestrates local AI models (via Ollama) plus video-upscaling services, wrapped by an Electron shell with a React + Tailwind frontend and Node.js backend.

## Layered Stack
1. **Desktop Shell** (Electron/Tauri entry): Hosts the React UI and proxies IPC requests to the local Node.js backend. Responsible for packaging installers for Windows/macOS, bundling or bootstrapping Ollama, and launching background services (Python microservices, video queue workers).
2. **Backend API & Orchestration** (Node.js): Express/Fastify server exposing REST endpoints (`/models`, `/chat`, `/video/*`) and WebSocket events for streaming chat/video job updates. Interacts with Ollama via the CLI/service wrappers and tracks plugin registry, resource manager, and job queue.
3. **Services Directory**: Python microservices for video upscaling (`services/video-upscale`), Ollama helper scripts (`services/ollama-manager`), and future plugins (Stable Diffusion, Whisper). They communicate with the backend via IPC (REST/websocket) and share config in `/shared`.
4. **Frontend** (React + Tailwind): Minimal, dark-mode UI with sidebar navigation (Chat, Models, Video Upscale, Logs). Provides components for chat sessions, model management, video uploads, download progress, and recommendations. Maintains conversation history in local storage and uses streaming via WebSocket for responses.
5. **Shared Utilities** (`/shared`): Common types, configuration schemas, and helper hooks used both by backend and frontend (e.g., model metadata definitions, resource manager contracts).
6. **Config Layer** (`/config`): Environment-aware settings for development, staging, and production installs (e.g., default model lists, hardware thresholds). Desktop packaging scripts reference this directory.

## Core Features Map
| Feature | Location | Notes |
| --- | --- | --- |
| Model Detection & Management | `backend/modules/model-manager` + `services/ollama-manager` | Wraps Ollama CLI for listing/pulling/deleting models lazily; exposes metadata. |
| Chat Interface | `frontend/views/ChatPanel` + `backend/routes/chat` | Streams via WebSocket/Server-Sent Events; stores history locally; allows per-chat model selection. |
| Video Upscaling | `services/video-upscale` + `backend/routes/video` + `frontend/views/VideoUpscaler` | Python service runs Real-ESRGAN/Video2X; API queues jobs and reports progress via WebSocket. |
| Resource Manager | `backend/modules/resource-manager` | Detects RAM/GPU stats and throttles load; suggests best model for camera. |
| Plugin Registry | `backend/modules/plugin-registry` | Dynamically registers modules (image gen, speech) and exposes discovery API. |
| Packaging | `electron/` + config scripts | Builds OS installers; bundle or install Ollama if missing; uses optional Docker packaging for advanced users. |

## Deployment Flow
1. Electron boots -> loads React UI (served via backend or static bundle). 2. Backend starts Express/Fastify server, plugin registry, resource manager, and video job queue. 3. Python microservices launched on-demand or via worker pool. 4. Frontend interacts via REST for batch operations and WebSocket for streaming/progress updates. 5. System monitors resources and logs to UI log panel.

## File Structure Snapshot
```
/root
│   ARCHITECTURE.md
│   README.md
│
├── backend/
│   ├── src/
│   └── package.json
├── frontend/
│   ├── src/
│   └── package.json
├── services/
│   ├── ollama-manager/
│   └── video-upscale/
├── shared/
├── config/
└── electron/ (placeholder for packaging)
```

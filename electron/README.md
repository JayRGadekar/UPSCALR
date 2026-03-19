# Electron Bootstrap

This folder should host the Electron entry point, native installers, and packaging scripts.

## Responsibilities
- Load the backend API and serve the frontend bundle inside the renderer window.
- Provide menu actions to open logs, check Ollama status, and launch Python service processes.
- Offer auto-updater hooks for macOS and Windows installers.
- Start the Node backend as a child process when the shell launches.

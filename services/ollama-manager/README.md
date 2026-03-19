# Ollama Manager Helpers

This folder will host small scripts that wrap the Ollama CLI with caching, download progress tracking, and lazy loading. Key responsibilities:

- Enumerate installed models via `ollama list models`
- Pull/update models (mistral, llama3, codellama) and expose real-time progress to the backend via named pipes or temp files
- Delete unused models
- Emit metadata such as GPU/RAM requirements

Each helper should communicate with the Node backend either via REST endpoints, shared files, or direct `child_process` invocation.

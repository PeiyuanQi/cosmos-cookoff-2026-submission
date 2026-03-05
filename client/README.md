# Photo Review Camera

Minimal React app: full-screen camera with zoom (1–3×), tap-to-focus, and drag-to-adjust exposure. Capture sends the image to the vLLM backend (OpenAI-compatible) and shows photo review suggestions below.

## Setup

```bash
nvm use 24
npm install
npm run dev
```

Set the backend URL in **`public/server-url.txt`** (one line, e.g. `localhost:8000`). The app adds `http://` if missing.

## Camera says "access denied" or not available?

- **Use `http://localhost`** (or `https://`)  
  Browsers allow camera only on secure contexts: `https://` or `http://localhost` / `http://127.0.0.1`. If you open the app via your machine’s IP (e.g. `http://192.168.x.x:5173`), the camera will be blocked. Open **http://localhost:5173** (or the port Vite shows) on the same machine.

- **Allow the camera** when the browser asks. If you blocked it earlier, change it in site settings (lock icon → Site settings → Camera → Allow) and refresh.

- **Only one app at a time** can use the camera. Close other tabs or apps using it, then refresh.

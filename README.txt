Urban Drive - Browser Car Game

Files:
- index.html
- style.css
- script.js

Run:
1. Open the folder in VS Code and start Live Server.
   OR
2. In a terminal inside the folder, run:
   python -m http.server 8000
   Then open http://localhost:8000 in your browser.

Controls:
- W = accelerate
- S = brake / reverse
- A = steer left
- D = steer right
- Space = handbrake

Notes:
- The game uses Three.js from a CDN, so an internet connection is needed.
- A local server is recommended because browsers can restrict module loading from file:// URLs.

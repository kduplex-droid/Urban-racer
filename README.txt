Urban Drive Prototype v6

Run locally from a web server:
- VS Code Live Server, or
- python -m http.server 8000

Then open:
http://localhost:8000

Controls
Vehicle:
- W accelerate
- S brake / reverse
- A / D steer
- Space handbrake
- H horn
- E exit car when nearly stopped
- C switch first / third person camera
- M toggle mini map
- R reset car

On foot:
- W / A / S / D move
- Shift sprint
- Click or tap the ground to place a follow marker
- E enter car when near the driver side
- C switch first / third person camera

Mobile:
- Left touch cluster: accelerate, brake, left, right
- Right touch cluster: handbrake, run, interact, camera, horn, mini map
- Tap the world while on foot to move toward the marker

Notes
- Pedestrians use lightweight browser-friendly movement and reaction logic.
- Missions remain vehicle-focused.
- Use a local server for the best results.

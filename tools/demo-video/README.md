# Demo video recorder

Records the ~2:20 Pluggo demo (1920×1080) from the real app: the app runs in a phone frame inside
`stage.html`, captions and the operator dashboard are part of the stage, and an emulated OCPP 1.6J
wallbox (`demo_charger.py`) drives the "real charger" scene. Needs Docker, Node with
`tests/web` dependencies installed, Python and ffmpeg.

```sh
docker build -f deployment/Dockerfile -t pluggo-test .
# Bash on Windows: export MSYS_NO_PATHCONV=1 first
docker run -d --name pluggo-demo -p 18090:18080 -v "$PWD/tools/demo-video:/video:ro" --entrypoint sh pluggo-test /video/start_demo.sh
python tools/dev-server.py --port 4173 --api http://127.0.0.1:18090 &
node tools/demo-video/record.mjs        # restart pluggo-demo before each take for a clean history
python tools/demo-video/assemble.py docs/presentation/Pluggo_Demo.mp4
```

Edit scene text and timing in `record.mjs`, layout and styling in `stage.html`. Frames go to
`tools/demo-video/out/` (git-ignored).

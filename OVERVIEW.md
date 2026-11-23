Right-click a file or folder path in an agent's reply to reveal it in Windows Explorer. Files open with the file selected; folders open directly. If the path no longer exists, the nearest existing parent folder opens instead.

Paths are detected in finished assistant messages: absolute Windows paths (`C:\...`, `D:/...`, `\\server\share\...`) and relative paths such as `./src` or `src/app/main.ts`, which resolve against the agent's working directory. Trailing `:line:col` suffixes are ignored. Right-clicking other text keeps the normal menu. On mobile, long-press the message.

Explorer opens on the daemon machine, so this is useful when the app and daemon run on the same computer. On macOS and Linux the daemon uses `open -R` and `xdg-open`.

import { spawn } from "node:child_process";

// Windows only lets the foreground app activate windows. The daemon runs in the background, so an
// Explorer window it opens only flashes in the taskbar. This script waits for the Explorer window
// showing `folder` and forces it to the front by attaching to the foreground thread's input.
const SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$folder = $env:OPEN_IN_EXPLORER_FOLDER.TrimEnd('\')
Add-Type -Namespace OpenInExplorer -Name W -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
[DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
[DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
[DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
[DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
'@
function Focus([IntPtr]$h) {
  if ([OpenInExplorer.W]::IsIconic($h)) { [void][OpenInExplorer.W]::ShowWindow($h, 9) }
  $fg = [OpenInExplorer.W]::GetForegroundWindow()
  $fgThread = [OpenInExplorer.W]::GetWindowThreadProcessId($fg, [IntPtr]::Zero)
  $me = [OpenInExplorer.W]::GetCurrentThreadId()
  [void][OpenInExplorer.W]::AttachThreadInput($me, $fgThread, $true)
  [void][OpenInExplorer.W]::BringWindowToTop($h)
  [void][OpenInExplorer.W]::SetForegroundWindow($h)
  [void][OpenInExplorer.W]::AttachThreadInput($me, $fgThread, $false)
  if ([OpenInExplorer.W]::GetForegroundWindow() -ne $h) {
    # Fallback: a synthetic Alt press grants this process the right to set the foreground window.
    [OpenInExplorer.W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
    [OpenInExplorer.W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
    [void][OpenInExplorer.W]::SetForegroundWindow($h)
  }
}
$shell = New-Object -ComObject Shell.Application
$deadline = (Get-Date).AddSeconds(6)
while ((Get-Date) -lt $deadline) {
  foreach ($w in @($shell.Windows())) {
    $p = $null
    try { $p = $w.Document.Folder.Self.Path } catch {}
    if ($p -and $p.TrimEnd('\') -ieq $folder) { Focus ([IntPtr][long]$w.HWND); exit 0 }
  }
  Start-Sleep -Milliseconds 150
}
exit 1
`;

const ENCODED = Buffer.from(SCRIPT, "utf16le").toString("base64");

/** Brings the Explorer window that shows `folder` to the foreground. Fire and forget. */
export function focusExplorerWindow(folder: string) {
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-EncodedCommand", ENCODED],
    {
      env: { ...process.env, OPEN_IN_EXPLORER_FOLDER: folder },
      stdio: "ignore",
      windowsHide: true,
    },
  );
  child.on("error", (error: Error) => console.error("[open-in-explorer] focus failed", error));
  child.on("exit", (code) => {
    if (code !== 0) console.error(`[open-in-explorer] could not focus Explorer window for ${folder}`);
  });
}

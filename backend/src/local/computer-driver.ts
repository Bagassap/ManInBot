/**
 * Skrip PowerShell yang tetap hidup dan menerima perintah JSON per baris di stdin, membalas JSON per baris di stdout.
 * Memakai Win32 (SendInput/mouse_event/CopyFromScreen) langsung, tanpa modul native Node.
 * Semua teks dari Node dikirim sebagai base64 agar aman dari masalah encoding pipa.
 * Koordinat perintah berada dalam ruang tangkapan layar (lebar maks. 1280), dikonversi ke piksel fisik di sini.
 */
export const DRIVER_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -ReferencedAssemblies System.Drawing,System.Core -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
public static class W {
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int k);
  [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] i, int size);
  [DllImport("user32.dll")] static extern void mouse_event(uint f, int dx, int dy, int data, IntPtr extra);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint f);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, System.Text.StringBuilder sb, int n);
  static string[] Info(IntPtr h) {
    if (h == IntPtr.Zero) return new string[] { "", "" };
    uint pid; GetWindowThreadProcessId(h, out pid);
    string name = "";
    try { name = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; } catch { }
    System.Text.StringBuilder sb = new System.Text.StringBuilder(256);
    GetWindowText(h, sb, 256);
    return new string[] { name, sb.ToString() };
  }
  public static string[] Fg() { return Info(GetForegroundWindow()); }
  public static string[] At(int x, int y) {
    POINT p = new POINT(); p.X = x; p.Y = y;
    IntPtr h = WindowFromPoint(p);
    if (h != IntPtr.Zero) h = GetAncestor(h, 2);
    return Info(h);
  }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct U { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public U u; }
  public static void Init() { SetProcessDPIAware(); }
  public static int[] Size() { return new int[] { GetSystemMetrics(0), GetSystemMetrics(1) }; }
  public static int[] Pos() { POINT p; GetCursorPos(out p); return new int[] { p.X, p.Y }; }
  public static bool EscDown() { return (GetAsyncKeyState(0x1B) & 0x8000) != 0; }
  public static void MoveTo(int x, int y) {
    int[] p = Pos();
    for (int i = 1; i <= 8; i++) { SetCursorPos(p[0] + (x - p[0]) * i / 8, p[1] + (y - p[1]) * i / 8); Thread.Sleep(12); }
  }
  public static void Mouse(uint flags, int data) { mouse_event(flags, 0, 0, data, IntPtr.Zero); }
  public static void Key(ushort vk, bool up, bool ext) {
    INPUT[] i = new INPUT[1];
    i[0].type = 1; i[0].u.ki.wVk = vk; i[0].u.ki.dwFlags = (up ? 2u : 0u) | (ext ? 1u : 0u);
    SendInput(1, i, Marshal.SizeOf(typeof(INPUT)));
  }
  public static void Uni(char c) {
    INPUT[] i = new INPUT[2];
    i[0].type = 1; i[0].u.ki.wScan = c; i[0].u.ki.dwFlags = 4;
    i[1].type = 1; i[1].u.ki.wScan = c; i[1].u.ki.dwFlags = 6;
    SendInput(2, i, Marshal.SizeOf(typeof(INPUT)));
  }
  public static string[] Shot(int maxW) {
    int sw = GetSystemMetrics(0), sh = GetSystemMetrics(1);
    using (Bitmap bmp = new Bitmap(sw, sh)) {
      using (Graphics g = Graphics.FromImage(bmp)) { g.CopyFromScreen(0, 0, 0, 0, new Size(sw, sh)); }
      int w = Math.Min(sw, maxW); int h = (int)Math.Round(sh * (double)w / sw);
      using (Bitmap small = new Bitmap(w, h)) {
        using (Graphics g = Graphics.FromImage(small)) {
          g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
          g.DrawImage(bmp, 0, 0, w, h);
          int[] p = Pos(); int cx = (int)Math.Round(p[0] * (double)w / sw); int cy = (int)Math.Round(p[1] * (double)h / sh);
          using (Pen pen = new Pen(Color.Red, 2)) { g.DrawEllipse(pen, cx - 8, cy - 8, 16, 16); g.DrawLine(pen, cx - 12, cy, cx + 12, cy); g.DrawLine(pen, cx, cy - 12, cx, cy + 12); }
        }
        using (MemoryStream ms = new MemoryStream()) {
          ImageCodecInfo enc = ImageCodecInfo.GetImageEncoders().First(e => e.MimeType == "image/jpeg");
          EncoderParameters ep = new EncoderParameters(1);
          ep.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 70L);
          small.Save(ms, enc, ep);
          return new string[] { w.ToString(), h.ToString(), Convert.ToBase64String(ms.ToArray()) };
        }
      }
    }
  }
}
'@
[W]::Init()
$vk = @{ ctrl=0x11; control=0x11; alt=0x12; shift=0x10; win=0x5B; meta=0x5B; enter=0x0D; return=0x0D; tab=0x09; esc=0x1B; escape=0x1B; backspace=0x08; delete=0x2E; del=0x2E; space=0x20; up=0x26; down=0x28; left=0x25; right=0x27; home=0x24; end=0x23; pageup=0x21; pagedown=0x22; insert=0x2D }
$ext = @(0x26,0x28,0x25,0x27,0x24,0x23,0x21,0x22,0x2D,0x2E,0x5B)
function VkOf($n) {
  $n = $n.ToLower()
  if ($vk.ContainsKey($n)) { return [int]$vk[$n] }
  if ($n -match '^f([1-9]|1[0-2])$') { return 0x6F + [int]$Matches[1] }
  if ($n.Length -eq 1 -and $n -match '[a-z0-9]') { return [int][char]$n.ToUpper() }
  throw "Tombol tidak dikenal: $n"
}
function Say($o) { [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 4)); [Console]::Out.Flush() }
$last = $null
Say @{ ready = $true }
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  try {
    $c = $line | ConvertFrom-Json
    $sz = [W]::Size()
    $w = [Math]::Min($sz[0], 1280)
    $f = $sz[0] / $w
    if ([W]::EscDown()) { Say @{ ok = $false; stop = 'esc' }; continue }
    if ($null -ne $last -and -not $c.rebase) {
      $p = [W]::Pos()
      if ([Math]::Abs($p[0] - $last[0]) -gt 12 -or [Math]::Abs($p[1] - $last[1]) -gt 12) { Say @{ ok = $false; stop = 'mouse'; error = "kursor di $($p[0]),$($p[1]) seharusnya $($last[0]),$($last[1])" }; continue }
    }
    # Penjaga "khusus kantor": masukan hanya boleh mengenai jendela aplikasi kantor.
    # Mouse diperiksa pada jendela di bawah titik tujuan, papan ketik pada jendela aktif.
    $targets = @()
    if ($c.action -in 'move','click','double_click','triple_click','right_click','middle_click','scroll','drag') {
      if ($null -ne $c.x) { $targets += ,@([int][Math]::Round($c.x * $f), [int][Math]::Round($c.y * $f)) }
      else { $targets += ,@([W]::Pos()) }
      if ($c.action -eq 'drag') { $targets += ,@([int][Math]::Round($c.to_x * $f), [int][Math]::Round($c.to_y * $f)) }
    }
    $infos = @()
    foreach ($t in $targets) { $infos += ,([W]::At($t[0], $t[1])) }
    if ($c.action -in 'type','key') { $infos += ,([W]::Fg()) }
    $deny = $null
    foreach ($inf in $infos) {
      $okw = $false
      foreach ($a in @($c.allow)) { if ($null -ne $a -and $inf[0] -ieq $a.p -and ((-not $a.t) -or ($inf[1] -match $a.t))) { $okw = $true; break } }
      if (-not $okw) { $deny = $inf; break }
    }
    if ($null -ne $deny) { Say @{ ok = $false; blocked = $true; error = "$($deny[0]) | $($deny[1])" }; continue }
    $stopped = $null
    $settle = 350
    switch ($c.action) {
      'screenshot' { }
      'move' { [W]::MoveTo([int][Math]::Round($c.x * $f), [int][Math]::Round($c.y * $f)) }
      { $_ -in 'click','double_click','triple_click','right_click','middle_click' } {
        if ($null -ne $c.x) { [W]::MoveTo([int][Math]::Round($c.x * $f), [int][Math]::Round($c.y * $f)) }
        $down = 0x2; $up = 0x4; $n = 1
        if ($_ -eq 'right_click') { $down = 0x8; $up = 0x10 }
        if ($_ -eq 'middle_click') { $down = 0x20; $up = 0x40 }
        if ($_ -eq 'double_click') { $n = 2 }
        if ($_ -eq 'triple_click') { $n = 3 }
        for ($k = 0; $k -lt $n; $k++) { [W]::Mouse($down, 0); Start-Sleep -Milliseconds 40; [W]::Mouse($up, 0); Start-Sleep -Milliseconds 70 }
      }
      'drag' {
        [W]::MoveTo([int][Math]::Round($c.x * $f), [int][Math]::Round($c.y * $f))
        [W]::Mouse(0x2, 0); Start-Sleep -Milliseconds 80
        [W]::MoveTo([int][Math]::Round($c.to_x * $f), [int][Math]::Round($c.to_y * $f))
        Start-Sleep -Milliseconds 80; [W]::Mouse(0x4, 0)
      }
      'scroll' {
        if ($null -ne $c.x) { [W]::MoveTo([int][Math]::Round($c.x * $f), [int][Math]::Round($c.y * $f)) }
        [W]::Mouse(0x800, [int](-1 * [int]$c.amount * 120))
      }
      'type' {
        $text = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($c.text_b64))
        $delay = [int]$c.delay_ms
        foreach ($ch in $text.ToCharArray()) {
          if ([W]::EscDown()) { $stopped = 'esc'; break }
          if ($ch -eq "$([char]13)") { continue }
          elseif ($ch -eq "$([char]10)") { [W]::Key(0x0D, $false, $false); [W]::Key(0x0D, $true, $false) }
          elseif ($ch -eq "$([char]9)") { [W]::Key(0x09, $false, $false); [W]::Key(0x09, $true, $false) }
          else { [W]::Uni($ch) }
          if ($delay -gt 0) { Start-Sleep -Milliseconds $delay }
        }
        $settle = 250
      }
      'key' {
        $parts = ([string]$c.keys).Split('+') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
        $codes = @($parts | ForEach-Object { VkOf $_ })
        foreach ($k in $codes) { [W]::Key([uint16]$k, $false, ($ext -contains $k)); Start-Sleep -Milliseconds 25 }
        [array]::Reverse($codes)
        foreach ($k in $codes) { [W]::Key([uint16]$k, $true, ($ext -contains $k)); Start-Sleep -Milliseconds 25 }
      }
      'wait' { Start-Sleep -Milliseconds ([int][Math]::Min([Math]::Max([double]$c.seconds, 0), 10) * 1000) }
      default { throw "Aksi tidak dikenal: $($c.action)" }
    }
    Start-Sleep -Milliseconds $settle
    $last = [W]::Pos()
    $s = [W]::Shot(1280)
    $o = @{ ok = $true; w = [int]$s[0]; h = [int]$s[1]; img = $s[2] }
    if ($stopped) { $o.ok = $false; $o.stop = $stopped }
    Say $o
  } catch {
    Say @{ ok = $false; error = "$($_.Exception.Message)" }
  }
}
`;

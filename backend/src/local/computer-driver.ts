/**
 * Skrip PowerShell yang tetap hidup dan menerima perintah JSON per baris di stdin, membalas JSON per baris di stdout.
 * Layar dibaca lewat Windows UI Automation (daftar tombol, kolom, menu beserta namanya), TANPA tangkapan layar:
 * otak menerima teks bernomor dan menjawab "klik nomor sekian".
 * Semua teks dikirim sebagai base64 agar aman dari masalah encoding pipa.
 */
export const DRIVER_LOADER = String.raw`$s = [Console]::In.ReadLine(); Invoke-Expression ([System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($s)))`;

export const DRIVER_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -ReferencedAssemblies UIAutomationClient,UIAutomationTypes,WindowsBase,System.Core -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;
public static class U {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int k);
  [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] i, int size);
  [DllImport("user32.dll")] static extern void mouse_event(uint f, int dx, int dy, int data, IntPtr extra);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint f);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder sb, int n);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct IU { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public IU u; }

  static List<AutomationElement> els = new List<AutomationElement>();
  public static void Init() { SetProcessDPIAware(); }
  public static bool EscDown() { return (GetAsyncKeyState(0x1B) & 0x8000) != 0; }
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
  static string ProcOf(IntPtr h) {
    uint pid; GetWindowThreadProcessId(h, out pid);
    try { return Process.GetProcessById((int)pid).ProcessName; } catch { return ""; }
  }
  static bool Allowed(string name, string[] allow) { return allow.Any(a => string.Equals(a, name, StringComparison.OrdinalIgnoreCase)); }
  public static string FgName() {
    IntPtr h = GetForegroundWindow();
    if (h == IntPtr.Zero) return "";
    StringBuilder sb = new StringBuilder(256); GetWindowText(h, sb, 256);
    return ProcOf(h) + " | " + sb;
  }
  public static bool FgAllowed(string[] allow) { IntPtr h = GetForegroundWindow(); return h != IntPtr.Zero && Allowed(ProcOf(h), allow); }
  /** Jendela kantor yang aktif, atau yang paling atas bila pengguna sedang melihat jendela lain (mis. chat MiB). */
  static IntPtr Target(string[] allow) {
    IntPtr fg = GetForegroundWindow();
    if (fg != IntPtr.Zero && Allowed(ProcOf(fg), allow)) return fg;
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h) || GetAncestor(h, 2) != h) return true;
      StringBuilder sb = new StringBuilder(8); GetWindowText(h, sb, 8);
      if (sb.Length == 0 || !Allowed(ProcOf(h), allow)) return true;
      found = h; return false;
    }, IntPtr.Zero);
    return found;
  }
  /** Membawa jendela kantor ke depan sebelum papan ketik dipakai. false bila gagal: masukan tidak boleh dikirim. */
  public static bool Activate(string[] allow) {
    if (FgAllowed(allow)) return true;
    IntPtr h = Target(allow);
    if (h == IntPtr.Zero) return false;
    if (IsIconic(h)) ShowWindow(h, 9);
    uint ignored; uint fgT = GetWindowThreadProcessId(GetForegroundWindow(), out ignored); uint me = GetCurrentThreadId();
    bool att = fgT != 0 && fgT != me && AttachThreadInput(me, fgT, true);
    BringWindowToTop(h); SetForegroundWindow(h);
    if (att) AttachThreadInput(me, fgT, false);
    for (int i = 0; i < 20 && !FgAllowed(allow); i++) Thread.Sleep(50);
    return FgAllowed(allow);
  }
  static object Pat(AutomationElement e, AutomationPattern p) { object o; return e.TryGetCurrentPattern(p, out o) ? o : null; }
  static string Clip(string s, int n) { s = (s ?? "").Replace("\r", " ").Replace("\n", " ").Replace("\"", "'").Trim(); return s.Length > n ? s.Substring(0, n) + "..." : s; }
  static string Kind(ControlType t) {
    if (t == ControlType.Button) return "Tombol";
    if (t == ControlType.SplitButton) return "Tombol";
    if (t == ControlType.MenuItem) return "Menu";
    if (t == ControlType.TabItem) return "Tab";
    if (t == ControlType.Edit) return "Kotak isian";
    if (t == ControlType.Document) return "Dokumen";
    if (t == ControlType.ComboBox) return "Pilihan";
    if (t == ControlType.CheckBox) return "Centang";
    if (t == ControlType.RadioButton) return "Radio";
    if (t == ControlType.Hyperlink) return "Tautan";
    if (t == ControlType.ListItem) return "Item";
    if (t == ControlType.TreeItem) return "Item";
    return null;
  }
  static string Line(AutomationElement e, string kind) {
    string s = kind + " \"" + Clip(e.Current.Name, 50) + "\"";
    try {
      ValuePattern v = Pat(e, ValuePattern.Pattern) as ValuePattern;
      if (v != null && kind != "Dokumen" && !string.IsNullOrEmpty(v.Current.Value)) s += " = \"" + Clip(v.Current.Value, 60) + "\"";
      TogglePattern t = Pat(e, TogglePattern.Pattern) as TogglePattern;
      if (t != null && t.Current.ToggleState == ToggleState.On) s += " (aktif)";
      SelectionItemPattern si = Pat(e, SelectionItemPattern.Pattern) as SelectionItemPattern;
      if (si != null && si.Current.IsSelected) s += " (terpilih)";
      if (kind == "Dokumen") {
        TextPattern tp = Pat(e, TextPattern.Pattern) as TextPattern;
        if (tp != null) { string d = tp.DocumentRange.GetText(20000).Replace("\r", " / ").Trim(); if (d.Length > 400) d = "..." + d.Substring(d.Length - 400); s += " isi akhir: \"" + d.Replace("\"", "'") + "\""; }
      }
      if (!e.Current.IsEnabled) s += " (nonaktif)";
    } catch { }
    return s;
  }
  public static string Read(string[] allow, int max) {
    els.Clear();
    IntPtr h = Target(allow);
    if (h == IntPtr.Zero) return "Tidak ada jendela Microsoft Office yang terbuka. Pakai aksi launch.";
    AutomationElement root = AutomationElement.FromHandle(h);
    TreeWalker w = TreeWalker.ControlViewWalker;
    List<KeyValuePair<AutomationElement, string>> items = new List<KeyValuePair<AutomationElement, string>>();
    Stack<KeyValuePair<AutomationElement, int>> st = new Stack<KeyValuePair<AutomationElement, int>>();
    st.Push(new KeyValuePair<AutomationElement, int>(root, 0));
    Stopwatch clock = Stopwatch.StartNew();
    int seen = 0; bool cut = false;
    while (st.Count > 0) {
      if (++seen > 2500 || clock.ElapsedMilliseconds > 5000) { cut = true; break; }
      KeyValuePair<AutomationElement, int> cur = st.Pop();
      try {
        AutomationElement e = cur.Key;
        ControlType t = e.Current.ControlType;
        string kind = Kind(t);
        if (kind != null && !e.Current.IsOffscreen && (e.Current.Name.Length > 0 || kind == "Kotak isian" || kind == "Dokumen")) items.Add(new KeyValuePair<AutomationElement, string>(e, kind));
        // Sel Excel bisa ribuan: isi lembar dibaca lewat alat sheet_*, bukan dari sini.
        if (t == ControlType.DataGrid || t == ControlType.Table || cur.Value >= 16) continue;
        List<AutomationElement> kids = new List<AutomationElement>();
        for (AutomationElement c = w.GetFirstChild(e); c != null; c = w.GetNextSibling(c)) kids.Add(c);
        for (int i = kids.Count - 1; i >= 0; i--) st.Push(new KeyValuePair<AutomationElement, int>(kids[i], cur.Value + 1));
      } catch { }
    }
    // Area kerja dulu, baru pita menu: daftarnya dibatasi agar otak lokal tetap cepat.
    var ordered = items.OrderBy(x => x.Value == "Dokumen" ? 0 : x.Value == "Kotak isian" ? 1 : 2).Take(max).ToList();
    StringBuilder sb = new StringBuilder();
    sb.Append("Jendela: \"" + Clip(root.Current.Name, 90) + "\"\n");
    foreach (var it in ordered) { els.Add(it.Key); sb.Append("[" + els.Count + "] " + Line(it.Key, it.Value) + "\n"); }
    if (cut || items.Count > max) sb.Append("(daftar dipotong)\n");
    return sb.ToString();
  }
  static AutomationElement Get(int id, string[] allow) {
    if (id < 1 || id > els.Count) throw new Exception("Nomor " + id + " tidak ada di daftar terakhir. Pakai aksi read.");
    AutomationElement e = els[id - 1];
    string name;
    try { name = Process.GetProcessById(e.Current.ProcessId).ProcessName; }
    catch { throw new Exception("Elemen " + id + " sudah tidak ada. Pakai aksi read."); }
    if (!Allowed(name, allow)) throw new InvalidOperationException(name);
    return e;
  }
  /** Invoke bisa tertahan selama dialog modal terbuka, jadi dijalankan di thread terpisah. */
  static void Bounded(Action a) {
    Exception err = null;
    Thread t = new Thread(() => { try { a(); } catch (Exception x) { err = x; } });
    t.IsBackground = true; t.Start();
    if (t.Join(3000) && err != null) throw err;
  }
  public static void Click(int id, string[] allow) {
    AutomationElement e = Get(id, allow);
    if (!Activate(allow)) throw new InvalidOperationException(FgName());
    object p;
    if ((p = Pat(e, InvokePattern.Pattern)) != null) { InvokePattern x = (InvokePattern)p; Bounded(() => x.Invoke()); return; }
    if ((p = Pat(e, TogglePattern.Pattern)) != null) { TogglePattern x = (TogglePattern)p; Bounded(() => x.Toggle()); return; }
    if ((p = Pat(e, SelectionItemPattern.Pattern)) != null) { SelectionItemPattern x = (SelectionItemPattern)p; Bounded(() => x.Select()); return; }
    if ((p = Pat(e, ExpandCollapsePattern.Pattern)) != null) { ExpandCollapsePattern x = (ExpandCollapsePattern)p; Bounded(() => x.Expand()); return; }
    System.Windows.Point c = e.GetClickablePoint();
    POINT pt = new POINT(); pt.X = (int)c.X; pt.Y = (int)c.Y;
    IntPtr under = WindowFromPoint(pt);
    if (under != IntPtr.Zero) under = GetAncestor(under, 2);
    string who = ProcOf(under);
    if (!Allowed(who, allow)) throw new InvalidOperationException(who);
    SetCursorPos(pt.X, pt.Y); Thread.Sleep(40);
    mouse_event(0x2, 0, 0, 0, IntPtr.Zero); Thread.Sleep(40); mouse_event(0x4, 0, 0, 0, IntPtr.Zero);
  }
  public static void Focus(int id, string[] allow) {
    AutomationElement e = Get(id, allow);
    if (!Activate(allow)) throw new InvalidOperationException(FgName());
    e.SetFocus();
  }
  /** true bila nilai diisi langsung; false bila kolom tak mendukung dan harus diketik setelah difokuskan. */
  public static bool SetText(int id, string text, string[] allow) {
    AutomationElement e = Get(id, allow);
    if (!Activate(allow)) throw new InvalidOperationException(FgName());
    e.SetFocus();
    ValuePattern v = Pat(e, ValuePattern.Pattern) as ValuePattern;
    if (v == null || v.Current.IsReadOnly) return false;
    v.SetValue(text);
    return true;
  }
}
'@
[U]::Init()
$vk = @{ ctrl=0x11; control=0x11; alt=0x12; shift=0x10; enter=0x0D; return=0x0D; tab=0x09; esc=0x1B; escape=0x1B; backspace=0x08; delete=0x2E; del=0x2E; space=0x20; up=0x26; down=0x28; left=0x25; right=0x27; home=0x24; end=0x23; pageup=0x21; pagedown=0x22; insert=0x2D }
$ext = @(0x26,0x28,0x25,0x27,0x24,0x23,0x21,0x22,0x2D,0x2E)
function VkOf($n) {
  $n = $n.ToLower()
  if ($vk.ContainsKey($n)) { return [int]$vk[$n] }
  if ($n -match '^f([1-9]|1[0-2])$') { return 0x6F + [int]$Matches[1] }
  if ($n.Length -eq 1 -and $n -match '[a-z0-9]') { return [int][char]$n.ToUpper() }
  throw "Tombol tidak dikenal: $n"
}
function Say($o) { [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 4)); [Console]::Out.Flush() }
function TypeText($text, $delay, $allow) {
  $n = 0
  foreach ($ch in $text.ToCharArray()) {
    if ([U]::EscDown()) { return 'esc' }
    # Pengguna bisa berpindah jendela di tengah ketikan: huruf tidak boleh jatuh ke aplikasi lain.
    if ((++$n % 8) -eq 1 -and -not [U]::FgAllowed($allow)) { throw [InvalidOperationException]::new([U]::FgName()) }
    if ($ch -eq "$([char]13)") { continue }
    elseif ($ch -eq "$([char]10)") { [U]::Key(0x0D, $false, $false); [U]::Key(0x0D, $true, $false) }
    elseif ($ch -eq "$([char]9)") { [U]::Key(0x09, $false, $false); [U]::Key(0x09, $true, $false) }
    else { [U]::Uni($ch) }
    if ($delay -gt 0) { Start-Sleep -Milliseconds $delay }
  }
  return $null
}
Say @{ ready = $true }
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  try {
    $c = $line | ConvertFrom-Json
    [string[]]$allow = @($c.allow)
    if ([U]::EscDown()) { Say @{ ok = $false; stop = 'esc' }; continue }
    $stopped = $null
    $settle = 350
    switch ($c.action) {
      'read' { $settle = 0 }
      'click' { [U]::Click([int]$c.id, $allow); $settle = 600 }
      'focus' { [U]::Focus([int]$c.id, $allow) }
      'set_text' {
        $text = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($c.text_b64))
        if (-not [U]::SetText([int]$c.id, $text, $allow)) { $stopped = TypeText $text ([int]$c.delay_ms) $allow }
      }
      'type' {
        if (-not [U]::Activate($allow)) { throw [InvalidOperationException]::new([U]::FgName()) }
        $text = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($c.text_b64))
        $stopped = TypeText $text ([int]$c.delay_ms) $allow
        $settle = 250
      }
      'key' {
        if (-not [U]::Activate($allow)) { throw [InvalidOperationException]::new([U]::FgName()) }
        $parts = ([string]$c.keys).Split('+') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
        $codes = @($parts | ForEach-Object { VkOf $_ })
        foreach ($k in $codes) { [U]::Key([uint16]$k, $false, ($ext -contains $k)); Start-Sleep -Milliseconds 25 }
        [array]::Reverse($codes)
        foreach ($k in $codes) { [U]::Key([uint16]$k, $true, ($ext -contains $k)); Start-Sleep -Milliseconds 25 }
      }
      'wait' { Start-Sleep -Milliseconds ([int][Math]::Min([Math]::Max([double]$c.seconds, 0), 10) * 1000) }
      default { throw "Aksi tidak dikenal: $($c.action)" }
    }
    if ($settle -gt 0) { Start-Sleep -Milliseconds $settle }
    $txt = [U]::Read($allow, [int]$c.max)
    $o = @{ ok = $true; txt = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($txt)) }
    if ($stopped) { $o.ok = $false; $o.stop = $stopped }
    Say $o
  } catch [InvalidOperationException] {
    Say @{ ok = $false; blocked = $true; error = "$($_.Exception.Message)" }
  } catch {
    $inner = $_.Exception
    while ($inner.InnerException) { $inner = $inner.InnerException }
    if ($inner -is [InvalidOperationException]) { Say @{ ok = $false; blocked = $true; error = "$($inner.Message)" } }
    else { Say @{ ok = $false; error = "$($inner.Message)" } }
  }
}
`;

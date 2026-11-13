param([uint32]$self)
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public class SnowWin {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out R r);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out R r, int s);
  [StructLayout(LayoutKind.Sequential)] public struct R { public int Left, Top, Right, Bottom; }
  public static string Scan(uint self) {
    var sb = new StringBuilder("["); bool first = true;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h) || IsIconic(h)) return true;
      if ((GetWindowLong(h, -20) & 0x80) != 0) return true;
      uint pid; GetWindowThreadProcessId(h, out pid); if (pid == self) return true;
      int cl; DwmGetWindowAttribute(h, 14, out cl, 4); if (cl != 0) return true;
      var t = new StringBuilder(4); if (GetWindowText(h, t, 4) == 0) return true;
      R r; if (DwmGetWindowAttribute(h, 9, out r, 16) != 0) GetWindowRect(h, out r);
      if (!first) sb.Append(','); first = false;
      sb.Append('[').Append(h.ToInt64()).Append(',').Append(r.Left).Append(',').Append(r.Top).Append(',').Append(r.Right).Append(',').Append(r.Bottom).Append(']');
      return true;
    }, IntPtr.Zero);
    return sb.Append(']').ToString();
  }
}
'@
[SnowWin]::SetProcessDPIAware() | Out-Null
while ($true) {
  try { [Console]::Out.WriteLine([SnowWin]::Scan($self)); [Console]::Out.Flush() } catch { break }
  Start-Sleep -Milliseconds 100
}

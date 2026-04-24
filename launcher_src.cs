using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

class Program {
    [STAThread]
    static void Main() {
        string exeDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);

        // Priority 1: __launch-ems.ps1 next to the exe (manages Docker + opens browser)
        string ps1 = Path.Combine(exeDir, "__launch-ems.ps1");
        if (File.Exists(ps1)) {
            Process.Start(new ProcessStartInfo {
                FileName = "powershell.exe",
                Arguments = string.Format("-WindowStyle Hidden -ExecutionPolicy Bypass -File \"{0}\"", ps1),
                WorkingDirectory = exeDir,
                WindowStyle = ProcessWindowStyle.Hidden,
                UseShellExecute = false
            });
            return;
        }

        // Priority 2: ems-url.txt next to the exe (custom URL for colleagues)
        string cfgPath = Path.Combine(exeDir, "ems-url.txt");
        string url = "http://192.168.3.186:5173/login";
        if (File.Exists(cfgPath)) {
            string line = File.ReadAllText(cfgPath).Trim();
            if (!string.IsNullOrEmpty(line)) url = line;
        }

        // Open browser directly — works for any machine that can reach the URL
        Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
    }
}

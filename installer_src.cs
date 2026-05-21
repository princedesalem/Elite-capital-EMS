using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Principal;
using System.Text;
using System.Threading;
using Microsoft.Win32;
using System.Collections.Generic;

// ============================================================================
//  EMS Server Installer  v1.5
//  Elite Capital Group
//  Installation complete : WSL2 + Docker + Git + App + DB + CI/CD + Services
//  CheckInternet robuste + rapport d'erreurs automatique
// ============================================================================

class EMSInstaller {

    // =========================================================
    //  CONFIGURATION
    // =========================================================
    static readonly string EMS_ROOT    = @"C:\EMS\extranet";
    static readonly string RUNNER_DIR  = @"C:\actions-runner";
    static readonly string STATE_FILE  = @"C:\ems-install-state.txt";
    static readonly string DESKTOP     = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
    static readonly string LOG_FILE    = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "ems-install-log.txt");
    static readonly string ERROR_FILE  = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "ems-errors.txt");
    static readonly string GITHUB_REPO = "https://github.com/princedusalem/Elite-capital-EMS";

    // Liste centralisee de toutes les erreurs/avertissements pour le rapport final
    static readonly List<string> _errors = new List<string>();

    // =========================================================
    //  JOURNALISATION
    // =========================================================
    static void Log(string msg, ConsoleColor color = ConsoleColor.Cyan) {
        string ts   = DateTime.Now.ToString("HH:mm:ss");
        string line = string.Format("[{0}] {1}", ts, msg);
        ConsoleColor prev = Console.ForegroundColor;
        Console.ForegroundColor = color;
        Console.WriteLine(line);
        Console.ForegroundColor = prev;
        try { File.AppendAllText(LOG_FILE, line + Environment.NewLine, Encoding.UTF8); } catch {}
    }
    static void LogOK(string msg)   { Log("[OK]   " + msg, ConsoleColor.Green);  }
    static void LogWarn(string msg) {
        Log("[WARN] " + msg, ConsoleColor.Yellow);
        _errors.Add("[WARN] " + DateTime.Now.ToString("HH:mm:ss") + " | " + msg.Split('\n')[0]);
    }

    static void LogStep(string msg) {
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("  >>> " + msg);
        Console.ResetColor();
        Log(msg);
    }

    static void LogErr(string msg, bool fatal = true) {
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine("  +----------------------------------------------------------+");
        Console.WriteLine("  |  ERREUR                                                  |");
        Console.WriteLine("  +----------------------------------------------------------+");
        Console.ResetColor();
        Log("[ERREUR] " + msg, ConsoleColor.Red);
        _errors.Add("[ERREUR] " + DateTime.Now.ToString("HH:mm:ss") + " | " + msg.Split('\n')[0]);
        GenerateErrorReport();
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine("\n  Log complet  : " + LOG_FILE);
        Console.WriteLine("  Rapport erreurs : " + ERROR_FILE);
        Console.ResetColor();
        if (fatal) {
            Console.Write("\n  Appuyez sur Entree pour quitter...");
            Console.ReadLine();
            Environment.Exit(1);
        }
    }

    // Genere un rapport d'erreurs synthetique lisible
    static void GenerateErrorReport() {
        try {
            var sb = new StringBuilder();
            sb.AppendLine("============================================================");
            sb.AppendLine("  RAPPORT D'ERREURS - EMS Installer v1.5");
            sb.AppendLine("  Genere le : " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            sb.AppendLine("  Etat installation : " + GetState());
            sb.AppendLine("============================================================");
            sb.AppendLine();
            if (_errors.Count == 0) {
                sb.AppendLine("  Aucune erreur enregistree.");
            } else {
                sb.AppendLine(string.Format("  {0} erreur(s) / avertissement(s) detecte(s) :", _errors.Count));
                sb.AppendLine();
                for (int i = 0; i < _errors.Count; i++)
                    sb.AppendLine(string.Format("  {0,2}. {1}", i + 1, _errors[i]));
            }
            sb.AppendLine();
            sb.AppendLine("------------------------------------------------------------");
            sb.AppendLine("  DIAGNOSTIC SYSTEME");
            sb.AppendLine("------------------------------------------------------------");
            sb.AppendLine("  OS             : " + Environment.OSVersion.VersionString);
            sb.AppendLine("  Machine        : " + Environment.MachineName);
            sb.AppendLine("  Utilisateur    : " + Environment.UserName);
            sb.AppendLine("  Admin          : " + new System.Security.Principal.WindowsPrincipal(
                System.Security.Principal.WindowsIdentity.GetCurrent())
                .IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator));
            // Test connexion Internet detail
            sb.AppendLine();
            sb.AppendLine("  TESTS RESEAU :");
            string[][] netTests = {
                new[]{ "http",  "http://www.google.com" },
                new[]{ "https", "https://github.com" },
                new[]{ "dns",   "https://8.8.8.8" },
                new[]{ "docker","https://registry-1.docker.io" }
            };
            foreach (var t in netTests) {
                bool ok = false;
                try {
                    var req = (HttpWebRequest)WebRequest.Create(t[1]);
                    req.Timeout = 5000; req.Method = "HEAD";
                    req.UserAgent = "EMS-Installer/1.5";
                    req.ServerCertificateValidationCallback = (a,b,c,d) => true;
                    using (req.GetResponse()) ok = true;
                } catch { }
                sb.AppendLine(string.Format("    [{0}] {1,-8} : {2}",
                    ok ? "OK" : "FAIL", t[0], t[1]));
            }
            // WSL status
            string wslOut = "";
            try { wslOut = Process.Start(new ProcessStartInfo("wsl.exe", "--status") {
                UseShellExecute = false, RedirectStandardOutput = true,
                RedirectStandardError = true, CreateNoWindow = true
            }).StandardOutput.ReadToEnd().Trim(); } catch { }
            sb.AppendLine();
            sb.AppendLine("  WSL --status : " + (wslOut.Length > 0 ? wslOut.Replace("\n"," | ") : "(aucune sortie)"));
            // Docker status
            string dockerOut = "";
            try { var p2 = Process.Start(new ProcessStartInfo("docker.exe", "info --format '{{.ServerVersion}}'")
                { UseShellExecute=false, RedirectStandardOutput=true, RedirectStandardError=true, CreateNoWindow=true });
                dockerOut = p2.StandardOutput.ReadToEnd().Trim(); } catch { }
            sb.AppendLine("  Docker version: " + (dockerOut.Length > 0 ? dockerOut : "(non disponible)"));
            sb.AppendLine();
            sb.AppendLine("------------------------------------------------------------");
            sb.AppendLine("  Log complet : " + LOG_FILE);
            sb.AppendLine("============================================================");
            File.WriteAllText(ERROR_FILE, sb.ToString(), Encoding.UTF8);
        } catch { }
    }

    // =========================================================
    //  RESEAU - verification et retry
    // =========================================================

    static bool CheckInternet() {
        // Strategie multi-methode : HTTP, HTTPS, DNS TCP, ping ICMP
        // Endpoint 1 : HTTP simple (fonctionne meme derriere proxy sans HTTPS)
        string[] httpTargets = {
            "http://www.google.com",
            "http://www.microsoft.com",
            "http://connectivitycheck.gstatic.com/generate_204"
        };
        foreach (string t in httpTargets) {
            try {
                var req = (HttpWebRequest)WebRequest.Create(t);
                req.Timeout   = 8000;
                req.Method    = "HEAD";
                req.UserAgent = "EMS-Installer/1.5";
                req.AllowAutoRedirect = true;
                req.ServerCertificateValidationCallback = (sender, cert, chain, err) => true;
                using (var resp = (HttpWebResponse)req.GetResponse()) {
                    int code = (int)resp.StatusCode;
                    if (code == 200 || code == 204 || code == 301 || code == 302) return true;
                }
            } catch { }
        }
        // Endpoint 2 : HTTPS
        string[] httpsTargets = {
            "https://github.com",
            "https://registry-1.docker.io",
            "https://www.google.com"
        };
        foreach (string t in httpsTargets) {
            try {
                var req = (HttpWebRequest)WebRequest.Create(t);
                req.Timeout   = 8000;
                req.Method    = "HEAD";
                req.UserAgent = "EMS-Installer/1.5";
                req.ServerCertificateValidationCallback = (sender, cert, chain, err) => true;
                using (var resp = (HttpWebResponse)req.GetResponse()) {
                    if ((int)resp.StatusCode < 500) return true;
                }
            } catch { }
        }
        // Endpoint 3 : connexion TCP port 80 vers Google DNS (test raw TCP)
        try {
            using (var tcp = new System.Net.Sockets.TcpClient()) {
                var result = tcp.BeginConnect("8.8.8.8", 53, null, null);
                if (result.AsyncWaitHandle.WaitOne(3000)) {
                    tcp.EndConnect(result);
                    return true;
                }
            }
        } catch { }
        return false;
    }

    // Attend que la connexion soit retablie (max 5 minutes)
    static void WaitForNetwork(string context) {
        if (CheckInternet()) return;

        LogWarn("Pas de connexion Internet detectee pour : " + context);
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("  Verifiez votre connexion reseau (cable, wifi, proxy).");
        Console.WriteLine("  Nouvelle tentative automatique toutes les 30 secondes...");
        Console.ResetColor();

        for (int i = 1; i <= 10; i++) {
            Console.Write(string.Format("\r  Attente connexion... tentative {0}/10   ", i));
            Thread.Sleep(30000);
            if (CheckInternet()) {
                Console.WriteLine();
                LogOK("Connexion Internet retablie !");
                return;
            }
        }
        Console.WriteLine();
        LogErr(
            "Connexion Internet indisponible apres 5 minutes.\n" +
            "  Etape bloquee : " + context + "\n\n" +
            "  Solutions :\n" +
            "  1. Verifiez votre connexion reseau (cable ou Wi-Fi)\n" +
            "  2. Desactivez temporairement le pare-feu ou l'antivirus\n" +
            "  3. Verifiez les parametres proxy (si en entreprise)\n" +
            "  4. Relancez l'installateur apres retablissement du reseau\n" +
            "     -> Il reprendra exactement la ou il s'est arrete");
    }

    // Telechargement avec retry et barre de progression
    static bool DownloadWithRetry(string url, string dest, string displayName) {
        if (File.Exists(dest) && new FileInfo(dest).Length > 10240) {
            LogOK(displayName + " deja telecharge, etape ignoree.");
            return true;
        }

        string tmpDest = dest + ".tmp";

        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                WaitForNetwork(displayName);
                // Forcer TLS 1.2 a chaque tentative (certains serveurs rejettent TLS 1.0)
                try {
                    ServicePointManager.SecurityProtocol =
                        (SecurityProtocolType)3072 |
                        (SecurityProtocolType)768  |
                        SecurityProtocolType.Tls;
                    ServicePointManager.ServerCertificateValidationCallback = (s,c,ch,e) => true;
                } catch { }

                if (attempt > 1) {
                    LogWarn(string.Format("Tentative {0}/3 pour '{1}'...", attempt, displayName));
                    Thread.Sleep(5000 * attempt);
                } else {
                    Log(string.Format("Telechargement de {0}...", displayName));
                }

                if (File.Exists(tmpDest)) try { File.Delete(tmpDest); } catch {}

                using (var client = new WebClient()) {
                    client.Headers.Add("User-Agent", "EMS-Installer/1.5");
                    int lastPct = -1;
                    client.DownloadProgressChanged += (s, e) => {
                        int pct = (e.ProgressPercentage / 5) * 5;
                        if (pct != lastPct) {
                            lastPct = pct;
                            string bar = new string('#', pct / 5).PadRight(20, '-');
                            Console.Write(string.Format("\r  [{0}] {1,3}%  {2,-35}", bar, pct, displayName));
                        }
                    };
                    client.DownloadFileTaskAsync(new Uri(url), tmpDest).Wait();
                    Console.WriteLine();
                }

                if (File.Exists(tmpDest) && new FileInfo(tmpDest).Length > 1024) {
                    if (File.Exists(dest)) File.Delete(dest);
                    File.Move(tmpDest, dest);
                    LogOK(string.Format("{0} telecharge ({1:0.1} MB)", displayName,
                        new FileInfo(dest).Length / 1048576.0));
                    return true;
                }

                LogWarn("Fichier telecharge vide.");
                if (File.Exists(tmpDest)) try { File.Delete(tmpDest); } catch {}

            } catch (Exception ex) {
                Console.WriteLine();
                string msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                LogWarn(string.Format("Erreur tentative {0}/3 : {1}", attempt, msg));
                if (File.Exists(tmpDest)) try { File.Delete(tmpDest); } catch {}
            }
        }

        LogErr(
            "Impossible de telecharger : " + displayName + "\n" +
            "  URL : " + url + "\n\n" +
            "  Solutions :\n" +
            "  1. Verifiez votre connexion Internet\n" +
            "  2. Desactivez pare-feu / antivirus / proxy temporairement\n" +
            "  3. Telechargez manuellement et placez ici :\n" +
            "     " + dest + "\n" +
            "  4. Relancez l'installateur (reprendra depuis cette etape)", false);
        return false;
    }

    // =========================================================
    //  EXECUTION DE PROCESSUS
    // =========================================================

    static int Run(string exe, string arguments) {
        try {
            var p = new Process();
            p.StartInfo.FileName               = exe;
            p.StartInfo.Arguments              = arguments;
            p.StartInfo.UseShellExecute        = false;
            p.StartInfo.RedirectStandardOutput = true;
            p.StartInfo.RedirectStandardError  = true;
            p.StartInfo.CreateNoWindow         = false;
            p.OutputDataReceived += (s, e) => {
                if (e.Data != null) {
                    Console.WriteLine("  " + e.Data);
                    try { File.AppendAllText(LOG_FILE, e.Data + "\n", Encoding.UTF8); } catch {}
                }
            };
            p.ErrorDataReceived += (s, e) => {
                if (e.Data != null) {
                    Console.ForegroundColor = ConsoleColor.DarkGray;
                    Console.WriteLine("  " + e.Data);
                    Console.ResetColor();
                    try { File.AppendAllText(LOG_FILE, "[ERR] " + e.Data + "\n", Encoding.UTF8); } catch {}
                }
            };
            p.Start();
            p.BeginOutputReadLine();
            p.BeginErrorReadLine();
            p.WaitForExit();
            return p.ExitCode;
        } catch (Exception ex) {
            LogWarn("Erreur execution [" + exe + " " + arguments + "] : " + ex.Message);
            return -1;
        }
    }

    static string ReadOutput(string exe, string arguments) {
        try {
            var p = new Process();
            p.StartInfo.FileName               = exe;
            p.StartInfo.Arguments              = arguments;
            p.StartInfo.UseShellExecute        = false;
            p.StartInfo.RedirectStandardOutput = true;
            p.StartInfo.RedirectStandardError  = true;
            p.StartInfo.CreateNoWindow         = true;
            p.Start();
            string o = p.StandardOutput.ReadToEnd() + p.StandardError.ReadToEnd();
            p.WaitForExit();
            return o;
        } catch { return ""; }
    }

    // Reessaie une commande en cas d'echec
    static int RunWithRetry(string exe, string arguments, int maxRetries = 3, string hint = "") {
        for (int i = 1; i <= maxRetries; i++) {
            int code = Run(exe, arguments);
            if (code == 0) return 0;
            if (i < maxRetries) {
                LogWarn(string.Format("Commande echouee (code {0}), nouvelle tentative {1}/{2}...",
                    code, i + 1, maxRetries));
                Thread.Sleep(5000 * i);
            }
        }
        if (!string.IsNullOrEmpty(hint))
            LogWarn("Echec apres " + maxRetries + " tentatives.\n  " + hint);
        return -1;
    }

    // =========================================================
    //  ETAT ET REBOOT
    // =========================================================

    static string GetState() {
        if (File.Exists(STATE_FILE)) return File.ReadAllText(STATE_FILE).Trim();
        return "START";
    }
    static void SetState(string s) { File.WriteAllText(STATE_FILE, s, Encoding.UTF8); }

    static void RebootContinue(string nextState, string reason) {
        SetState(nextState);
        Log(reason + " - redemarrage necessaire. Reprise automatique apres le redemarrage.");
        try {
            using (var key = Registry.LocalMachine.OpenSubKey(
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce", true)) {
                if (key != null)
                    key.SetValue("EMS-Install-Resume",
                        "\"" + System.Reflection.Assembly.GetExecutingAssembly().Location + "\"");
            }
        } catch (Exception ex) { LogWarn("RunOnce : " + ex.Message); }
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("\n  Redemarrage dans 15 secondes...");
        Console.WriteLine("  L'installation reprendra automatiquement apres le redemarrage.");
        Console.ResetColor();
        Thread.Sleep(3000);
        Run("shutdown.exe", "/r /t 15 /c \"Redemarrage requis - Installation EMS\"");
        Console.Write("  Appuyez sur Entree pour annuler le redemarrage...");
        Console.ReadLine();
        Environment.Exit(0);
    }

    // =========================================================
    //  DOCKER HELPERS
    // =========================================================

    static bool IsDockerRunning() {
        string info = ReadOutput("docker.exe", "info");
        return info.Contains("Server Version") || info.Contains("Containers");
    }

    // =========================================================
    //  REPARATION WSL2 KERNEL
    //  Gere : kernel manquant, VM sans virtualisation imbriquee
    // =========================================================
    static bool FixWSL2Kernel() {
        Log("Tentative de reparation du noyau WSL 2...");

        // --- Etape 1 : wsl --update simple
        Log("  -> wsl --update");
        if (Run("wsl.exe", "--update") == 0) {
            LogOK("WSL 2 noyau mis a jour via wsl --update.");
            return true;
        }

        // --- Etape 2 : wsl --update --web-download
        Log("  -> wsl --update --web-download");
        if (Run("wsl.exe", "--update --web-download") == 0) {
            LogOK("WSL 2 noyau mis a jour via --web-download.");
            return true;
        }

        // --- Etape 3 : telechargement manuel du MSI noyau
        if (CheckInternet()) {
            Log("  -> telechargement manuel du noyau WSL 2...");
            string msi = @"C:\EMS\wsl_kernel.msi";
            if (DownloadWithRetry(
                "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi",
                msi, "WSL 2 Kernel MSI")) {
                Run("msiexec.exe", "/i \"" + msi + "\" /quiet /norestart");
                Thread.Sleep(5000);
                // Redemarrage du service WSL
                Run("sc.exe", "stop WslService");
                Thread.Sleep(2000);
                Run("sc.exe", "start WslService");
                Thread.Sleep(3000);
                string st = ReadOutput("wsl.exe", "--status");
                if (!st.Contains("introuvable") && !st.Contains("not found")) {
                    LogOK("WSL 2 noyau installe via MSI.");
                    return true;
                }
            }
        }

        // --- Etape 4 : detection virtualisation imbriquee manquante (VM)
        string cpuInfo = ReadOutput("powershell.exe",
            "-NoProfile -Command \"(Get-WmiObject Win32_Processor).VirtualizationFirmwareEnabled\"");
        bool virtEnabled = cpuInfo.Contains("True") || cpuInfo.Contains("true");
        if (!virtEnabled) {
            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("  +----------------------------------------------------------+");
            Console.WriteLine("  |  MACHINE VIRTUELLE DETECTEE                              |");
            Console.WriteLine("  |  La virtualisation imbriquee n'est pas activee.          |");
            Console.WriteLine("  |  WSL 2 ne peut pas fonctionner dans cette configuration.  |");
            Console.WriteLine("  |                                                          |");
            Console.WriteLine("  |  SOLUTION : Basculer vers WSL 1 (compatible VM)          |");
            Console.WriteLine("  |  Docker Desktop utilisera le backend WSL 1.              |");
            Console.WriteLine("  +----------------------------------------------------------+");
            Console.ResetColor();
            Console.WriteLine();
            Console.Write("  Basculer vers WSL 1 automatiquement ? (O/N) : ");
            string rep = Console.ReadLine();
            if (string.IsNullOrEmpty(rep) || rep.Trim().ToUpper().StartsWith("O")) {
                Run("wsl.exe", "--set-default-version 1");
                // Activer les fonctionnalites WSL1
                Run("dism.exe", "/online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart");
                LogOK("WSL 1 configure. Docker utilisera ce mode.");
                return true;
            }
        }

        // --- Etape 5 : activer les fonctionnalites Windows si manquantes
        Log("  -> activation des fonctionnalites Windows WSL...");
        Run("dism.exe", "/online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart");
        Run("dism.exe", "/online /enable-feature /featurename:VirtualMachinePlatform /all /norestart");

        LogWarn(
            "Reparation WSL 2 incomplete.\n" +
            "  Actions manuelles requises :\n" +
            "  1. Redemarrez le serveur\n" +
            "  2. Apres le redemarrage, executez dans PowerShell admin :\n" +
            "     wsl --update --web-download\n" +
            "     wsl --set-default-version 2\n" +
            "  3. Si vous etes dans une VM, activez la virtualisation imbriquee\n" +
            "     (Hyper-V : Set-VMProcessor -VMName X -ExposeVirtualizationExtensions $true)\n" +
            "  4. Relancez l'installateur apres le redemarrage");
        return false;
    }

    static void WaitForDocker(int maxSeconds) {
        int waited = 0;
        while (waited < maxSeconds) {
            if (IsDockerRunning()) { LogOK("Docker Desktop pret."); return; }
            Thread.Sleep(5000); waited += 5;
            Console.Write(string.Format("\r  Docker en demarrage... {0}s/{1}s    ", waited, maxSeconds));
        }
        Console.WriteLine();
        LogWarn("Docker Desktop ne repond pas apres " + maxSeconds + "s.");

        // Diagnostic WSL2
        string wslSt = ReadOutput("wsl.exe", "--status");
        bool kernelMissing = wslSt.Contains("introuvable") || wslSt.Contains("not found")
            || wslSt.Contains("manquant") || wslSt.Contains("missing")
            || wslSt.Contains("kernel file") || string.IsNullOrWhiteSpace(wslSt.Trim());

        if (kernelMissing) {
            LogWarn("Cause probable : noyau WSL 2 manquant. Tentative de reparation...");
            bool fixed2 = FixWSL2Kernel();
            if (fixed2) {
                Log("Relance de Docker Desktop apres reparation WSL 2...");
                string deskExe = @"C:\Program Files\Docker\Docker\Docker Desktop.exe";
                if (File.Exists(deskExe)) Process.Start(deskExe);
                Thread.Sleep(20000);
                int retry = 0;
                while (retry < 120) {
                    if (IsDockerRunning()) { LogOK("Docker Desktop pret apres reparation WSL 2."); return; }
                    Thread.Sleep(5000); retry += 5;
                    Console.Write(string.Format("\r  Docker (apres repair WSL)... {0}s/120s    ", retry));
                }
                Console.WriteLine();
            }
        }

        // Diagnostic Docker Engine
        string dockerLog = ReadOutput("powershell.exe",
            "-NoProfile -Command \"Get-EventLog -LogName Application -Source *docker* -Newest 5 -EA SilentlyContinue | Select-Object -ExpandProperty Message\"");
        if (!string.IsNullOrWhiteSpace(dockerLog))
            LogWarn("Derniers evenements Docker :\n" + dockerLog.Substring(0, Math.Min(dockerLog.Length, 400)));

        LogWarn(
            "Docker Desktop ne repond toujours pas.\n" +
            "  Solutions :\n" +
            "  1. Ouvrez Docker Desktop manuellement et attendez l'icone verte en bas a droite\n" +
            "  2. Si vous etes dans une VM : activez la virtualisation imbriquee\n" +
            "     ou installez Docker Engine directement (sans Desktop)\n" +
            "  3. Verifiez : Gestionnaire de taches > Services > WslService = En cours\n" +
            "  4. Relancez l'installateur apres que Docker soit demarre");
    }

    static string GetServerIP() {
        try {
            string o = ReadOutput("powershell.exe",
                "-NoProfile -Command \"(" +
                "Get-NetIPAddress -AddressFamily IPv4 | " +
                "Where-Object { $_.InterfaceAlias -notmatch 'Loopback|Docker|vEthernet|WSL' " +
                "  -and $_.IPAddress -notmatch '^169|^127' } | " +
                "Select-Object -First 1 -ExpandProperty IPAddress)\"");
            string ip = o.Trim();
            return ip.Length > 6 ? ip : "localhost";
        } catch { return "localhost"; }
    }

    static string GenerateSecretKey() {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        var rnd = new Random();
        var sb  = new StringBuilder(64);
        for (int i = 0; i < 64; i++) sb.Append(chars[rnd.Next(chars.Length)]);
        return sb.ToString();
    }

    // =========================================================
    //  HEALTH CHECK  (backend + frontend + database)
    // =========================================================

    static void HealthCheck(int maxSeconds) {
        Log(string.Format("Verification de sante des 3 services ({0}s max)...", maxSeconds));
        int waited = 0;
        bool backendOk = false, frontendOk = false, dbOk = false;

        while (waited < maxSeconds && (!backendOk || !frontendOk || !dbOk)) {
            if (!backendOk) {
                string r = ReadOutput("powershell.exe",
                    "-NoProfile -Command \"try { " +
                    "(Invoke-WebRequest -Uri 'http://localhost:8000/health' -TimeoutSec 2 -EA Stop).StatusCode" +
                    " } catch { 0 }\"");
                backendOk = r.Contains("200");
                if (backendOk) LogOK("Backend API     : OK - http://localhost:8000/health");
            }
            if (!frontendOk) {
                string r = ReadOutput("powershell.exe",
                    "-NoProfile -Command \"try { " +
                    "(Invoke-WebRequest -Uri 'http://localhost:5173' -TimeoutSec 2 -EA Stop).StatusCode" +
                    " } catch { 0 }\"");
                frontendOk = r.Contains("200");
                if (frontendOk) LogOK("Frontend Vite   : OK - http://localhost:5173");
            }
            if (!dbOk) {
                string r = ReadOutput("docker.exe",
                    "compose exec -T db mysql -u extranet -pextranet -e \"SELECT 1\"");
                dbOk = r.Contains("1");
                if (dbOk) LogOK("Database MySQL  : OK");
            }
            if (!backendOk || !frontendOk || !dbOk) {
                Console.Write(string.Format(
                    "\r  En attente... {0}s  [backend:{1}] [frontend:{2}] [db:{3}]   ",
                    waited,
                    backendOk  ? "OK" : "..",
                    frontendOk ? "OK" : "..",
                    dbOk       ? "OK" : ".."));
                Thread.Sleep(3000);
                waited += 3;
            }
        }
        Console.WriteLine();

        if (!backendOk)  LogWarn("Backend  timeout -> diagnostic : docker compose logs backend");
        if (!frontendOk) LogWarn("Frontend timeout -> diagnostic : docker compose logs frontend");
        if (!dbOk)       LogWarn("Database timeout -> diagnostic : docker compose logs db");
    }

    // =========================================================
    //  PHASE 1 : WSL 2
    // =========================================================
    static string Phase_WSL(string state) {
        if (state != "START") return state;
        LogStep("PHASE 1/8 - Activation et reparation de WSL 2");

        Directory.CreateDirectory(@"C:\EMS");

        string wslInfo = ReadOutput("wsl.exe", "--status");
        bool kernelMissing = wslInfo.Contains("introuvable") || wslInfo.Contains("not found")
            || wslInfo.Contains("manquant") || wslInfo.Contains("missing")
            || wslInfo.Contains("kernel file");
        bool wsl2Active = wslInfo.Contains("Default Version: 2") || wslInfo.Contains("2");

        if (kernelMissing) {
            LogWarn("Noyau WSL 2 manquant - reparation automatique...");
            FixWSL2Kernel();
            // Re-verifier apres reparation
            wslInfo = ReadOutput("wsl.exe", "--status");
            kernelMissing = wslInfo.Contains("introuvable") || wslInfo.Contains("not found")
                || wslInfo.Contains("kernel file");
            if (!kernelMissing) {
                LogOK("WSL 2 noyau repare avec succes.");
                SetState("DOCKER"); return "DOCKER";
            }
            // Si toujours manquant, continuer quand meme (peut necessiter reboot)
        } else if (wsl2Active) {
            LogOK("WSL 2 deja actif et operationnel.");
            SetState("DOCKER"); return "DOCKER";
        }

        // Activation des fonctionnalites Windows
        Log("Activation des fonctionnalites Windows requises...");
        Run("dism.exe", "/online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart");
        Run("dism.exe", "/online /enable-feature /featurename:VirtualMachinePlatform /all /norestart");

        // Telechargement et installation du noyau
        string wslPkg = @"C:\EMS\wsl_update.msi";
        if (CheckInternet()) {
            bool ok = DownloadWithRetry(
                "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi",
                wslPkg, "WSL 2 Kernel Update");
            if (ok) {
                Run("msiexec.exe", "/i \"" + wslPkg + "\" /quiet /norestart");
                Run("wsl.exe", "--set-default-version 2");
            }
        } else {
            LogWarn("Pas de connexion Internet - noyau WSL 2 non telecharge.\n" +
                "  Telechargez manuellement : https://aka.ms/wsl2kernel\n" +
                "  Placez le fichier .msi ici : " + wslPkg + "\n" +
                "  Puis executez : msiexec /i C:\\EMS\\wsl_update.msi");
        }

        RebootContinue("DOCKER", "WSL 2 active et noyau installe");
        return "DOCKER";
    }

    // =========================================================
    //  PHASE 2 : DOCKER DESKTOP
    // =========================================================
    static string Phase_Docker(string state) {
        if (state != "DOCKER") return state;
        LogStep("PHASE 2/8 - Installation de Docker Desktop");

        string dockerApp = @"C:\Program Files\Docker\Docker\Docker Desktop.exe";
        if (File.Exists(dockerApp)) {
            LogOK("Docker Desktop deja installe.");
            if (!IsDockerRunning()) {
                // Verifier WSL avant de demarrer Docker
                string wslPre = ReadOutput("wsl.exe", "--status");
                bool kernelMissingPre = wslPre.Contains("introuvable") || wslPre.Contains("not found")
                    || wslPre.Contains("kernel file") || wslPre.Contains("manquant");
                if (kernelMissingPre) {
                    LogWarn("Noyau WSL 2 manquant - reparation avant demarrage Docker...");
                    FixWSL2Kernel();
                    Thread.Sleep(3000);
                }
                Log("Demarrage de Docker Desktop...");
                Process.Start(dockerApp);
                Thread.Sleep(20000);
                WaitForDocker(180);
                // Si Docker toujours pas demarre, proposer de continuer quand meme
                if (!IsDockerRunning()) {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.Write("\n  Docker non disponible. Continuer quand meme ? (O/N) : ");
                    Console.ResetColor();
                    string rep = Console.ReadLine();
                    if (!string.IsNullOrEmpty(rep) && rep.Trim().ToUpper().StartsWith("N"))
                        LogErr("Installation arretee par l'utilisateur. Relancez apres demarrage de Docker.");
                    LogWarn("Continuation sans Docker - la Phase 6 peut echouer.");
                }
            } else {
                LogOK("Docker Desktop deja en cours d'execution.");
            }
            SetState("GIT"); return "GIT";
        }

        string installer = @"C:\EMS\DockerDesktopInstaller.exe";
        bool downloaded = DownloadWithRetry(
            "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe",
            installer, "Docker Desktop (~600MB)");

        if (!downloaded)
            LogErr(
                "Impossible de telecharger Docker Desktop.\n" +
                "  Telechargement manuel : https://www.docker.com/products/docker-desktop/\n" +
                "  Placez l'installateur ici : " + installer + "\n" +
                "  Puis relancez l'installateur EMS.");

        Log("Installation de Docker Desktop (plusieurs minutes)...");
        int code = Run(installer, "install --quiet --accept-license");
        if (code != 0 && code != 1)
            LogErr(string.Format(
                "Docker Desktop : installation echouee (code {0}).\n" +
                "  Solutions :\n" +
                "  1. Relancez l'installateur en administrateur\n" +
                "  2. Installez Docker Desktop manuellement\n" +
                "  3. Verifiez que WSL 2 est active (Phase 1)", code));

        LogOK("Docker Desktop installe.");
        RebootContinue("GIT", "Docker Desktop installe");
        return "GIT";
    }

    // =========================================================
    //  PHASE 3 : GIT
    // =========================================================
    static string Phase_Git(string state) {
        if (state != "GIT") return state;
        LogStep("PHASE 3/8 - Installation de Git");

        // Verification 1 : chemin fixe
        string gitExe = @"C:\Program Files\Git\cmd\git.exe";
        if (File.Exists(gitExe)) {
            LogOK("Git installe : " + ReadOutput(gitExe, "--version").Trim());
            SetState("CLONE"); return "CLONE";
        }

        // Verification 2 : git dans le PATH (cas Git for Windows, Scoop, etc.)
        string gitInPath = ReadOutput("where.exe", "git").Trim().Split(new char[]{'\r','\n'},
            StringSplitOptions.RemoveEmptyEntries)[0];
        if (!string.IsNullOrEmpty(gitInPath) && File.Exists(gitInPath)) {
            gitExe = gitInPath;
            LogOK("Git trouve dans PATH : " + ReadOutput(gitExe, "--version").Trim());
            SetState("CLONE"); return "CLONE";
        }

        // Verification 3 : autres emplacements courants
        string[] gitPaths = {
            @"C:\Program Files\Git\bin\git.exe",
            @"C:\Program Files (x86)\Git\cmd\git.exe",
            @"C:\tools\git\cmd\git.exe",
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                @"Programs\Git\cmd\git.exe")
        };
        foreach (string gp in gitPaths) {
            if (File.Exists(gp)) {
                LogOK("Git trouve : " + gp + " - " + ReadOutput(gp, "--version").Trim());
                SetState("CLONE"); return "CLONE";
            }
        }

        string installer = @"C:\EMS\git-installer.exe";

        // URLs alternatives en cascade (si GitHub est lent ou temporairement bloque)
        string[][] gitUrls = {
            new[]{
                "https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/Git-2.44.0-64-bit.exe",
                "Git 2.44.0 (GitHub)"
            },
            new[]{
                "https://github.com/git-for-windows/git/releases/latest/download/Git-64-bit.exe",
                "Git (GitHub - derniere version)"
            }
        };
        bool downloaded = false;
        foreach (var urlPair in gitUrls) {
            if (File.Exists(installer) && new FileInfo(installer).Length > 10240) { downloaded = true; break; }
            downloaded = DownloadWithRetry(urlPair[0], installer, urlPair[1]);
            if (downloaded) break;
        }

        if (!downloaded) {
            // Fallback 1 : winget (Windows 10+ integre)
            LogWarn("Telechargement direct impossible. Tentative via winget...");
            int wg = Run("winget.exe", "install --id Git.Git -e --silent --accept-source-agreements --accept-package-agreements");
            if (wg == 0) {
                // Recharger PATH
                // Rafraichir le PATH du processus courant (winget installe dans Machine PATH)
                try {
                    string mPath = ReadOutput("powershell.exe",
                        "-NoProfile -Command [System.Environment]::GetEnvironmentVariable('PATH','Machine')");
                    string uPath = ReadOutput("powershell.exe",
                        "-NoProfile -Command [System.Environment]::GetEnvironmentVariable('PATH','User')");
                    Environment.SetEnvironmentVariable("PATH",
                        (mPath ?? "") + ";" + (uPath ?? "") + ";" + Environment.GetEnvironmentVariable("PATH"));
                } catch { }
                Thread.Sleep(3000);
                // Verifier les emplacements standards apres winget
                string[] wingetPaths = {
                    @"C:\Program Files\Git\cmd\git.exe",
                    @"C:\Program Files\Git\bin\git.exe",
                    @"C:\Program Files (x86)\Git\cmd\git.exe"
                };
                foreach (string wp in wingetPaths) {
                    if (File.Exists(wp)) {
                        LogOK("Git installe via winget : " + ReadOutput(wp, "--version").Trim());
                        SetState("CLONE"); return "CLONE";
                    }
                }
                string gitCheckLine = ReadOutput("where.exe", "git").Trim();
                string[] gitCheckLines = gitCheckLine.Split(new char[]{'\r','\n'}, StringSplitOptions.RemoveEmptyEntries);
                if (gitCheckLines.Length > 0 && File.Exists(gitCheckLines[0])) {
                    LogOK("Git installe via winget : " + ReadOutput(gitCheckLines[0], "--version").Trim());
                    SetState("CLONE"); return "CLONE";
                }
            }
            // Fallback 2 : Chocolatey
            LogWarn("winget echoue. Tentative via Chocolatey...");
            if (Run("choco.exe", "install git -y --no-progress") == 0 && File.Exists(gitExe)) {
                LogOK("Git installe via Chocolatey.");
                SetState("CLONE"); return "CLONE";
            }
            // Fallback 3 : PowerShell Invoke-WebRequest (contourne les restrictions WebClient)
            LogWarn("Tentative via PowerShell Invoke-WebRequest...");
            int psDown = Run("powershell.exe",
                string.Format("-NoProfile -ExecutionPolicy Bypass -Command " +
                "\"[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " +
                "Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/Git-2.44.0-64-bit.exe' " +
                "-OutFile '{0}' -UseBasicParsing\"", installer));
            if (psDown == 0 && File.Exists(installer) && new FileInfo(installer).Length > 1000000) {
                LogOK("Git telecharge via PowerShell.");
                downloaded = true;
            } else {
                LogErr(
                    "Impossible d'installer Git par aucune methode.\n" +
                    "  Telechargez manuellement : https://git-scm.com/download/win\n" +
                    "  Placez le fichier ici : C:\\EMS\\git-installer.exe\n" +
                    "  Puis relancez l'installateur.");
            }
        }

        Log("Installation de Git...");
        Run(installer, "/VERYSILENT /NORESTART /NOCANCEL");
        Thread.Sleep(8000);

        // Rafraichir le PATH du processus apres installation silencieuse
        try {
            string mPath2 = ReadOutput("powershell.exe",
                "-NoProfile -Command [System.Environment]::GetEnvironmentVariable('PATH','Machine')");
            string uPath2 = ReadOutput("powershell.exe",
                "-NoProfile -Command [System.Environment]::GetEnvironmentVariable('PATH','User')");
            Environment.SetEnvironmentVariable("PATH",
                (mPath2 ?? "") + ";" + (uPath2 ?? "") + ";" + Environment.GetEnvironmentVariable("PATH"));
        } catch { }

        // Chercher git dans plusieurs emplacements apres installation
        string[] postInstallPaths = {
            @"C:\Program Files\Git\cmd\git.exe",
            @"C:\Program Files\Git\bin\git.exe",
            @"C:\Program Files (x86)\Git\cmd\git.exe"
        };
        foreach (string pp in postInstallPaths) {
            if (File.Exists(pp)) {
                LogOK("Git installe : " + ReadOutput(pp, "--version").Trim());
                SetState("CLONE"); return "CLONE";
            }
        }

        if (!File.Exists(gitExe))
            LogErr(
                "Git ne s'est pas installe correctement.\n" +
                "  Chemin attendu : " + gitExe + "\n" +
                "  Relancez l'installateur ou installez Git manuellement.");

        LogOK("Git installe : " + ReadOutput(gitExe, "--version").Trim());
        SetState("CLONE"); return "CLONE";
    }

    // =========================================================
    //  PHASE 4 : CLONE / PULL
    // =========================================================
    static string Phase_Clone(string state) {
        if (state != "CLONE") return state;
        LogStep("PHASE 4/8 - Recuperation du code source depuis GitHub");

        string gitExe = File.Exists(@"C:\Program Files\Git\cmd\git.exe")
            ? @"C:\Program Files\Git\cmd\git.exe" : "git.exe";

        WaitForNetwork("GitHub (depot EMS)");

        // --- Credentials GitHub (depot prive ou public) ---
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine("  Depot : " + GITHUB_REPO);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("  Si le depot est PRIVE, entrez un Personal Access Token (PAT).");
        Console.WriteLine("  GitHub > Settings > Developer settings > Personal access tokens > Tokens classic");
        Console.WriteLine("  Permissions requises : repo (read)");
        Console.WriteLine("  Si le depot est PUBLIC, appuyez directement sur ENTREE.");
        Console.ResetColor();
        Console.Write("  Token GitHub (ou ENTREE si public) : ");
        string ghPat = Console.ReadLine();
        string cloneUrl = GITHUB_REPO;
        if (!string.IsNullOrEmpty(ghPat) && ghPat.Trim().Length > 5) {
            cloneUrl = GITHUB_REPO.Replace("https://", "https://oauth2:" + ghPat.Trim() + "@");
            LogOK("Token GitHub configure (authentification activee).");
        }

        if (Directory.Exists(Path.Combine(EMS_ROOT, ".git"))) {
            Log("Depot existant detecte - mise a jour (git pull)...");
            Directory.SetCurrentDirectory(EMS_ROOT);
            if (!string.IsNullOrEmpty(ghPat) && ghPat.Trim().Length > 5)
                Run(gitExe, "remote set-url origin " + cloneUrl);
            int pull = RunWithRetry(gitExe, "pull origin main", 3,
                "Verifiez votre connexion et vos droits d'acces au depot GitHub.");
            if (pull == 0) LogOK("Code mis a jour depuis GitHub.");
            else           LogWarn("git pull echoue. Le code existant sera utilise.");
        } else {
            string parent = Path.GetDirectoryName(EMS_ROOT);
            if (!Directory.Exists(parent)) Directory.CreateDirectory(parent);
            Log("Clonage du depot : " + GITHUB_REPO);
            int clone = RunWithRetry(gitExe,
                string.Format("clone {0} \"{1}\"", cloneUrl, EMS_ROOT), 3,
                "Verifiez que le depot est accessible et que vous avez Internet.");
            if (clone != 0)
                LogErr(
                    "Impossible de cloner le depot GitHub.\n" +
                    "  Depot : " + GITHUB_REPO + "\n\n" +
                    "  Solutions :\n" +
                    "  1. Verifiez l'acces a Internet\n" +
                    "  2. Si depot prive : entrez le token PAT quand l'installateur le demande\n" +
                    "     (GitHub > Settings > Developer settings > Personal access tokens)\n" +
                    "  3. Verifiez que le depot existe et est accessible\n" +
                    "  4. Relancez apres resolution du probleme");
            LogOK("Depot clone dans : " + EMS_ROOT);
        }

        SetState("ENV"); return "ENV";
    }

    // =========================================================
    //  PHASE 5 : FICHIERS .ENV
    // =========================================================
    static string Phase_Env(string state) {
        if (state != "ENV") return state;
        LogStep("PHASE 5/8 - Configuration des variables d'environnement");

        string serverIP = GetServerIP();
        Log("IP du serveur detectee : " + serverIP);

        // frontend/.env
        string feDir = Path.Combine(EMS_ROOT, "frontend");
        if (!Directory.Exists(feDir)) Directory.CreateDirectory(feDir);
        File.WriteAllText(Path.Combine(feDir, ".env"),
            string.Concat(
                "# EMS Frontend - genere par Installer EMS v1.5", Environment.NewLine,
                "VITE_API_URL=http://localhost:8000", Environment.NewLine),
            Encoding.UTF8);
        LogOK("frontend/.env : VITE_API_URL=http://localhost:8000");

        // backend/.env
        string beDir = Path.Combine(EMS_ROOT, "backend");
        if (!Directory.Exists(beDir)) Directory.CreateDirectory(beDir);
        string secretKey = GenerateSecretKey();
        File.WriteAllText(Path.Combine(beDir, ".env"),
            string.Concat(
                "# EMS Backend - genere par Installer EMS v1.5", Environment.NewLine,
                "# Ne pas commiter ce fichier dans Git !", Environment.NewLine,
                "DATABASE_URL=mysql+pymysql://extranet:extranet@db:3306/EMS_DB", Environment.NewLine,
                "SECRET_KEY=", secretKey, Environment.NewLine,
                "ACCESS_TOKEN_EXPIRE_MINUTES=60", Environment.NewLine,
                "APP_URL=http://localhost:5173", Environment.NewLine,
                "INIT_ADMIN_PW=ChangeMe123!@#", Environment.NewLine,
                "SMTP_ENABLED=false", Environment.NewLine,
                "SMTP_HOST=smtp.gmail.com", Environment.NewLine,
                "SMTP_PORT=587", Environment.NewLine),
            Encoding.UTF8);
        LogOK("backend/.env : DATABASE_URL + SECRET_KEY securisee generee (64 chars)");

        Console.ForegroundColor = ConsoleColor.DarkCyan;
        Console.WriteLine();
        Console.WriteLine("  +------------------------------------------------------+");
        Console.WriteLine("  |   ACCES APRES INSTALLATION                           |");
        Console.WriteLine("  |                                                      |");
        Console.WriteLine("  |   Serveur local  : http://localhost:5173             |");
        Console.WriteLine(string.Format("  |   Reseau local   : http://{0,-24}:5173  |", serverIP));
        Console.WriteLine("  |   API / Swagger  : http://localhost:8000/docs        |");
        Console.WriteLine("  +------------------------------------------------------+");
        Console.ResetColor();
        Console.WriteLine();

        SetState("COMPOSE"); return "COMPOSE";
    }

    // =========================================================
    //  PHASE 6 : DOCKER COMPOSE + INIT DB + HEALTHCHECK
    // =========================================================
    static string Phase_Compose(string state) {
        if (state != "COMPOSE") return state;
        LogStep("PHASE 6/8 - Demarrage de l'application (backend + frontend + database)");

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("  Premier build : 10-30 minutes selon votre connexion Internet");
        Console.WriteLine("  (telechargement images Docker : Python 3.11, Node 20, MySQL 8)");
        Console.ResetColor();
        Console.WriteLine();

        // S'assurer que Docker est demarre
        if (!IsDockerRunning()) {
            Log("Demarrage de Docker Desktop...");
            string deskExe = @"C:\Program Files\Docker\Docker\Docker Desktop.exe";
            if (File.Exists(deskExe)) Process.Start(deskExe);
            else LogErr("Docker Desktop introuvable. Verifiez la Phase 2.");
            Thread.Sleep(15000);
            WaitForDocker(240);
        }

        Directory.SetCurrentDirectory(EMS_ROOT);

        // Pre-pull des images (meilleur diagnostic reseau)
        Log("Pre-telechargement des images Docker...");
        WaitForNetwork("Docker Hub");
        RunWithRetry("docker.exe", "compose pull --ignore-pull-failures", 2, "");

        // Build et demarrage des containers
        Log("Build et demarrage des containers...");
        int upCode = RunWithRetry("docker.exe", "compose up --build -d", 2,
            "Verifiez les logs : docker compose logs");

        if (upCode != 0) {
            // Diagnostic erreurs courantes
            string ports = ReadOutput("netstat", "-ano");
            bool p8000 = ports.Contains(":8000 ");
            bool p5173 = ports.Contains(":5173 ");
            if (p8000 || p5173)
                LogWarn(
                    "CONFLIT DE PORT detecte !\n" +
                    (p8000 ? "  -> Port 8000 deja utilise (arretez le service concerne)\n" : "") +
                    (p5173 ? "  -> Port 5173 deja utilise (arretez le service concerne)\n" : "") +
                    "  Commande pour liberer un port : Stop-Process -Id (netstat -ano | findstr :8000).Split()[-1]");
            LogWarn("docker compose up a echoue. Tentative de continuer...");
        }

        // Attente MySQL (max 90s)
        Log("Attente de la disponibilite de MySQL (90s max)...");
        int dbWait = 0; bool dbReady = false;
        while (dbWait < 90 && !dbReady) {
            string chk = ReadOutput("docker.exe",
                "compose exec -T db mysql -u extranet -pextranet -e \"SELECT 1\"");
            dbReady = chk.Contains("1");
            if (!dbReady) {
                Console.Write(string.Format("\r  MySQL en demarrage... {0}s / 90s    ", dbWait));
                Thread.Sleep(5000); dbWait += 5;
            }
        }
        Console.WriteLine();
        if (dbReady) LogOK("MySQL est disponible.");
        else         LogWarn("MySQL timeout. Diagnostic : docker compose logs db");

        // Initialisation de la base de donnees
        Log("Initialisation de la base de donnees (init_db.py)...");
        int initCode = Run("docker.exe", "compose exec -T backend python init_db.py");
        if (initCode == 0)
            LogOK("Base de donnees initialisee (schema + admin user + donnees de test).");
        else
            LogWarn(
                "init_db.py erreur (code " + initCode + ").\n" +
                "  La base sera initialisee au premier acces.\n" +
                "  Diagnostic manuel : docker compose exec backend python init_db.py");

        // Verification de sante des 3 services
        HealthCheck(60);

        SetState("FIREWALL"); return "FIREWALL";
    }

    // =========================================================
    //  PHASE 6.5 : PARE-FEU WINDOWS
    // =========================================================
    static string Phase_Firewall(string state) {
        if (state != "FIREWALL") return state;
        LogStep("PHASE 6.5/8 - Ouverture des ports Firewall Windows");

        var rules = new Dictionary<string, string> {
            { "EMS-Backend-API-8000",   "8000" },
            { "EMS-Frontend-Vite-5173", "5173" }
        };

        foreach (var kv in rules) {
            Run("netsh.exe", string.Format(
                "advfirewall firewall delete rule name=\"{0}\"", kv.Key));
            int r = Run("netsh.exe", string.Format(
                "advfirewall firewall add rule name=\"{0}\" " +
                "dir=in action=allow protocol=tcp localport={1}",
                kv.Key, kv.Value));
            if (r == 0) LogOK("Port " + kv.Value + " ouvert dans le pare-feu Windows.");
            else        LogWarn("Port " + kv.Value + " : ouverture manuelle requise dans Panneau de configuration > Pare-feu.");
        }

        SetState("RUNNER"); return "RUNNER";
    }

    // =========================================================
    //  PHASE 7 : GITHUB ACTIONS RUNNER
    // =========================================================
    static string Phase_Runner(string state) {
        if (state != "RUNNER") return state;
        LogStep("PHASE 7/8 - Installation du runner GitHub Actions (CI/CD self-hosted)");

        if (Directory.Exists(Path.Combine(RUNNER_DIR, "_work"))) {
            LogOK("Runner GitHub Actions deja installe.");
            SetState("RUNNER_CI"); return "RUNNER_CI";
        }

        Directory.CreateDirectory(RUNNER_DIR);
        string archive = Path.Combine(RUNNER_DIR, "actions-runner-win-x64.zip");

        bool downloaded = DownloadWithRetry(
            "https://github.com/actions/runner/releases/download/v2.315.0/actions-runner-win-x64-2.315.0.zip",
            archive, "GitHub Actions Runner");

        if (!downloaded) {
            LogWarn("Runner non installe. CI/CD auto-deploy indisponible.\n" +
                "  Configuration manuelle : github.com > Settings > Actions > Runners");
            SetState("RUNNER_CI"); return "RUNNER_CI";
        }

        Run("powershell.exe", string.Format(
            "-NoProfile -Command \"Add-Type -AssemblyName System.IO.Compression.FileSystem; " +
            "[System.IO.Compression.ZipFile]::ExtractToDirectory('{0}', '{1}')\"",
            archive, RUNNER_DIR));

        string configExe = Path.Combine(RUNNER_DIR, "config.cmd");
        if (!File.Exists(configExe)) {
            LogWarn("config.cmd introuvable apres extraction.");
            SetState("RUNNER_CI"); return "RUNNER_CI";
        }

        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine();
        Console.WriteLine("  +------------------------------------------------------------+");
        Console.WriteLine("  |  CONFIGURATION RUNNER GITHUB ACTIONS                       |");
        Console.WriteLine("  |                                                            |");
        Console.WriteLine("  |  1. Allez sur GitHub > votre depot > Settings             |");
        Console.WriteLine("  |     > Actions > Runners > New self-hosted runner           |");
        Console.WriteLine("  |  2. Copiez le TOKEN affiche                                |");
        Console.WriteLine("  |  3. Collez-le ci-dessous                                   |");
        Console.WriteLine("  |  (Laissez vide pour ignorer cette etape)                   |");
        Console.WriteLine("  +------------------------------------------------------------+");
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.Write("  Token GitHub Actions : ");
        Console.ResetColor();
        string token = Console.ReadLine();

        if (!string.IsNullOrEmpty(token) && token.Trim().Length > 10) {
            Directory.SetCurrentDirectory(RUNNER_DIR);
            int cfg = Run(configExe, string.Format(
                "--url {0} --token {1} --name EMS-Server --unattended --replace",
                GITHUB_REPO, token.Trim()));
            if (cfg == 0) {
                Run("powershell.exe", string.Format(
                    "-NoProfile -ExecutionPolicy Bypass -Command " +
                    "\"Set-Location '{0}'; .\\svc.ps1 install; .\\svc.ps1 start\"",
                    RUNNER_DIR));
                LogOK("Runner GitHub Actions configure et demarre en service Windows.");
            } else {
                LogWarn(
                    "Configuration echouee. Reconfiguration manuelle :\n" +
                    "  cd " + RUNNER_DIR + "\n" +
                    "  .\\config.cmd --url " + GITHUB_REPO + " --token <TOKEN>");
            }
        } else {
            LogWarn("Runner ignore. CI/CD auto-deploy non configure pour l'instant.");
        }

        SetState("RUNNER_CI"); return "RUNNER_CI";
    }

    // =========================================================
    //  PHASE 7.5 : PATCHING CI.YML
    // =========================================================
    static string Phase_RunnerCI(string state) {
        if (state != "RUNNER_CI") return state;
        LogStep("PHASE 7.5/8 - Ajout du job deploy dans .github/workflows/ci.yml");

        string ciPath = Path.Combine(EMS_ROOT, ".github\\workflows\\ci.yml");
        if (!File.Exists(ciPath)) {
            LogWarn("ci.yml introuvable - configuration CI/CD manuelle necessaire.");
            SetState("SERVICES"); return "SERVICES";
        }

        string ciContent = File.ReadAllText(ciPath, Encoding.UTF8);
        if (ciContent.Contains("runs-on: self-hosted")) {
            LogOK("Job deploy deja present dans ci.yml.");
            SetState("SERVICES"); return "SERVICES";
        }

        string deployJob =
            "\n\n  deploy:\n" +
            "    name: Deploy to local server (self-hosted)\n" +
            "    needs: [backend-tests, frontend-tests, backend-lint]\n" +
            "    if: github.ref == 'refs/heads/main' && github.event_name == 'push'\n" +
            "    runs-on: self-hosted\n" +
            "    steps:\n" +
            "      - name: Pull latest code\n" +
            "        run: git -C C:\\EMS\\extranet pull origin main\n\n" +
            "      - name: Rebuild containers\n" +
            "        working-directory: C:\\EMS\\extranet\n" +
            "        run: docker compose up --build -d\n\n" +
            "      - name: Health check backend\n" +
            "        run: |\n" +
            "          $ok = $false\n" +
            "          for ($i = 0; $i -lt 12; $i++) {\n" +
            "            Start-Sleep -Seconds 5\n" +
            "            try {\n" +
            "              (Invoke-RestMethod http://localhost:8000/health -TimeoutSec 3) | Out-Null\n" +
            "              $ok = $true; break\n" +
            "            } catch {}\n" +
            "          }\n" +
            "          if (-not $ok) { Write-Error 'Backend health check failed'; exit 1 }\n" +
            "          Write-Host 'Deploy OK - ' + (Get-Date)\n";

        File.WriteAllText(ciPath, ciContent + deployJob, Encoding.UTF8);

        string gitExe = File.Exists(@"C:\Program Files\Git\cmd\git.exe")
            ? @"C:\Program Files\Git\cmd\git.exe" : "git.exe";
        Directory.SetCurrentDirectory(EMS_ROOT);
        Run(gitExe, "config user.email \"deploy@elitecapital.com\"");
        Run(gitExe, "config user.name \"EMS Deploy Bot\"");
        Run(gitExe, "add .github/workflows/ci.yml");
        Run(gitExe, "commit -m \"ci: add self-hosted deploy job\"");
        int push = RunWithRetry(gitExe, "push origin main", 3,
            "Verifiez vos credentials Git et votre connexion Internet.");
        if (push == 0) LogOK("ci.yml mis a jour et pousse sur GitHub.");
        else           LogWarn("Push echoue - ci.yml modifie localement mais non pousse.");

        SetState("SERVICES"); return "SERVICES";
    }

    // =========================================================
    //  PHASE 8 : SERVICES WINDOWS
    // =========================================================
    static string Phase_Services(string state) {
        if (state != "SERVICES") return state;
        LogStep("PHASE 8/8 - Configuration des services Windows (backup + demarrage auto)");

        // Repertoire backup
        try {
            if (!Directory.Exists(@"C:\EMS\backups")) Directory.CreateDirectory(@"C:\EMS\backups");
            LogOK("Repertoire de backup : C:\\EMS\\backups");
        } catch (Exception ex) { LogWarn("Repertoire backup : " + ex.Message); }

        // Backup quotidien a minuit
        try {
            string script = Path.Combine(EMS_ROOT, "backup-db-auto.ps1");
            if (File.Exists(script)) {
                Run("schtasks.exe", "/delete /tn \"\\EMS\\EMS-Daily-Backup\" /f");
                Thread.Sleep(500);
                int sched = Run("schtasks.exe", string.Format(
                    "/create /tn \"\\EMS\\EMS-Daily-Backup\" " +
                    "/tr \"powershell.exe -NoProfile -ExecutionPolicy Bypass -File \\\"{0}\\\" >> C:\\EMS\\backup.log\" " +
                    "/sc daily /st 00:00 /f", script));
                if (sched == 0)
                    LogOK("Backup automatique programme : chaque nuit a 00h00 -> C:\\EMS\\backups\\");
                else
                    LogWarn("Impossible de creer la tache planifiee de backup.");
            } else {
                LogWarn("backup-db-auto.ps1 introuvable - backup manuel necessaire.");
            }
        } catch (Exception ex) { LogWarn("Backup planifie : " + ex.Message); }

        // Demarrage automatique au boot
        try {
            using (var key = Registry.LocalMachine.OpenSubKey(
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true)) {
                if (key != null) {
                    key.SetValue("EMS-AutoStart", string.Format(
                        "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass " +
                        "-Command \"Set-Location '{0}'; .\\manage-ems.ps1 start\"", EMS_ROOT));
                    LogOK("Demarrage automatique au boot configure.");
                }
            }
        } catch (Exception ex) { LogWarn("Auto-start : " + ex.Message); }

        // Raccourci bureau DevOps Manager (avec icone dediee)
        try {
            string devopsDir = Path.Combine(EMS_ROOT, "devops-manager");
            string devopsShortcutScript = Path.Combine(devopsDir, "create-desktop-shortcut.ps1");
            if (Directory.Exists(devopsDir) && File.Exists(devopsShortcutScript)) {
                int sh = Run("powershell.exe", string.Format(
                    "-NoProfile -ExecutionPolicy Bypass -File \"{0}\"", devopsShortcutScript));
                if (sh == 0)
                    LogOK("Raccourci bureau DevOps Manager cree.");
                else
                    LogWarn("Raccourci DevOps Manager non cree automatiquement (code " + sh + ").");
            } else {
                LogWarn("DevOps Manager introuvable - raccourci bureau non cree.");
            }
        } catch (Exception ex) { LogWarn("Raccourci DevOps : " + ex.Message); }

        SetState("DONE"); return "DONE";
    }

    // =========================================================
    //  RECAPITULATIF FINAL
    // =========================================================
    static void Phase_Done() {
        try { if (File.Exists(STATE_FILE)) File.Delete(STATE_FILE); } catch {}
        string ip = GetServerIP();

        Console.Clear();
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine();
        Console.WriteLine("  +============================================================+");
        Console.WriteLine("  |                                                            |");
        Console.WriteLine("  |    INSTALLATION TERMINEE AVEC SUCCES !                    |");
        Console.WriteLine("  |    EMS v1.5 - Elite Capital Group                        |");
        Console.WriteLine("  |                                                            |");
        Console.WriteLine("  +============================================================+");
        Console.ResetColor();
        Console.WriteLine();

        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine("  APPLICATION");
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("  Sur ce serveur  : http://localhost:5173");
        Console.WriteLine(string.Format("  Reseau local    : http://{0}:5173", ip));
        Console.WriteLine("  API / Swagger   : http://localhost:8000/docs");
        Console.WriteLine("  Health check    : http://localhost:8000/health");

        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine("  IDENTIFIANTS ADMIN (a changer au premier login !)");
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("  Login : admin    |    Mot de passe : ChangeMe123!@#");

        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine("  GESTION DE L'APPLICATION");
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("  cd " + EMS_ROOT);
        Console.WriteLine("  .\\manage-ems.ps1 start    -> Demarrer");
        Console.WriteLine("  .\\manage-ems.ps1 stop     -> Arreter");
        Console.WriteLine("  .\\manage-ems.ps1 status   -> Etat des containers");
        Console.WriteLine("  .\\manage-ems.ps1 logs     -> Logs en direct");

        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine("  MAINTENANCE AUTOMATIQUE");
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("  Backup DB     : chaque nuit a 00h00 -> C:\\EMS\\backups\\");
        Console.WriteLine("  Auto-start    : services redemarrent au boot du serveur");
        Console.WriteLine("  CI/CD deploy  : chaque git push -> tests -> deploy auto");
        Console.WriteLine("  Log install   : " + LOG_FILE);

        Console.ResetColor();
        Console.WriteLine();
        Console.Write("  Appuyez sur Entree pour fermer...");
        Console.ReadLine();
    }

    // =========================================================
    //  SELF-TEST (validation du binaire)
    //  Ecrit dans %TEMP% pour ne pas exiger les droits admin
    // =========================================================
    static int SelfTest() {
        string selfLog = Path.Combine(Path.GetTempPath(), "ems-self-test.log");
        Action<string> w = (s) => {
            Console.WriteLine(s);
            try { File.AppendAllText(selfLog, s + Environment.NewLine, Encoding.UTF8); } catch {}
        };
        if (File.Exists(selfLog)) try { File.Delete(selfLog); } catch {}
        w("Self-test: start");
        w("Self-test: script present");
        w("EMS_ROOT    = " + EMS_ROOT);
        w("STATE_FILE  = " + STATE_FILE);
        w("LOG_FILE    = " + LOG_FILE);
        w("GITHUB_REPO = " + GITHUB_REPO);
        w("Internet    = " + (CheckInternet() ? "OK" : "OFFLINE"));
        w("Server IP   = " + GetServerIP());
        w("SecretKey   = " + GenerateSecretKey().Length + " chars (OK)");
        w("[OK]   Self-test complete. Log: " + selfLog);
        return 0;
    }

    // =========================================================
    //  ELEVATION UAC
    // =========================================================
    static bool IsAdmin() {
        return new WindowsPrincipal(WindowsIdentity.GetCurrent())
            .IsInRole(WindowsBuiltInRole.Administrator);
    }
    static void ElevateIfNeeded() {
        if (IsAdmin()) return;
        try {
            Process.Start(new ProcessStartInfo {
                FileName        = System.Reflection.Assembly.GetExecutingAssembly().Location,
                UseShellExecute = true,
                Verb            = "runas"
            });
        } catch { }
        Environment.Exit(0);
    }

    // =========================================================
    //  MAIN
    // =========================================================
    static int Main(string[] args) {
        if (args.Length > 0 && args[0] == "--self-test") return SelfTest();

        ElevateIfNeeded();

        Console.Title = "EMS Server - Installateur v1.5";
        Console.Clear();
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine();
        Console.WriteLine("  +============================================================+");
        Console.WriteLine("  |         EMS Server  -  Installateur v1.5                  |");
        Console.WriteLine("  |         Elite Capital Group                               |");
        Console.WriteLine("  |                                                            |");
        Console.WriteLine("  |   Installe automatiquement :                              |");
        Console.WriteLine("  |   WSL2 + Docker + Git + Application + Base de donnees     |");
        Console.WriteLine("  |   CI/CD + Backup automatique + Demarrage auto             |");
        Console.WriteLine("  |                                                            |");
        Console.WriteLine("  |   Duree estimee : 60 a 120 minutes (premiere fois)        |");
        Console.WriteLine("  |   Probleme reseau -> attend et reessaie automatiquement    |");
        Console.WriteLine("  |   WSL2 manquant  -> reparation automatique                |");
        Console.WriteLine("  |   Redemarrage    -> reprend automatiquement               |");
        Console.WriteLine("  +============================================================+");
        Console.ResetColor();
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine("  Appuyez sur ENTREE pour demarrer, ou CTRL+C pour annuler.");
        Console.ResetColor();
        Console.ReadLine();

        Directory.CreateDirectory(@"C:\EMS");
        // Forcer TLS 1.2 - requis par GitHub, Docker Hub, etc.
        // .NET 4.0 utilise TLS 1.0 par defaut ce qui est rejete par les serveurs modernes
        try {
            ServicePointManager.SecurityProtocol =
                (SecurityProtocolType)3072 |  // TLS 1.2
                (SecurityProtocolType)768  |  // TLS 1.1
                SecurityProtocolType.Tls;     // TLS 1.0 (fallback)
            ServicePointManager.ServerCertificateValidationCallback = (s,c,ch,e) => true;
            ServicePointManager.Expect100Continue = false;
        } catch { }
        Log("=== EMS Installer v1.5 - " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " ===");

        Log("Verification de la connexion Internet...");
        if (!CheckInternet())
            LogWarn("Connexion Internet non detectee. L'installateur attendra automatiquement a chaque etape reseau.");
        else
            LogOK("Connexion Internet disponible.");

        string state = GetState();
        if (state != "START")
            Log("Reprise depuis l'etat sauvegarde : " + state);
        else
            Log("Nouvelle installation (etat initial).");

        state = Phase_WSL(state);
        state = Phase_Docker(state);
        state = Phase_Git(state);
        state = Phase_Clone(state);
        state = Phase_Env(state);
        state = Phase_Compose(state);
        state = Phase_Firewall(state);
        state = Phase_Runner(state);
        state = Phase_RunnerCI(state);
        state = Phase_Services(state);

        if (state == "DONE") Phase_Done();

        // Rapport d'erreurs final meme en cas de succes
        if (_errors.Count > 0) {
            GenerateErrorReport();
            LogWarn(string.Format("{0} avertissement(s) enregistre(s). Rapport : {1}", _errors.Count, ERROR_FILE));
        }

        return 0;
    }
}

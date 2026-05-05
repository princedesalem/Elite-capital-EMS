using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Security.Principal;
using System.Text;
using System.Threading;
using Microsoft.Win32;

class EMSInstaller {

    // =========================================================
    //  CONFIGURATION
    // =========================================================
    static readonly string EMS_ROOT    = @"C:\EMS\extranet";
    static readonly string RUNNER_DIR  = @"C:\actions-runner";
    static readonly string STATE_FILE  = @"C:\ems-install-state.txt";
    static readonly string LOG_FILE    = @"C:\ems-install-log.txt";
    static readonly string GITHUB_REPO = "https://github.com/princedusalem/Elite-capital-EMS";

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
    static void LogOK(string msg)   { Log("[OK] "   + msg, ConsoleColor.Green);  }
    static void LogWarn(string msg) { Log("[WARN] " + msg, ConsoleColor.Yellow); }
    static void LogErr(string msg)  {
        Log("[ERREUR] " + msg, ConsoleColor.Red);
        Console.Write("\n  Appuyez sur Entree pour quitter...");
        Console.ReadLine();
        Environment.Exit(1);
    }
    static void LogStep(string msg) {
        Console.WriteLine();
        ConsoleColor prev = Console.ForegroundColor;
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("  >>> " + msg);
        Console.ForegroundColor = prev;
        Log(msg);
    }

    // =========================================================
    //  MACHINE D ETAT (reprise apres reboot)
    // =========================================================
    static string GetState() {
        if (File.Exists(STATE_FILE)) return File.ReadAllText(STATE_FILE).Trim();
        return "START";
    }
    static void SetState(string s) { File.WriteAllText(STATE_FILE, s); }

    // =========================================================
    //  ELEVATION ADMINISTRATEUR
    // =========================================================
    static bool IsAdmin() {
        return new WindowsPrincipal(WindowsIdentity.GetCurrent())
            .IsInRole(WindowsBuiltInRole.Administrator);
    }
    static void EnsureAdmin() {
        if (!IsAdmin()) {
            try {
                Process.Start(new ProcessStartInfo {
                    FileName        = System.Reflection.Assembly.GetExecutingAssembly().Location,
                    Verb            = "runas",
                    UseShellExecute = true
                });
                Environment.Exit(0);
            } catch {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("ERREUR : Relancez ce programme en tant qu Administrateur.");
                Console.ResetColor();
                Console.ReadLine();
                Environment.Exit(1);
            }
        }
    }

    // =========================================================
    //  EXECUTION DE COMMANDES
    // =========================================================
    static int Run(string exe, string arguments) {
        try {
            var p = new Process();
            p.StartInfo = new ProcessStartInfo {
                FileName               = exe,
                Arguments              = arguments,
                UseShellExecute        = false,
                RedirectStandardOutput = true,
                RedirectStandardError  = true,
                CreateNoWindow         = false,
                WorkingDirectory       = Directory.GetCurrentDirectory()
            };
            p.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) {
                if (e.Data != null) {
                    Console.WriteLine("    " + e.Data);
                    try { File.AppendAllText(LOG_FILE, e.Data + Environment.NewLine, Encoding.UTF8); } catch {}
                }
            };
            p.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) {
                if (e.Data != null) {
                    Console.WriteLine("    " + e.Data);
                    try { File.AppendAllText(LOG_FILE, e.Data + Environment.NewLine, Encoding.UTF8); } catch {}
                }
            };
            p.Start();
            p.BeginOutputReadLine();
            p.BeginErrorReadLine();
            p.WaitForExit();
            return p.ExitCode;
        } catch (Exception ex) {
            Log("Erreur Run(" + exe + "): " + ex.Message, ConsoleColor.Red);
            return -1;
        }
    }

    static string ReadOutput(string exe, string arguments) {
        try {
            var p = new Process();
            p.StartInfo = new ProcessStartInfo {
                FileName               = exe,
                Arguments              = arguments,
                UseShellExecute        = false,
                RedirectStandardOutput = true,
                RedirectStandardError  = true,
                CreateNoWindow         = true
            };
            p.Start();
            string output = p.StandardOutput.ReadToEnd() + p.StandardError.ReadToEnd();
            p.WaitForExit();
            return output;
        } catch { return ""; }
    }

    // =========================================================
    //  TELECHARGEMENT
    // =========================================================
    static void Download(string url, string dest) {
        Log("Telechargement : " + url);
        ServicePointManager.SecurityProtocol = (SecurityProtocolType)0xC00 | (SecurityProtocolType)0x300 | SecurityProtocolType.Tls;
        using (var wc = new WebClient()) {
            wc.Headers.Add("User-Agent", "EMS-Installer/1.0");
            wc.DownloadFile(url, dest);
        }
        LogOK("Fichier telecharge : " + dest);
    }

    // =========================================================
    //  REBOOT + REPRISE AUTOMATIQUE
    // =========================================================
    static void RebootContinue(string nextState, string why) {
        SetState(nextState);
        string self = System.Reflection.Assembly.GetExecutingAssembly().Location;
        try {
            using (RegistryKey key = Registry.LocalMachine.OpenSubKey(
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce", true)) {
                if (key != null)
                    key.SetValue("EMS-AutoInstall", string.Format("\"{0}\"", self));
            }
        } catch (Exception ex) {
            LogWarn("Impossible d ecrire dans RunOnce : " + ex.Message);
        }
        Log("Redemarrage necessaire : " + why);
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("\n  Le programme reprendra automatiquement apres le redemarrage.");
        Console.ResetColor();
        Console.Write("  Appuyez sur Entree pour redemarrer...");
        Console.ReadLine();
        Process.Start("shutdown.exe", "/r /t 5");
        Environment.Exit(0);
    }

    // =========================================================
    //  DETECTION IP SERVEUR
    // =========================================================
    static string GetServerIP() {
        string raw = ReadOutput("powershell.exe",
            "-NoProfile -Command \"" +
            "Get-NetIPAddress -AddressFamily IPv4 | " +
            "Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Bluetooth' -and " +
            "$_.IPAddress -notmatch '^127\\.' -and $_.IPAddress -notmatch '^169\\.254\\.' } | " +
            "Sort-Object PrefixLength -Descending | Select-Object -First 1 -ExpandProperty IPAddress\"");
        string ip = raw.Trim();
        return string.IsNullOrEmpty(ip) ? "127.0.0.1" : ip;
    }

    // =========================================================
    //  BANNIERE
    // =========================================================
    static void ShowBanner() {
        Console.Clear();
        Console.ForegroundColor = ConsoleColor.Blue;
        Console.WriteLine();
        Console.WriteLine("  ######  #     #  #####  ");
        Console.WriteLine("  #       ##   ## #     # ");
        Console.WriteLine("  #####   # # # # #       ");
        Console.WriteLine("  #       #  #  #  #####  ");
        Console.WriteLine("  #       #     #       # ");
        Console.WriteLine("  ######  #     # ######  ");
        Console.ResetColor();
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine();
        Console.WriteLine("  INSTALLATION SERVEUR - Elite Capital Group");
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("  " + new string('-', 45));
        Console.ResetColor();
        Console.WriteLine();
    }

    // =========================================================
    //  PHASE 1 : WSL 2
    // =========================================================
    static string Phase_WSL(string state) {
        if (state != "START") return state;
        LogStep("PHASE 1/7 - Activation de WSL 2");

        string wslOut = ReadOutput("wsl.exe", "--status");
        if (wslOut.Contains("WSL 2") || wslOut.Contains("version : 2") || wslOut.Contains("version: 2")) {
            LogOK("WSL 2 deja active."); SetState("DOCKER"); return "DOCKER";
        }
        string wslList = ReadOutput("wsl.exe", "-l -v");
        if (wslList.Contains("2")) {
            LogOK("WSL 2 deja presente."); SetState("DOCKER"); return "DOCKER";
        }

        Log("Installation de WSL 2...");
        Run("wsl.exe", "--install --no-distribution");
        RebootContinue("DOCKER", "WSL 2 vient d etre installe");
        return "DOCKER";
    }

    // =========================================================
    //  PHASE 2 : Docker Desktop
    // =========================================================
    static string Phase_Docker(string state) {
        if (state != "DOCKER") return state;
        LogStep("PHASE 2/7 - Installation de Docker Desktop");

        string dockerExe = @"C:\Program Files\Docker\Docker\Docker Desktop.exe";
        if (File.Exists(dockerExe)) {
            LogOK("Docker Desktop deja installe.");
        } else {
            Log("Telechargement de Docker Desktop (~500 Mo) - patience...");
            string installer = Path.Combine(Path.GetTempPath(), "DockerDesktopInstaller.exe");
            Download("https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe", installer);
            Log("Installation silencieuse de Docker Desktop...");
            Run(installer, "install --quiet --accept-license");
            LogOK("Docker Desktop installe.");
            RebootContinue("GIT", "Docker Desktop installe");
        }
        SetState("GIT"); return "GIT";
    }

    // =========================================================
    //  PHASE 3 : Git
    // =========================================================
    static string Phase_Git(string state) {
        if (state != "GIT") return state;
        LogStep("PHASE 3/7 - Installation de Git");

        string gitPath = @"C:\Program Files\Git\cmd\git.exe";
        string whereGit = ReadOutput("where.exe", "git");
        bool gitExists  = File.Exists(gitPath) || !string.IsNullOrWhiteSpace(whereGit);

        if (gitExists) {
            string g = File.Exists(gitPath) ? gitPath : "git.exe";
            string gitVer = ReadOutput(g, "--version");
            LogOK("Git deja installe : " + gitVer.Trim());
        } else {
            string ver     = "2.44.0";
            string gitInst = Path.Combine(Path.GetTempPath(), "Git-Setup.exe");
            Log("Telechargement de Git " + ver + "...");
            Download(string.Format(
                "https://github.com/git-for-windows/git/releases/download/v{0}.windows.1/Git-{0}-64-bit.exe", ver),
                gitInst);
            Log("Installation de Git...");
            Run(gitInst, "/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS");
            LogOK("Git installe.");
        }
        SetState("CLONE"); return "CLONE";
    }

    // =========================================================
    //  PHASE 4 : Cloner le depot
    // =========================================================
    static string Phase_Clone(string state) {
        if (state != "CLONE") return state;
        LogStep("PHASE 4/7 - Telechargement du code depuis GitHub");

        if (!Directory.Exists(@"C:\EMS")) Directory.CreateDirectory(@"C:\EMS");

        string git = File.Exists(@"C:\Program Files\Git\cmd\git.exe")
            ? @"C:\Program Files\Git\cmd\git.exe" : "git.exe";

        if (Directory.Exists(Path.Combine(EMS_ROOT, ".git"))) {
            LogOK("Repository deja present. Mise a jour (git pull)...");
            Directory.SetCurrentDirectory(EMS_ROOT);
            Run(git, "pull origin main");
        } else {
            Log("Clonage depuis " + GITHUB_REPO + "...");
            Run(git, string.Format("clone {0} \"{1}\"", GITHUB_REPO, EMS_ROOT));
            if (!Directory.Exists(Path.Combine(EMS_ROOT, ".git")))
                LogErr("Le clonage a echoue. Verifiez votre connexion internet et vos acces GitHub.");
            LogOK("Code telecharge dans " + EMS_ROOT);
        }
        SetState("ENV"); return "ENV";
    }

    // =========================================================
    //  PHASE 5 : Configuration .env
    // =========================================================
    static string Phase_Env(string state) {
        if (state != "ENV") return state;
        LogStep("PHASE 5/7 - Configuration reseau et fichier .env");

        string serverIP = GetServerIP();
        Log("IP detectee du serveur : " + serverIP);

        string envDir  = Path.Combine(EMS_ROOT, "frontend");
        string envPath = Path.Combine(envDir, ".env");
        if (!Directory.Exists(envDir)) Directory.CreateDirectory(envDir);

        string content = string.Concat(
            "# Configuration generee automatiquement par Installer EMS Server", Environment.NewLine,
            "# Date    : ", DateTime.Now.ToString("yyyy-MM-dd HH:mm"), Environment.NewLine,
            "# Serveur : ", serverIP, Environment.NewLine, Environment.NewLine,
            "VITE_API_URL=http://localhost:8000", Environment.NewLine);
        File.WriteAllText(envPath, content, Encoding.UTF8);
        LogOK("frontend/.env configure (VITE_API_URL=http://localhost:8000)");
        Log(string.Format("  -> Acces LAN via http://{0}:5173", serverIP), ConsoleColor.DarkGray);

        Console.ForegroundColor = ConsoleColor.DarkCyan;
        Console.WriteLine();
        Console.WriteLine("  +--------------------------------------------------+");
        Console.WriteLine("  |   Acces a l application apres installation        |");
        Console.WriteLine("  |                                                    |");
        Console.WriteLine("  |   Sur ce serveur : http://localhost:5173           |");
        Console.WriteLine(string.Format("  |   Reseau local   : http://{0}:5173  |", serverIP.PadRight(15)));
        Console.WriteLine("  +--------------------------------------------------+");
        Console.ResetColor();
        Console.WriteLine();

        SetState("COMPOSE"); return "COMPOSE";
    }

    // =========================================================
    //  PHASE 6 : Docker Compose
    // =========================================================
    static void WaitForDocker(int maxSeconds) {
        Log("Attente que Docker soit pret (max " + maxSeconds + "s)...");
        int waited = 0;
        while (waited < maxSeconds) {
            Thread.Sleep(5000); waited += 5;
            string info = ReadOutput("docker.exe", "info");
            if (info.Contains("Server Version") || info.Contains("Containers")) {
                LogOK("Docker est pret."); return;
            }
        }
        LogErr("Docker ne repond pas apres " + maxSeconds + "s. Ouvrez Docker Desktop et relancez.");
    }

    static string Phase_Compose(string state) {
        if (state != "COMPOSE") return state;
        LogStep("PHASE 6/7 - Demarrage de l application");
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("  (Premier build : 10-20 minutes - telechargement Python, Node, MySQL)");
        Console.ResetColor();
        Console.WriteLine();

        string dockerInfo = ReadOutput("docker.exe", "info");
        if (!dockerInfo.Contains("Server Version") && !dockerInfo.Contains("Containers")) {
            Log("Lancement de Docker Desktop...");
            Process.Start(@"C:\Program Files\Docker\Docker\Docker Desktop.exe");
            Thread.Sleep(10000);
            WaitForDocker(180);
        }

        Directory.SetCurrentDirectory(EMS_ROOT);
        Log("docker compose up --build -d ...");
        Run("docker.exe", "compose up --build -d");

        Log("Attente que les services demarrent (30s)...");
        Thread.Sleep(30000);

        string ps = ReadOutput("docker.exe", "compose ps");
        Console.WriteLine(ps);
        if (ps.Contains("Up") || ps.Contains("running"))
            LogOK("Application demarree avec succes !");
        else
            LogWarn("Certains containers ne semblent pas Up. Verifiez avec : docker compose ps");

        SetState("FIREWALL"); return "FIREWALL";
    }

    // =========================================================
    //  PHASE 6.5 : Pare-feu
    // =========================================================
    static string Phase_Firewall(string state) {
        if (state != "FIREWALL") return state;
        LogStep("Ouverture des ports dans le Pare-feu Windows");

        foreach (int port in new int[] { 8000, 5173 }) {
            string name  = port == 8000 ? "EMS Backend" : "EMS Frontend";
            string check = ReadOutput("powershell.exe", string.Format(
                "-NoProfile -Command \"(Get-NetFirewallRule -DisplayName '{0}' -ErrorAction SilentlyContinue) -ne $null\"",
                name));
            if (check.Trim().ToLower() == "true") {
                LogOK("Port " + port + " deja ouvert.");
            } else {
                Run("powershell.exe", string.Format(
                    "-NoProfile -Command \"New-NetFirewallRule -DisplayName '{0}' -Direction Inbound -Protocol TCP -LocalPort {1} -Action Allow | Out-Null\"",
                    name, port));
                LogOK("Port " + port + " ouvert.");
            }
        }
        SetState("RUNNER"); return "RUNNER";
    }

    // =========================================================
    //  PHASE 7 : GitHub Actions Runner
    // =========================================================
    static string Phase_Runner(string state) {
        if (state != "RUNNER") return state;
        LogStep("PHASE 7/7 - Installation du GitHub Actions Runner (CI/CD automatique)");

        string svcStatus = ReadOutput("powershell.exe",
            "-NoProfile -Command \"(Get-Service -Name 'actions.runner.*' -ErrorAction SilentlyContinue).Status\"");
        if (svcStatus.Trim() == "Running") {
            LogOK("GitHub Actions Runner deja installe et en cours d execution.");
            SetState("DONE"); return "DONE";
        }

        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine();
        Console.WriteLine("  +---------------------------------------------------------------+");
        Console.WriteLine("  |  ACTION REQUISE : recuperer le token GitHub                   |");
        Console.WriteLine("  |                                                               |");
        Console.WriteLine("  |  1. Ouvrez dans votre navigateur :                           |");
        Console.WriteLine("  |     https://github.com/princedusalem/Elite-capital-EMS       |");
        Console.WriteLine("  |     /settings/actions/runners/new?runnerOs=win               |");
        Console.WriteLine("  |  2. Cliquez sur Windows                                      |");
        Console.WriteLine("  |  3. Cherchez la ligne avec --token                           |");
        Console.WriteLine("  |  4. Copiez la valeur du token                                |");
        Console.WriteLine("  +---------------------------------------------------------------+");
        Console.ResetColor();
        Console.WriteLine();
        Console.Write("  Collez le token ici et appuyez sur Entree : ");
        string token = (Console.ReadLine() ?? "").Trim();

        if (token.Length < 20) {
            Log("Token trop court. Relancez et entrez le token complet.", ConsoleColor.Red);
            SetState("RUNNER");
            Console.Write("Entree pour quitter"); Console.ReadLine();
            Environment.Exit(1);
        }

        if (!Directory.Exists(RUNNER_DIR)) Directory.CreateDirectory(RUNNER_DIR);
        Directory.SetCurrentDirectory(RUNNER_DIR);

        if (!File.Exists(Path.Combine(RUNNER_DIR, "config.cmd"))) {
            Log("Telechargement du runner GitHub Actions...");
            Download("https://github.com/actions/runner/releases/download/v2.316.0/actions-runner-win-x64-2.316.0.zip",
                "runner.zip");
            Log("Extraction...");
            Run("powershell.exe", "-NoProfile -Command \"Expand-Archive 'runner.zip' -DestinationPath '.' -Force\"");
            LogOK("Runner telecharge et extrait.");
        }

        Log("Configuration du runner...");
        Run("cmd.exe", string.Format(
            "/c config.cmd --url {0} --token {1} --name EMS-Server --work _work --unattended",
            GITHUB_REPO, token));

        Log("Installation comme service Windows...");
        Run("cmd.exe", "/c svc.cmd install");
        Run("cmd.exe", "/c svc.cmd start");
        LogOK("GitHub Actions Runner installe et demarre.");

        SetState("RUNNER_CI"); return "RUNNER_CI";
    }

    // =========================================================
    //  PHASE 7.5 : Patch ci.yml
    // =========================================================
    static string Phase_RunnerCI(string state) {
        if (state != "RUNNER_CI") return state;
        LogStep("Ajout du job deploy dans .github/workflows/ci.yml");

        string ciPath = Path.Combine(EMS_ROOT, ".github\\workflows\\ci.yml");
        if (!File.Exists(ciPath)) {
            LogWarn("ci.yml introuvable - ajout manuel necessaire.");
            SetState("DONE"); return "DONE";
        }

        string ciContent = File.ReadAllText(ciPath, Encoding.UTF8);
        if (ciContent.Contains("runs-on: self-hosted")) {
            LogOK("Job deploy deja present dans ci.yml.");
            SetState("DONE"); return "DONE";
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
            "      - name: Rebuild and restart containers\n" +
            "        working-directory: C:\\EMS\\extranet\n" +
            "        run: docker compose up --build -d\n\n" +
            "      - name: Health check backend\n" +
            "        run: |\n" +
            "          $ok = $false\n" +
            "          for ($i = 0; $i -lt 12; $i++) {\n" +
            "            Start-Sleep -Seconds 5\n" +
            "            try {\n" +
            "              $r = Invoke-RestMethod http://localhost:8000/health -TimeoutSec 3\n" +
            "              $ok = $true; break\n" +
            "            } catch {}\n" +
            "          }\n" +
            "          if (-not $ok) { Write-Error \"Backend health check failed\"; exit 1 }\n" +
            "          Write-Host \"Backend OK\"\n";

        File.WriteAllText(ciPath, ciContent + deployJob, Encoding.UTF8);

        string git = File.Exists(@"C:\Program Files\Git\cmd\git.exe")
            ? @"C:\Program Files\Git\cmd\git.exe" : "git.exe";
        Directory.SetCurrentDirectory(EMS_ROOT);
        Run(git, "config user.email \"deploy@elitecapital.com\"");
        Run(git, "config user.name \"EMS Deploy Bot\"");
        Run(git, "add .github/workflows/ci.yml");
        Run(git, "commit -m \"ci: add self-hosted deploy job for local server\"");
        Run(git, "push origin main");
        LogOK("ci.yml mis a jour et pousse sur GitHub.");

        SetState("DONE"); return "DONE";
    }

    // =========================================================
    //  RECAPITULATIF FINAL
    // =========================================================
    static void Phase_Done() {
        try { if (File.Exists(STATE_FILE)) File.Delete(STATE_FILE); } catch {}
        string serverIP = GetServerIP();

        Console.Clear();
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine();
        Console.WriteLine("  +--------------------------------------------------+");
        Console.WriteLine("  |                                                    |");
        Console.WriteLine("  |   INSTALLATION TERMINEE AVEC SUCCES !             |");
        Console.WriteLine("  |   EMS - Elite Capital Group                        |");
        Console.WriteLine("  |                                                    |");
        Console.WriteLine("  +--------------------------------------------------+");
        Console.ResetColor();
        Console.WriteLine();

        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine("  APPLICATION ACCESSIBLE :");
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("  " + new string('-', 50));
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("  Sur ce serveur  : http://localhost:5173");
        Console.WriteLine(string.Format("  Reseau local    : http://{0}:5173", serverIP));
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("  API Backend     : http://localhost:8000/docs");

        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine("  CI/CD AUTOMATIQUE :");
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("  " + new string('-', 50));
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine("  Chaque  git push origin main  depuis votre PC dev");
        Console.WriteLine("  => Tests GitHub Actions (pytest + vitest)");
        Console.WriteLine("  => Si tests OK : redeploiement automatique ici");

        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine("  COMMANDES UTILES (depuis C:\\EMS\\extranet) :");
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("  " + new string('-', 50));
        Console.ForegroundColor = ConsoleColor.Gray;
        Console.WriteLine("  docker compose ps                 => voir services");
        Console.WriteLine("  docker compose logs -f backend    => voir logs");
        Console.WriteLine("  docker compose restart backend    => redemarrer API");
        Console.WriteLine("  docker compose down               => arreter tout");

        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("  Log d installation : " + LOG_FILE);
        Console.ResetColor();
        Console.WriteLine();
        Console.Write("  Appuyez sur Entree pour fermer...");
        Console.ReadLine();
    }

    // =========================================================
    //  SELF-TEST (mode CI, sans UAC)
    // =========================================================
    static int RunSelfTest() {
        string logPath = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory, "Installer-EMS-launcher.log");
        try {
            File.AppendAllText(logPath, string.Format(
                "[{0:yyyy-MM-dd HH:mm:ss}] Self-test: start{1}",
                DateTime.Now, Environment.NewLine), Encoding.UTF8);

            string self = System.Reflection.Assembly.GetExecutingAssembly().Location;
            long size = new FileInfo(self).Length;

            File.AppendAllText(logPath, string.Format(
                "[{0:yyyy-MM-dd HH:mm:ss}] Self-test: script present ({1} bytes){2}",
                DateTime.Now, size, Environment.NewLine), Encoding.UTF8);
            return 0;
        } catch (Exception ex) {
            try { File.AppendAllText(logPath, string.Format(
                "[{0:yyyy-MM-dd HH:mm:ss}] Self-test: erreur {1}{2}",
                DateTime.Now, ex.Message, Environment.NewLine), Encoding.UTF8); } catch {}
            return 1;
        }
    }

    // =========================================================
    //  POINT D ENTREE
    // =========================================================
    [STAThread]
    static int Main(string[] args) {
        if (args != null && args.Length > 0 &&
            string.Equals(args[0], "--self-test", StringComparison.OrdinalIgnoreCase)) {
            return RunSelfTest();
        }

        EnsureAdmin();
        ShowBanner();

        string state = GetState();
        Log("Phase courante : " + state);

        state = Phase_WSL(state);
        state = Phase_Docker(state);
        state = Phase_Git(state);
        state = Phase_Clone(state);
        state = Phase_Env(state);
        state = Phase_Compose(state);
        state = Phase_Firewall(state);
        state = Phase_Runner(state);
        state = Phase_RunnerCI(state);

        if (state == "DONE") Phase_Done();

        return 0;
    }
}

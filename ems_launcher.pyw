#!/usr/bin/env python3
"""
EMS Server Launcher  -  Elite Capital Group S.A.
Gestion native des services Windows (sans Docker)
Police : Century Gothic
"""
import tkinter as tk
from tkinter import scrolledtext
import subprocess, threading, os, time, socket, webbrowser, ctypes
import urllib.request
from datetime import datetime

# ── Palette EMS ───────────────────────────────────────────────────────────────
BG_DARK    = "#0d1b2e"
BG_CARD    = "#162438"
BG_HEADER  = "#0a1520"
BG_BTN     = "#1e3a6e"
ACCENT_RED = "#e63329"
ACCENT_BLU = "#1e5fa8"
TEXT_WHT   = "#ffffff"
TEXT_GRY   = "#8899aa"
SUCCESS    = "#2da44e"
WARNING    = "#f5a623"
DANGER     = "#e63329"
BORDER     = "#243d63"
FONT       = "Century Gothic"

# ── Chemins ───────────────────────────────────────────────────────────────────
EMS_ROOT     = r"C:\EMS"
BACKEND_DIR  = r"C:\EMS\backend"
FRONTEND_DIR = r"C:\EMS\frontend"
VENV_PYTHON  = r"C:\EMS\backend\venv\Scripts\python.exe"
NPM_CMD      = "npm"
LOG_STDOUT   = r"C:\EMS\logs\backend_stdout.log"
LOG_STDERR   = r"C:\EMS\logs\backend_stderr.log"

# ── Services Windows (label -> nom service) ───────────────────────────────────
WIN_SERVICES = {
    "MySQL":   "MySQL8",
    "Backend": "EMS-Backend",
    "Nginx":   "EMS-Nginx",
}
STARTUP_ORDER  = ["MySQL", "Backend", "Nginx"]
SHUTDOWN_ORDER = ["Nginx", "Backend", "MySQL"]

# ── Admin ─────────────────────────────────────────────────────────────────────
def is_admin() -> bool:
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def run_as_admin(ps_cmd: str):
    b64 = __import__("base64").b64encode(ps_cmd.encode("utf-16-le")).decode()
    subprocess.Popen(
        ["powershell.exe", "-NoProfile", "-NonInteractive",
         "-EncodedCommand", b64],
        creationflags=subprocess.CREATE_NO_WINDOW
    )

# ── Helpers ───────────────────────────────────────────────────────────────────
def svc_status(svc_name: str) -> str:
    try:
        r = subprocess.run(
            ["sc", "query", svc_name],
            capture_output=True, text=True, timeout=5,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        for line in r.stdout.splitlines():
            if "STATE" in line:
                for p in line.split():
                    if p in ("RUNNING", "STOPPED", "START_PENDING",
                             "STOP_PENDING", "PAUSED"):
                        return p.title().replace("_", "")
        return "Unknown"
    except Exception:
        return "Unknown"

def check_port(port: int, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection(("localhost", port), timeout=timeout):
            return True
    except Exception:
        return False

# ── StatusDot ─────────────────────────────────────────────────────────────────
class StatusDot(tk.Canvas):
    _C = {"Running": SUCCESS, "Stopped": DANGER,
          "Startpending": WARNING, "Stoppending": WARNING,
          "Unknown": TEXT_GRY}

    def __init__(self, parent, bg_col=BG_CARD, size=14, **kw):
        super().__init__(parent, width=size, height=size,
                         bg=bg_col, highlightthickness=0, **kw)
        self._s = size; self._oval = None
        self.set("Unknown")

    def set(self, state: str):
        color = self._C.get(state, TEXT_GRY)
        if self._oval:
            self.delete(self._oval)
        m = 2
        self._oval = self.create_oval(m, m, self._s - m, self._s - m,
                                      fill=color, outline="")

# ── Bouton helper ──────────────────────────────────────────────────────────────
def Btn(parent, text, bg, fg=TEXT_WHT, cmd=None, pady=5, bold=True,
        fsize=9, fill_x=False, anchor="center"):
    style = "bold" if bold else "normal"
    b = tk.Button(parent, text=text,
                  font=(FONT, fsize, style),
                  bg=bg, fg=fg, bd=0, padx=10, pady=pady,
                  activebackground=BG_BTN, activeforeground=TEXT_WHT,
                  cursor="hand2", anchor=anchor, relief="flat")
    if cmd:
        b.configure(command=cmd)
    if fill_x:
        b.pack(fill="x", pady=2)
    return b

# ── Application ───────────────────────────────────────────────────────────────
class EMSLauncher(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("EMS Server Launcher")
        self.configure(bg=BG_DARK)
        self.resizable(True, True)
        self.minsize(920, 660)

        for ico in [r"C:\EMS\ems-launcher.ico", r"C:\EMS\ems-icon.ico"]:
            if os.path.exists(ico):
                try:
                    self.iconbitmap(ico)
                except Exception:
                    pass
                break

        self._dots       = {}
        self._log_lock   = threading.Lock()
        self._alive      = True
        self._front_proc = None

        self._build_ui()

        W, H = 980, 720
        self.update_idletasks()
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        self.geometry(f"{W}x{H}+{(sw-W)//2}+{(sh-H)//2}")

        self._post_init()

    # ═══════════════════════════════ UI BUILD ══════════════════════════════════
    def _build_ui(self):
        self._build_header()

        body = tk.Frame(self, bg=BG_DARK, padx=12, pady=10)
        body.pack(fill="both", expand=True)

        left = tk.Frame(body, bg=BG_DARK, width=310)
        left.pack(side="left", fill="y", padx=(0, 10))
        left.pack_propagate(False)

        self._build_services_card(left)
        self._build_actions_card(left)
        self._build_frontend_card(left)
        self._build_links_card(left)

        right = tk.Frame(body, bg=BG_DARK)
        right.pack(side="left", fill="both", expand=True)
        self._build_log_panel(right)

        self._build_footer()

    # ── Header ────────────────────────────────────────────────────────────────
    def _build_header(self):
        hdr = tk.Frame(self, bg=BG_HEADER)
        hdr.pack(fill="x")
        tk.Frame(hdr, bg=ACCENT_RED, height=5).pack(fill="x")

        bar = tk.Frame(hdr, bg=BG_HEADER, padx=20, pady=10)
        bar.pack(fill="x")

        badge = tk.Canvas(bar, width=46, height=46, bg=BG_HEADER,
                          highlightthickness=0)
        badge.pack(side="left", padx=(0, 14))
        badge.create_oval(2, 2, 44, 44, fill=ACCENT_RED, outline="")
        badge.create_text(23, 24, text="EMS", fill=TEXT_WHT,
                          font=(FONT, 11, "bold"))

        ttl = tk.Frame(bar, bg=BG_HEADER)
        ttl.pack(side="left")
        tk.Label(ttl, text="EMS SERVER LAUNCHER",
                 font=(FONT, 17, "bold"), fg=TEXT_WHT,
                 bg=BG_HEADER).pack(anchor="w")
        tk.Label(ttl,
                 text="Elite Capital Group S.A.  -  Gestion native des services",
                 font=(FONT, 8), fg=TEXT_GRY, bg=BG_HEADER).pack(anchor="w")

        right_frame = tk.Frame(bar, bg=BG_HEADER)
        right_frame.pack(side="right")
        admin_color = SUCCESS if is_admin() else WARNING
        admin_text  = "Administrateur" if is_admin() else "Non-Admin (limite)"
        tk.Label(right_frame, text=admin_text,
                 font=(FONT, 8, "bold"), fg=admin_color,
                 bg=BG_HEADER).pack(anchor="e")
        tk.Label(right_frame, text="Mode natif (sans Docker)",
                 font=(FONT, 8), fg=TEXT_GRY, bg=BG_HEADER).pack(anchor="e")

    # ── Card container ────────────────────────────────────────────────────────
    def _card(self, parent, title):
        outer = tk.Frame(parent, bg=BORDER, padx=1, pady=1)
        outer.pack(fill="x", pady=(0, 8))
        inner = tk.Frame(outer, bg=BG_CARD, padx=10, pady=9)
        inner.pack(fill="both")
        tk.Label(inner, text=title,
                 font=(FONT, 9, "bold"), fg=ACCENT_RED,
                 bg=BG_CARD).pack(anchor="w", pady=(0, 6))
        return inner

    # ── Services card ─────────────────────────────────────────────────────────
    def _build_services_card(self, parent):
        card = self._card(parent, "  SERVICES WINDOWS")

        rows = [
            ("MySQL",   "MySQL8",      3306),
            ("Backend", "EMS-Backend", 8000),
            ("Nginx",   "EMS-Nginx",   80),
        ]
        for label, svc, port in rows:
            row = tk.Frame(card, bg=BG_CARD)
            row.pack(fill="x", pady=3)

            dot = StatusDot(row)
            dot.pack(side="left", padx=(0, 7))
            self._dots[label] = dot

            tk.Label(row, text=label,
                     font=(FONT, 9, "bold"), fg=TEXT_WHT,
                     bg=BG_CARD, width=8, anchor="w").pack(side="left")
            tk.Label(row, text=f":{port}",
                     font=("Consolas", 8), fg=TEXT_GRY,
                     bg=BG_CARD, width=5).pack(side="left")

            for sym, action in [("  Start  ", "start"),
                                 ("  Stop   ", "stop"),
                                 (" Restart ", "restart")]:
                sc = svc; nm = label; ac = action
                bg = {"start": "#1a5c35", "stop": "#5c1a1a",
                      "restart": "#5c4a1a"}[action]
                tk.Button(
                    row, text=sym,
                    font=(FONT, 7, "bold"), bg=bg, fg=TEXT_WHT,
                    bd=0, padx=3, pady=1,
                    activebackground=BG_BTN, cursor="hand2",
                    command=lambda s=sc, a=ac, n=nm: self._svc_cmd(s, a, n)
                ).pack(side="left", padx=1)

    # ── Actions card ──────────────────────────────────────────────────────────
    def _build_actions_card(self, parent):
        card = self._card(parent, "  ACTIONS GLOBALES")

        for txt, color, cmd in [
            ("  Demarrer tout",    SUCCESS,   self._start_all),
            ("  Arreter tout",     DANGER,    self._stop_all),
            ("  Redemarrer tout", WARNING,   self._restart_all),
        ]:
            Btn(card, txt, color, cmd=cmd, fill_x=True)

        tk.Frame(card, bg=BORDER, height=1).pack(fill="x", pady=5)

        Btn(card, "  Tester les services",   "#2a4e8a",
            cmd=self._run_tests, fill_x=True)
        Btn(card, "  Actualiser statut",     BG_BTN, fg=TEXT_GRY,
            bold=False, cmd=self._refresh_status, fill_x=True)
        Btn(card, "  Logs backend (50 dern.)", BG_BTN, fg=TEXT_GRY,
            bold=False, cmd=self._tail_logs, fill_x=True)

    # ── Frontend card ─────────────────────────────────────────────────────────
    def _build_frontend_card(self, parent):
        card = self._card(parent, "  FRONTEND (Vite / React)")

        Btn(card, "  Build production (dist/)", "#1a4a70",
            cmd=self._build_frontend, fill_x=True)
        Btn(card, "  Dev mode  (port 5173)",    "#1a4a35",
            cmd=self._start_frontend_dev, fill_x=True)
        Btn(card, "  Arreter dev server",        "#5c1a1a",
            cmd=self._stop_frontend_dev, fill_x=True)

        row = tk.Frame(card, bg=BG_CARD)
        row.pack(fill="x", pady=(5, 0))
        dot = StatusDot(row)
        dot.pack(side="left", padx=(0, 7))
        self._dots["Frontend-Dev"] = dot
        tk.Label(row, text="Dev server  :5173",
                 font=(FONT, 8), fg=TEXT_GRY, bg=BG_CARD).pack(side="left")

    # ── Quick links ───────────────────────────────────────────────────────────
    def _build_links_card(self, parent):
        card = self._card(parent, "  ACCES RAPIDE")
        links = [
            ("  Application EMS (prod)",  "http://localhost"),
            ("  API Documentation",       "http://localhost:8000/docs"),
            ("  Administration RH",       "http://localhost/rh/administration"),
            ("  Dev Frontend :5173",      "http://localhost:5173"),
        ]
        for txt, url in links:
            tk.Button(card, text=txt,
                      font=(FONT, 9), bg=BG_CARD, fg="#4d9de0",
                      bd=0, pady=2, cursor="hand2", anchor="w",
                      activeforeground=TEXT_WHT, activebackground=BG_CARD,
                      command=lambda u=url: webbrowser.open(u)
                      ).pack(anchor="w")

    # ── Log panel ─────────────────────────────────────────────────────────────
    def _build_log_panel(self, parent):
        outer = tk.Frame(parent, bg=BORDER, padx=1, pady=1)
        outer.pack(fill="both", expand=True)
        inner = tk.Frame(outer, bg=BG_CARD, padx=8, pady=8)
        inner.pack(fill="both", expand=True)

        bar = tk.Frame(inner, bg=BG_CARD)
        bar.pack(fill="x", pady=(0, 6))
        tk.Label(bar, text="  JOURNAL EN TEMPS REEL",
                 font=(FONT, 9, "bold"), fg=ACCENT_RED,
                 bg=BG_CARD).pack(side="left")
        Btn(bar, "Effacer", BG_DARK, fg=TEXT_GRY, bold=False,
            cmd=self._clear_log, pady=2).pack(side="right")
        logs_dir = os.path.dirname(LOG_STDOUT)
        Btn(bar, "Ouvrir dossier logs", BG_DARK, fg=TEXT_GRY, bold=False,
            cmd=lambda: os.startfile(logs_dir) if os.path.isdir(logs_dir) else None,
            pady=2).pack(side="right", padx=4)

        self._log = scrolledtext.ScrolledText(
            inner, bg="#060f1c", fg="#a8d4ff",
            font=("Consolas", 9), insertbackground=TEXT_WHT,
            wrap=tk.WORD, bd=0, relief="flat", state="disabled"
        )
        self._log.pack(fill="both", expand=True)

        for tag, fg_col, bold in [
            ("ok",   SUCCESS,    False),
            ("err",  DANGER,     False),
            ("warn", WARNING,    False),
            ("info", "#a8d4ff",  False),
            ("cmd",  "#f0c050",  True),
            ("hdr",  ACCENT_RED, True),
            ("ts",   "#334455",  False),
        ]:
            kw = {"foreground": fg_col}
            if bold:
                kw["font"] = ("Consolas", 9, "bold")
            self._log.tag_config(tag, **kw)

    # ── Footer ────────────────────────────────────────────────────────────────
    def _build_footer(self):
        foot = tk.Frame(self, bg=BG_HEADER, padx=14, pady=4)
        foot.pack(fill="x")
        tk.Frame(foot, bg=BORDER, height=1).pack(fill="x", pady=(0, 3))
        self._status_lbl = tk.Label(foot, text="Pret",
                                     font=(FONT, 8), fg=TEXT_GRY,
                                     bg=BG_HEADER)
        self._status_lbl.pack(side="left")
        tk.Label(foot, text="EMS Launcher v2.0  -  Natif (sans Docker)  |  " + EMS_ROOT,
                 font=(FONT, 8), fg=TEXT_GRY, bg=BG_HEADER).pack(side="right")

    # ═══════════════════════════════ LOGGING ═══════════════════════════════════
    def log(self, msg: str, tag: str = "info"):
        def _do():
            with self._log_lock:
                self._log.configure(state="normal")
                ts = datetime.now().strftime("%H:%M:%S")
                self._log.insert("end", f"[{ts}] ", "ts")
                self._log.insert("end", msg + "\n", tag)
                self._log.see("end")
                self._log.configure(state="disabled")
        self.after(0, _do)

    def _clear_log(self):
        self._log.configure(state="normal")
        self._log.delete("1.0", "end")
        self._log.configure(state="disabled")

    def _set_status(self, msg: str):
        self.after(0, lambda: self._status_lbl.configure(text=msg))

    # ═══════════════════════════ SERVICE CONTROL ═══════════════════════════════
    def _svc_cmd(self, svc: str, action: str, label: str):
        self.log(f"[{label}]  sc {action} {svc}", "cmd")
        threading.Thread(target=self._do_svc,
                         args=(svc, action, label), daemon=True).start()

    def _do_svc(self, svc: str, action: str, label: str):
        self._set_status(f"{action} {svc}...")
        try:
            if is_admin():
                r = subprocess.run(
                    ["sc", action, svc],
                    capture_output=True, text=True, timeout=30,
                    creationflags=subprocess.CREATE_NO_WINDOW
                )
                out = (r.stdout + r.stderr).strip()
                tag = "ok" if r.returncode == 0 else "warn"
                self.log(f"  {label}: {out or 'OK'}", tag)
            else:
                ps = f"sc {action} {svc}"
                run_as_admin(ps)
                self.log(f"  {label}: commande envoyee (fenetre admin ouverte)", "warn")
                time.sleep(3)
        except Exception as e:
            self.log(f"  Erreur {label}: {e}", "err")
        finally:
            time.sleep(2)
            self._check_all()
            self._set_status("Pret")

    def _start_all(self):
        self.log("=" * 48, "hdr")
        self.log("  DEMARRAGE DE TOUS LES SERVICES", "hdr")
        self.log("=" * 48, "hdr")
        threading.Thread(target=self._seq,
                         args=(STARTUP_ORDER, "start"), daemon=True).start()

    def _stop_all(self):
        self.log("=" * 48, "hdr")
        self.log("  ARRET DE TOUS LES SERVICES", "hdr")
        self.log("=" * 48, "hdr")
        threading.Thread(target=self._seq,
                         args=(SHUTDOWN_ORDER, "stop"), daemon=True).start()

    def _restart_all(self):
        self.log("=" * 48, "hdr")
        self.log("  REDEMARRAGE DE TOUS LES SERVICES", "hdr")
        self.log("=" * 48, "hdr")
        def _do():
            self._seq(SHUTDOWN_ORDER, "stop")
            time.sleep(2)
            self._seq(STARTUP_ORDER, "start")
        threading.Thread(target=_do, daemon=True).start()

    def _seq(self, order: list, action: str):
        for label in order:
            svc = WIN_SERVICES[label]
            self._do_svc(svc, action, label)
            time.sleep(1)
        self.log("Sequence terminee.", "ok")

    # ═══════════════════════════════ FRONTEND ══════════════════════════════════
    def _build_frontend(self):
        self.log("=" * 48, "hdr")
        self.log("  BUILD FRONTEND  (npm run build)", "hdr")
        self.log("=" * 48, "hdr")
        threading.Thread(target=self._do_build, daemon=True).start()

    def _do_build(self):
        self._set_status("Build frontend...")
        try:
            proc = subprocess.Popen(
                [NPM_CMD, "run", "build"],
                cwd=FRONTEND_DIR,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace",
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            for line in proc.stdout:
                line = line.rstrip()
                if not line:
                    continue
                lo = line.lower()
                if any(w in lo for w in ["error", "err!"]):
                    self.log(f"  {line}", "err")
                elif "warn" in lo:
                    self.log(f"  {line}", "warn")
                elif any(w in lo for w in ["built", "dist", "done", "chunk"]):
                    self.log(f"  {line}", "ok")
                else:
                    self.log(f"  {line}", "info")
            proc.wait()
            if proc.returncode == 0:
                self.log("Build reussi ! Redemarrez Nginx pour appliquer.", "ok")
            else:
                self.log(f"Build echoue (code {proc.returncode})", "err")
        except FileNotFoundError:
            self.log("npm introuvable. Node.js installe ?", "err")
        except Exception as e:
            self.log(f"Erreur: {e}", "err")
        finally:
            self._set_status("Pret")

    def _start_frontend_dev(self):
        if self._front_proc and self._front_proc.poll() is None:
            self.log(f"Dev server deja en cours (PID {self._front_proc.pid})", "warn")
            return
        self.log("=" * 48, "hdr")
        self.log("  DEV SERVER  (npm run dev --host)", "hdr")
        self.log("=" * 48, "hdr")
        threading.Thread(target=self._do_dev, daemon=True).start()

    def _do_dev(self):
        self._set_status("Demarrage dev server...")
        try:
            self._front_proc = subprocess.Popen(
                [NPM_CMD, "run", "dev", "--", "--host"],
                cwd=FRONTEND_DIR,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace",
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            self.after(0, lambda: self._dots["Frontend-Dev"].set("Running"))
            for line in self._front_proc.stdout:
                line = line.rstrip()
                if not line:
                    continue
                lo = line.lower()
                if "error" in lo:
                    self.log(f"  {line}", "err")
                elif any(w in lo for w in ["ready", "localhost", "network", "local:"]):
                    self.log(f"  {line}", "ok")
                else:
                    self.log(f"  {line}", "info")
            self._front_proc.wait()
            self.log("Dev server arrete.", "warn")
            self.after(0, lambda: self._dots["Frontend-Dev"].set("Stopped"))
        except FileNotFoundError:
            self.log("npm introuvable.", "err")
        except Exception as e:
            self.log(f"Erreur dev: {e}", "err")
        finally:
            self._set_status("Pret")

    def _stop_frontend_dev(self):
        if self._front_proc and self._front_proc.poll() is None:
            self._front_proc.terminate()
            self.log("Dev server arrete.", "warn")
            self._dots["Frontend-Dev"].set("Stopped")
        else:
            self.log("Aucun dev server en cours.", "info")

    # ═══════════════════════════════ TESTS ═════════════════════════════════════
    def _run_tests(self):
        self.log("=" * 48, "hdr")
        self.log("  TESTS DES SERVICES NATIFS", "hdr")
        self.log("=" * 48, "hdr")
        threading.Thread(target=self._do_tests, daemon=True).start()

    def _do_tests(self):
        checks = [
            ("MySQL",      3306, None,                      "MySQL8"),
            ("Backend",    8000, "http://localhost:8000/docs", "EMS-Backend"),
            ("Nginx",      80,   "http://localhost",        "EMS-Nginx"),
            ("Dev server", 5173, "http://localhost:5173",   None),
        ]
        all_ok = True
        for name, port, url, svc in checks:
            up = check_port(port, 3)
            tag = "ok" if up else "err"
            self.log(f"  [{'OK' if up else 'KO'}]  {name:<12} :{port}", tag)
            if not up:
                all_ok = False
            if url and up:
                try:
                    req = urllib.request.Request(
                        url, headers={"User-Agent": "EMS-Launcher/2.0"})
                    with urllib.request.urlopen(req, timeout=4) as r:
                        self.log(f"       HTTP {r.status}  {url}", "ok")
                except Exception as e:
                    self.log(f"       HTTP ERR  {url}  ({e})", "warn")
            if svc:
                st = svc_status(svc)
                self.log(f"       Service {svc}: {st}",
                         "ok" if st == "Running" else "warn")

        self.log("=" * 48, "hdr")
        msg = "Tous les services sont actifs" if all_ok else "Certains services sont inactifs"
        self.log(msg, "ok" if all_ok else "warn")
        self._set_status(msg)

    # ═══════════════════════════════ LOGS ══════════════════════════════════════
    def _tail_logs(self):
        self.log("=" * 48, "hdr")
        self.log("  LOGS BACKEND (50 dernieres lignes)", "hdr")
        self.log("=" * 48, "hdr")
        threading.Thread(target=self._do_tail, daemon=True).start()

    def _do_tail(self):
        for log_file in [LOG_STDOUT, LOG_STDERR]:
            if not os.path.exists(log_file):
                self.log(f"  Fichier absent: {log_file}", "warn")
                continue
            lbl = "STDOUT" if "stdout" in log_file else "STDERR"
            self.log(f"--- {lbl} ---", "cmd")
            try:
                with open(log_file, "r", encoding="utf-8", errors="replace") as f:
                    lines = f.readlines()
                for line in lines[-50:]:
                    line = line.rstrip()
                    if not line:
                        continue
                    lo = line.lower()
                    if any(w in lo for w in ["error", "exception", "traceback"]):
                        self.log(f"  {line}", "err")
                    elif "warn" in lo:
                        self.log(f"  {line}", "warn")
                    else:
                        self.log(f"  {line}", "info")
            except Exception as e:
                self.log(f"  Erreur lecture: {e}", "err")

    # ═══════════════════════════ STATUS MONITOR ═════════════════════════════════
    def _refresh_status(self):
        threading.Thread(target=self._check_all, daemon=True).start()

    def _check_all(self):
        for label, svc in WIN_SERVICES.items():
            st = svc_status(svc)
            self.after(0, lambda lb=label, s=st: self._dots[lb].set(s))
        dev = "Running" if check_port(5173, 1.5) else "Stopped"
        self.after(0, lambda s=dev: self._dots["Frontend-Dev"].set(s))

    # ═══════════════════════════════ INIT ══════════════════════════════════════
    def _post_init(self):
        self.log("=" * 48, "hdr")
        self.log("  EMS SERVER LAUNCHER  v2.0  (natif)", "hdr")
        self.log("=" * 48, "hdr")
        self.log(f"Repertoire EMS : {EMS_ROOT}", "info")
        self.log(f"Python venv    : {VENV_PYTHON}", "info")
        self.log(f"Date/Heure     : {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}", "info")
        self.log(f"Admin          : {'OUI' if is_admin() else 'NON (controle limite)'}", 
                 "ok" if is_admin() else "warn")
        if not is_admin():
            self.log("TIP: Relancez en tant qu'Administrateur pour controle complet.", "warn")
        self.log("-" * 48, "info")
        self._refresh_status()

        def _monitor():
            while self._alive:
                time.sleep(15)
                if self._alive:
                    self._check_all()
        threading.Thread(target=_monitor, daemon=True).start()

    def destroy(self):
        self._alive = False
        if self._front_proc and self._front_proc.poll() is None:
            self._front_proc.terminate()
        super().destroy()


if __name__ == "__main__":
    app = EMSLauncher()
    app.mainloop()

using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace MapsScraperLauncher
{
    public class MainForm : Form
    {
        private Process serverProcess;
        private Label statusLabel;
        private Button openBrowserBtn;
        private Button openFolderBtn;
        private Button exitBtn;
        private string appDir;
        private int port = 3005;

        public MainForm()
        {
            appDir = AppDomain.CurrentDomain.BaseDirectory;
            InitializeUI();
            this.Shown += OnFormShown;
            this.FormClosing += OnFormClosing;
        }

        private void InitializeUI()
        {
            this.Text = "Maps Scraper & WhatsApp — Control Local";
            this.Size = new Size(420, 235);
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(11, 15, 25);
            this.ForeColor = Color.White;

            string icoPath = Path.Combine(appDir, "app.ico");
            if (File.Exists(icoPath))
            {
                try { this.Icon = new Icon(icoPath); } catch { }
            }

            Label titleLabel = new Label();
            titleLabel.Text = "MAPS SCRAPER & WHATSAPP OUTREACH";
            titleLabel.Font = new Font("Segoe UI", 11, FontStyle.Bold);
            titleLabel.ForeColor = Color.FromArgb(129, 140, 248);
            titleLabel.Location = new Point(20, 18);
            titleLabel.Size = new Size(370, 24);
            this.Controls.Add(titleLabel);

            statusLabel = new Label();
            statusLabel.Text = "Iniciando servidor local en puerto 3005...";
            statusLabel.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            statusLabel.ForeColor = Color.FromArgb(52, 211, 153);
            statusLabel.Location = new Point(20, 46);
            statusLabel.Size = new Size(370, 22);
            this.Controls.Add(statusLabel);

            openBrowserBtn = new Button();
            openBrowserBtn.Text = "🚀 Abrir Panel de Maps Scraper & WhatsApp";
            openBrowserBtn.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            openBrowserBtn.BackColor = Color.FromArgb(79, 70, 229);
            openBrowserBtn.ForeColor = Color.White;
            openBrowserBtn.FlatStyle = FlatStyle.Flat;
            openBrowserBtn.FlatAppearance.BorderSize = 0;
            openBrowserBtn.Location = new Point(20, 80);
            openBrowserBtn.Size = new Size(365, 40);
            openBrowserBtn.Cursor = Cursors.Hand;
            openBrowserBtn.Click += (s, e) => OpenAppWindow();
            this.Controls.Add(openBrowserBtn);

            openFolderBtn = new Button();
            openFolderBtn.Text = "📂 Carpeta de Excels";
            openFolderBtn.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            openFolderBtn.BackColor = Color.FromArgb(30, 41, 59);
            openFolderBtn.ForeColor = Color.White;
            openFolderBtn.FlatStyle = FlatStyle.Flat;
            openFolderBtn.FlatAppearance.BorderSize = 0;
            openFolderBtn.Location = new Point(20, 132);
            openFolderBtn.Size = new Size(176, 36);
            openFolderBtn.Cursor = Cursors.Hand;
            openFolderBtn.Click += (s, e) =>
            {
                string tempDir = Path.Combine(appDir, "temp");
                if (!Directory.Exists(tempDir)) Directory.CreateDirectory(tempDir);
                Process.Start("explorer.exe", tempDir);
            };
            this.Controls.Add(openFolderBtn);

            exitBtn = new Button();
            exitBtn.Text = "⏹ Apagar Servidor";
            exitBtn.Font = new Font("Segoe UI", 9, FontStyle.Bold);
            exitBtn.BackColor = Color.FromArgb(190, 18, 60);
            exitBtn.ForeColor = Color.White;
            exitBtn.FlatStyle = FlatStyle.Flat;
            exitBtn.FlatAppearance.BorderSize = 0;
            exitBtn.Location = new Point(209, 132);
            exitBtn.Size = new Size(176, 36);
            exitBtn.Cursor = Cursors.Hand;
            exitBtn.Click += (s, e) => this.Close();
            this.Controls.Add(exitBtn);
        }

        private void OnFormShown(object sender, EventArgs e)
        {
            ThreadPool.QueueUserWorkItem(_ => StartBackendAndOpen());
        }

        private bool IsPortOpen(int checkPort)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    var result = client.BeginConnect("127.0.0.1", checkPort, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(350));
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        private void StartBackendAndOpen()
        {
            string nodeModulesPath = Path.Combine(appDir, "node_modules");
            string distIndexPath = Path.Combine(appDir, "frontend", "dist", "index.html");

            if (!Directory.Exists(nodeModulesPath) || !File.Exists(distIndexPath))
            {
                UpdateStatus("Ejecutando instalación inicial por única vez...");
                string installerBat = Path.Combine(appDir, "Instalador_Primera_Vez.bat");
                if (File.Exists(installerBat))
                {
                    ProcessStartInfo psiInstall = new ProcessStartInfo("cmd.exe", "/c \"" + installerBat + "\"")
                    {
                        WorkingDirectory = appDir,
                        UseShellExecute = true
                    };
                    var p = Process.Start(psiInstall);
                    if (p != null) p.WaitForExit();
                }
            }

            if (!IsPortOpen(port))
            {
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo("node", "server.js")
                    {
                        WorkingDirectory = appDir,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    serverProcess = Process.Start(psi);
                }
                catch (Exception ex)
                {
                    UpdateStatus("Error iniciando Node.js: " + ex.Message);
                    MessageBox.Show(
                        "No se pudo iniciar Node.js. Asegúrate de tener Node.js instalado en esta PC (https://nodejs.org).",
                        "Node.js Requerido",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning
                    );
                    return;
                }

                for (int i = 0; i < 20; i++)
                {
                    if (IsPortOpen(port)) break;
                    Thread.Sleep(300);
                }
            }

            UpdateStatus("🟢 Servidor Local Activo en http://localhost:" + port);
            OpenAppWindow();
        }

        private void UpdateStatus(string text)
        {
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action(() => statusLabel.Text = text));
            }
            else
            {
                statusLabel.Text = text;
            }
        }

        private void OpenAppWindow()
        {
            string url = "http://localhost:" + port;
            try
            {
                // Try opening in native standalone App Window mode via Edge or Chrome
                string[] appBrowsers = new string[]
                {
                    @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                    @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                    @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
                };

                foreach (string browserPath in appBrowsers)
                {
                    if (File.Exists(browserPath))
                    {
                        Process.Start(browserPath, "--app=" + url + " --window-size=1360,860");
                        return;
                    }
                }

                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch
            {
                try { Process.Start("explorer.exe", url); } catch { }
            }
        }

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                    serverProcess.Dispose();
                }
            }
            catch { }
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}

using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace MapsScraperLauncher
{
    public class MainForm : Form
    {
        private Process serverProcess;
        private string appDir;
        private int port = 3005;

        // UI & Animation State
        private System.Windows.Forms.Timer animTimer;
        private string fontFamilyName = "Segoe UI";
        private bool isAppReady = false;
        private bool hasError = false;
        private string loadingStepText = "Preparando entorno local...";
        private string loadingSubText = "La aplicación se abrirá sola al terminar de cargar";
        private float targetProgress = 0.08f;
        private float displayProgress = 0.02f;
        private float animTick = 0f;
        private float readyReveal = 0f; // 0 -> 1 cubic-bezier transition once first open finishes

        // Interactive Hit Rectangles
        private Rectangle rectOpenAppBtn;
        private Rectangle rectExcelsBtn;
        private Rectangle rectExitBtn;

        // Smooth Hover & Press states (0..1)
        private int hoveredBtn = 0; // 0 = none, 1 = openApp, 2 = excels, 3 = exit
        private int pressedBtn = 0;
        private float hoverOpenApp = 0f;
        private float hoverExcels = 0f;
        private float hoverExit = 0f;

        // Design Tokens (matching the Web App JSON spec)
        private static readonly Color ColBgBase = Color.FromArgb(253, 253, 255);        // #fdfdff
        private static readonly Color ColTextPrimary = Color.FromArgb(31, 31, 31);      // #1f1f1f
        private static readonly Color ColTextSecondary = Color.FromArgb(95, 99, 104);   // #5f6368
        private static readonly Color ColTextChip = Color.FromArgb(60, 64, 67);         // #3c4043
        private static readonly Color ColBorder = Color.FromArgb(218, 220, 224);        // #dadce0
        private static readonly Color ColBorderSoft = Color.FromArgb(232, 234, 237);    // #e8eaed
        private static readonly Color ColPrimary = Color.FromArgb(26, 115, 232);        // #1a73e8
        private static readonly Color ColPrimaryHover = Color.FromArgb(23, 101, 204);   // #1765cc
        private static readonly Color ColTonal = Color.FromArgb(232, 240, 254);         // #e8f0fe
        private static readonly Color ColTonalHover = Color.FromArgb(210, 227, 252);    // #d2e3fc
        private static readonly Color ColOnTonal = Color.FromArgb(23, 78, 166);         // #174ea6
        private static readonly Color ColSuccess = Color.FromArgb(30, 142, 62);         // #1e8e3e
        private static readonly Color ColSuccessBg = Color.FromArgb(230, 244, 234);     // #e6f4ea
        private static readonly Color ColDangerText = Color.FromArgb(197, 34, 31);      // #c5221f
        private static readonly Color ColDangerBg = Color.FromArgb(252, 232, 230);      // #fce8e6
        private static readonly Color ColDangerHover = Color.FromArgb(217, 48, 37);     // #d93025

        // Google 4 colors
        private static readonly Color GBlue = Color.FromArgb(66, 133, 244);             // #4285f4
        private static readonly Color GRed = Color.FromArgb(234, 67, 53);               // #ea4335
        private static readonly Color GYellow = Color.FromArgb(251, 188, 4);            // #fbbc04
        private static readonly Color GGreen = Color.FromArgb(52, 168, 83);             // #34a853

        public MainForm()
        {
            appDir = AppDomain.CurrentDomain.BaseDirectory;
            DetectPreferredFont();
            InitializeUI();

            this.Shown += OnFormShown;
            this.FormClosing += OnFormClosing;
            this.MouseMove += OnFormMouseMove;
            this.MouseDown += OnFormMouseDown;
            this.MouseUp += OnFormMouseUp;
            this.MouseLeave += (s, e) => { hoveredBtn = 0; };
        }

        private void DetectPreferredFont()
        {
            try
            {
                using (FontFamily ff = new FontFamily("Outfit"))
                {
                    fontFamilyName = "Outfit";
                }
            }
            catch
            {
                fontFamilyName = "Segoe UI";
            }
        }

        private void InitializeUI()
        {
            this.SetStyle(
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.UserPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.ResizeRedraw,
                true
            );

            this.Text = "Maps Scraper & WhatsApp — Control Local";
            this.ClientSize = new Size(460, 280);
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = ColBgBase;

            string icoPath = Path.Combine(appDir, "app.ico");
            if (File.Exists(icoPath))
            {
                try { this.Icon = new Icon(icoPath); } catch { }
            }

            UpdateLayoutRects();

            animTimer = new System.Windows.Forms.Timer();
            animTimer.Interval = 16; // ~60 FPS
            animTimer.Tick += OnAnimationTick;
            animTimer.Start();
        }

        private void UpdateLayoutRects()
        {
            int padX = 28;
            int contentW = this.ClientSize.Width - (padX * 2);

            // Main action button (only active/visible once isAppReady == true)
            rectOpenAppBtn = new Rectangle(padX, 128, contentW, 54);

            // Bottom row buttons ("Carpeta de Excels" & "Apagar Servidor")
            int gap = 12;
            int halfW = (contentW - gap) / 2;
            rectExcelsBtn = new Rectangle(padX, 206, halfW, 44);
            rectExitBtn = new Rectangle(padX + halfW + gap, 206, halfW, 44);
        }

        private void OnAnimationTick(object sender, EventArgs e)
        {
            animTick += 0.045f;

            // Smooth progress bar interpolation
            displayProgress += (targetProgress - displayProgress) * 0.12f;

            // Smooth reveal of the "Entrar a la App" button after first auto-open
            if (isAppReady && readyReveal < 1f)
            {
                readyReveal = Math.Min(1f, readyReveal + 0.055f);
            }

            // Smooth hover states (lerp)
            hoverOpenApp = Lerp(hoverOpenApp, (isAppReady && hoveredBtn == 1) ? 1f : 0f, 0.22f);
            hoverExcels = Lerp(hoverExcels, (hoveredBtn == 2) ? 1f : 0f, 0.22f);
            hoverExit = Lerp(hoverExit, (hoveredBtn == 3) ? 1f : 0f, 0.22f);

            this.Invalidate();
        }

        private float Lerp(float a, float b, float t)
        {
            return a + (b - a) * t;
        }

        private float EaseOutCubic(float x)
        {
            float inv = 1f - x;
            return 1f - (inv * inv * inv);
        }

        private void OnFormMouseMove(object sender, MouseEventArgs e)
        {
            int newHover = 0;
            if (isAppReady && readyReveal > 0.4f && rectOpenAppBtn.Contains(e.Location))
                newHover = 1;
            else if (rectExcelsBtn.Contains(e.Location))
                newHover = 2;
            else if (rectExitBtn.Contains(e.Location))
                newHover = 3;

            if (newHover != hoveredBtn)
            {
                hoveredBtn = newHover;
                this.Cursor = (hoveredBtn != 0) ? Cursors.Hand : Cursors.Default;
            }
        }

        private void OnFormMouseDown(object sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            pressedBtn = hoveredBtn;
        }

        private void OnFormMouseUp(object sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            int clicked = pressedBtn;
            pressedBtn = 0;

            if (clicked != 0 && clicked == hoveredBtn)
            {
                if (clicked == 1 && isAppReady)
                {
                    OpenAppWindow();
                }
                else if (clicked == 2)
                {
                    OpenExcelsFolder();
                }
                else if (clicked == 3)
                {
                    this.Close();
                }
            }
        }

        private void OpenExcelsFolder()
        {
            try
            {
                string excelsDir = Path.Combine(appDir, "excels");
                if (!Directory.Exists(excelsDir)) Directory.CreateDirectory(excelsDir);
                Process.Start("explorer.exe", excelsDir);
            }
            catch { }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            int w = this.ClientSize.Width;
            int h = this.ClientSize.Height;
            if (w <= 0 || h <= 0) return;

            // 1. Pearlescent Background (matching web app radial gradients)
            g.Clear(ColBgBase);
            DrawPearlescentGlow(g, -60, -50, 320, 240, Color.FromArgb(68, 190, 215, 255));          // Celeste top-left
            DrawPearlescentGlow(g, w - 240, -40, 280, 220, Color.FromArgb(58, 232, 205, 255));      // Lila top-right
            DrawPearlescentGlow(g, w - 260, h - 170, 300, 220, Color.FromArgb(64, 255, 224, 214));  // Durazno bottom-right
            DrawPearlescentGlow(g, -50, h - 160, 270, 210, Color.FromArgb(58, 198, 244, 230));      // Menta bottom-left

            // 2. Top Status Bar (Left: pulsing dot + "App local", Right: status pill)
            DrawTopBar(g, w);

            // 3. Title Header
            using (Font titleFont = new Font(fontFamilyName, 15.5f, FontStyle.Regular))
            using (Brush titleBrush = new SolidBrush(ColTextPrimary))
            {
                StringFormat sf = new StringFormat { Alignment = StringAlignment.Center };
                g.DrawString("Maps Scraper & WhatsApp", titleFont, titleBrush, new RectangleF(0, 54, w, 30), sf);
            }

            using (Font subFont = new Font(fontFamilyName, 9.2f, FontStyle.Regular))
            using (Brush subBrush = new SolidBrush(ColTextSecondary))
            {
                StringFormat sf = new StringFormat { Alignment = StringAlignment.Center };
                string subText = isAppReady
                    ? "Servidor local sincronizado · Listo para usar"
                    : "Iniciando servicios locales automáticamente...";
                g.DrawString(subText, subFont, subBrush, new RectangleF(0, 84, w, 20), sf);
            }

            // 4. Center Dynamic Section:
            //    - While loading: shows ONLY the animated loading card (no button to enter yet)
            //    - Once first auto-open completes: smoothly reveals the "Entrar a la App" pill button
            if (!isAppReady || readyReveal < 1f)
            {
                float loadAlpha = 1f - EaseOutCubic(readyReveal);
                if (loadAlpha > 0.01f)
                {
                    DrawLoadingCard(g, rectOpenAppBtn, loadAlpha);
                }
            }

            if (isAppReady && readyReveal > 0.01f)
            {
                float btnAlpha = EaseOutCubic(readyReveal);
                DrawOpenAppButton(g, rectOpenAppBtn, btnAlpha);
            }

            // 5. Bottom Control Buttons ("Carpeta de Excels" & "Apagar Servidor")
            DrawSecondaryPillButton(
                g,
                rectExcelsBtn,
                "Carpeta de Excels",
                hoverExcels,
                pressedBtn == 2,
                false
            );

            DrawSecondaryPillButton(
                g,
                rectExitBtn,
                "Apagar Servidor",
                hoverExit,
                pressedBtn == 3,
                true
            );
        }

        private void DrawPearlescentGlow(Graphics g, int x, int y, int width, int height, Color centerColor)
        {
            using (GraphicsPath path = new GraphicsPath())
            {
                path.AddEllipse(x, y, width, height);
                using (PathGradientBrush pgb = new PathGradientBrush(path))
                {
                    pgb.CenterColor = centerColor;
                    pgb.SurroundColors = new Color[] { Color.FromArgb(0, centerColor.R, centerColor.G, centerColor.B) };
                    g.FillPath(pgb, path);
                }
            }
        }

        private void DrawTopBar(Graphics g, int w)
        {
            int dotX = 30;
            int dotY = 22;

            // Pulsing halo + dot
            Color dotColor = hasError ? GRed : (isAppReady ? ColSuccess : ColPrimary);
            float pulse = (float)(Math.Sin(animTick * 2.2f) * 0.5 + 0.5);
            int haloSize = (int)(8 + pulse * 8);
            int haloAlpha = (int)((1f - pulse) * 75);

            using (Brush haloBrush = new SolidBrush(Color.FromArgb(haloAlpha, dotColor)))
            {
                g.FillEllipse(haloBrush, dotX - (haloSize - 8) / 2, dotY - (haloSize - 8) / 2, haloSize, haloSize);
            }
            using (Brush dotBrush = new SolidBrush(dotColor))
            {
                g.FillEllipse(dotBrush, dotX, dotY, 8, 8);
            }

            using (Font f = new Font(fontFamilyName, 8.8f, FontStyle.Regular))
            using (Brush b = new SolidBrush(ColTextSecondary))
            {
                g.DrawString("App local", f, b, dotX + 14, dotY - 4);
            }

            // Right pill badge ("Puerto 3005" or "Activo · 3005")
            string badgeText = isAppReady ? "Activo · Puerto " + port : "Puerto " + port;
            Color badgeBg = isAppReady ? ColSuccessBg : ColTonal;
            Color badgeFg = isAppReady ? ColSuccess : ColOnTonal;

            using (Font bf = new Font(fontFamilyName, 8.2f, FontStyle.Bold))
            {
                SizeF sz = g.MeasureString(badgeText, bf);
                int bw = (int)sz.Width + 20;
                int bh = 24;
                Rectangle badgeRect = new Rectangle(w - 28 - bw, 14, bw, bh);

                using (GraphicsPath bp = CreateRoundedRect(badgeRect, bh))
                using (Brush bb = new SolidBrush(badgeBg))
                {
                    g.FillPath(bb, bp);
                }

                StringFormat sf = new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                };
                using (Brush fb = new SolidBrush(badgeFg))
                {
                    g.DrawString(badgeText, bf, fb, badgeRect, sf);
                }
            }
        }

        private void DrawLoadingCard(Graphics g, Rectangle baseRect, float alpha)
        {
            int a255 = (int)(Math.Max(0f, Math.Min(1f, alpha)) * 255);
            int offsetY = (int)((1f - alpha) * -8f);
            Rectangle cardRect = new Rectangle(baseRect.X, baseRect.Y - 6 + offsetY, baseRect.Width, baseRect.Height + 10);

            // Subtle drop shadow
            Rectangle shadowRect = new Rectangle(cardRect.X + 1, cardRect.Y + 4, cardRect.Width - 2, cardRect.Height);
            using (GraphicsPath sp = CreateRoundedRect(shadowRect, 24))
            using (Brush sb = new SolidBrush(Color.FromArgb((int)(18 * alpha), 32, 33, 36)))
            {
                g.FillPath(sb, sp);
            }

            // White pill-card surface
            using (GraphicsPath cp = CreateRoundedRect(cardRect, 24))
            {
                using (Brush cb = new SolidBrush(Color.FromArgb(a255, 255, 255, 255)))
                {
                    g.FillPath(cb, cp);
                }

                // Soft border
                using (Pen borderPen = new Pen(Color.FromArgb((int)(220 * alpha), ColBorder), 1.2f))
                {
                    g.DrawPath(borderPen, cp);
                }
            }

            // 4-Color Google Spinning Ring on the left
            int spinSize = 26;
            int spinX = cardRect.X + 20;
            int spinY = cardRect.Y + (cardRect.Height - spinSize) / 2 - 2;
            Rectangle spinRect = new Rectangle(spinX, spinY, spinSize, spinSize);
            float baseAngle = (animTick * 150f) % 360f;

            using (Pen pBlue = new Pen(Color.FromArgb(a255, GBlue), 2.8f))
            using (Pen pRed = new Pen(Color.FromArgb(a255, GRed), 2.8f))
            using (Pen pYellow = new Pen(Color.FromArgb(a255, GYellow), 2.8f))
            using (Pen pGreen = new Pen(Color.FromArgb(a255, GGreen), 2.8f))
            {
                pBlue.StartCap = pBlue.EndCap = LineCap.Round;
                pRed.StartCap = pRed.EndCap = LineCap.Round;
                pYellow.StartCap = pYellow.EndCap = LineCap.Round;
                pGreen.StartCap = pGreen.EndCap = LineCap.Round;

                g.DrawArc(pBlue, spinRect, baseAngle, 68f);
                g.DrawArc(pRed, spinRect, baseAngle + 90f, 68f);
                g.DrawArc(pYellow, spinRect, baseAngle + 180f, 68f);
                g.DrawArc(pGreen, spinRect, baseAngle + 270f, 68f);
            }

            // Loading step text & subtext
            int textX = spinX + spinSize + 14;
            int textW = cardRect.Right - textX - 52;

            using (Font mainF = new Font(fontFamilyName, 9.8f, FontStyle.Bold))
            using (Brush mainB = new SolidBrush(Color.FromArgb(a255, ColTextPrimary)))
            {
                g.DrawString(loadingStepText, mainF, mainB, new RectangleF(textX, cardRect.Y + 11, textW, 20));
            }

            using (Font subF = new Font(fontFamilyName, 8.2f, FontStyle.Regular))
            using (Brush subB = new SolidBrush(Color.FromArgb((int)(210 * alpha), ColTextSecondary)))
            {
                g.DrawString(loadingSubText, subF, subB, new RectangleF(textX, cardRect.Y + 31, textW + 30, 18));
            }

            // Percentage badge on right
            int pct = Math.Min(100, Math.Max(5, (int)Math.Round(displayProgress * 100)));
            using (Font pctF = new Font(fontFamilyName, 9f, FontStyle.Bold))
            using (Brush pctB = new SolidBrush(Color.FromArgb(a255, ColPrimary)))
            {
                StringFormat rsf = new StringFormat { Alignment = StringAlignment.Far };
                g.DrawString(pct + "%", pctF, pctB, new RectangleF(cardRect.Right - 58, cardRect.Y + 12, 42, 20), rsf);
            }

            // 4-Color Google Progress Bar at bottom of card
            int barMargin = 18;
            int barY = cardRect.Bottom - 9;
            int barW = cardRect.Width - (barMargin * 2);
            int barH = 4;
            Rectangle trackRect = new Rectangle(cardRect.X + barMargin, barY, barW, barH);

            using (GraphicsPath tp = CreateRoundedRect(trackRect, 4))
            using (Brush tb = new SolidBrush(Color.FromArgb((int)(200 * alpha), ColBorderSoft)))
            {
                g.FillPath(tb, tp);
            }

            int fillW = Math.Max(16, (int)(barW * Math.Min(1f, displayProgress)));
            Rectangle fillRect = new Rectangle(trackRect.X, trackRect.Y, fillW, barH);
            if (fillRect.Width > 2)
            {
                using (GraphicsPath fp = CreateRoundedRect(fillRect, 4))
                using (LinearGradientBrush lgb = new LinearGradientBrush(
                    new Point(trackRect.X, trackRect.Y),
                    new Point(trackRect.X + barW, trackRect.Y),
                    Color.FromArgb(a255, GBlue),
                    Color.FromArgb(a255, GGreen)))
                {
                    ColorBlend cb = new ColorBlend(4);
                    cb.Colors = new Color[]
                    {
                        Color.FromArgb(a255, GBlue),
                        Color.FromArgb(a255, GRed),
                        Color.FromArgb(a255, GYellow),
                        Color.FromArgb(a255, GGreen)
                    };
                    cb.Positions = new float[] { 0f, 0.35f, 0.70f, 1f };
                    lgb.InterpolationColors = cb;
                    g.FillPath(lgb, fp);
                }
            }
        }

        private void DrawOpenAppButton(Graphics g, Rectangle baseRect, float alpha)
        {
            int a255 = (int)(Math.Max(0f, Math.Min(1f, alpha)) * 255);
            int slideY = (int)((1f - alpha) * 12f);
            int hoverLift = (int)(hoverOpenApp * -2f) + (pressedBtn == 1 ? 2 : 0);

            Rectangle btnRect = new Rectangle(baseRect.X, baseRect.Y + slideY + hoverLift, baseRect.Width, baseRect.Height);

            // Soft blue glow shadow (matching tokens.sombras.buscador_foco)
            int shadowAlpha = (int)((38 + hoverOpenApp * 32) * alpha);
            Rectangle shadowRect = new Rectangle(btnRect.X + 4, btnRect.Y + 5, btnRect.Width - 8, btnRect.Height);
            using (GraphicsPath sp = CreateRoundedRect(shadowRect, btnRect.Height))
            using (Brush sb = new SolidBrush(Color.FromArgb(shadowAlpha, ColPrimary)))
            {
                g.FillPath(sb, sp);
            }

            // Button Pill Fill
            Color fillCol = BlendColor(ColPrimary, ColPrimaryHover, hoverOpenApp);
            using (GraphicsPath bp = CreateRoundedRect(btnRect, btnRect.Height))
            using (Brush bb = new SolidBrush(Color.FromArgb(a255, fillCol)))
            {
                g.FillPath(bb, bp);
            }

            // Subtle inner top highlight
            using (Font btnFont = new Font(fontFamilyName, 10.8f, FontStyle.Bold))
            using (Brush textBrush = new SolidBrush(Color.FromArgb(a255, Color.White)))
            {
                StringFormat sf = new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                };
                g.DrawString("Entrar a la App   ↗", btnFont, textBrush, btnRect, sf);
            }
        }

        private void DrawSecondaryPillButton(Graphics g, Rectangle baseRect, string text, float hoverAmt, bool isPressed, bool isDanger)
        {
            int lift = (int)(hoverAmt * -1.5f) + (isPressed ? 1 : 0);
            Rectangle r = new Rectangle(baseRect.X, baseRect.Y + lift, baseRect.Width, baseRect.Height);

            // Soft shadow
            Rectangle sr = new Rectangle(r.X + 1, r.Y + 2, r.Width - 2, r.Height);
            using (GraphicsPath sp = CreateRoundedRect(sr, r.Height))
            using (Brush sb = new SolidBrush(Color.FromArgb((int)(10 + hoverAmt * 12), 32, 33, 36)))
            {
                g.FillPath(sb, sp);
            }

            Color bgIdle = isDanger ? ColDangerBg : Color.White;
            Color bgHover = isDanger ? ColDangerHover : ColTonal;
            Color fgIdle = isDanger ? ColDangerText : ColTextChip;
            Color fgHover = isDanger ? Color.White : ColOnTonal;
            Color borderIdle = isDanger ? Color.FromArgb(245, 194, 192) : ColBorder;
            Color borderHover = isDanger ? ColDangerHover : Color.FromArgb(174, 203, 250);

            Color bg = BlendColor(bgIdle, bgHover, hoverAmt);
            Color fg = BlendColor(fgIdle, fgHover, hoverAmt);
            Color brd = BlendColor(borderIdle, borderHover, hoverAmt);

            using (GraphicsPath bp = CreateRoundedRect(r, r.Height))
            {
                using (Brush bb = new SolidBrush(bg))
                {
                    g.FillPath(bb, bp);
                }
                using (Pen p = new Pen(brd, 1.2f))
                {
                    g.DrawPath(p, bp);
                }
            }

            // Draw small icon + label centered
            using (Font f = new Font(fontFamilyName, 9.2f, FontStyle.Bold))
            using (Brush tb = new SolidBrush(fg))
            {
                StringFormat sf = new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                };
                string label = isDanger ? "⏹  " + text : "📂  " + text;
                g.DrawString(label, f, tb, r, sf);
            }
        }

        private Color BlendColor(Color c1, Color c2, float t)
        {
            t = Math.Max(0f, Math.Min(1f, t));
            int r = (int)(c1.R + (c2.R - c1.R) * t);
            int g = (int)(c1.G + (c2.G - c1.G) * t);
            int b = (int)(c1.B + (c2.B - c1.B) * t);
            return Color.FromArgb(r, g, b);
        }

        private GraphicsPath CreateRoundedRect(Rectangle bounds, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            int d = Math.Min(radius, Math.Min(bounds.Width, bounds.Height));
            if (d <= 0)
            {
                path.AddRectangle(bounds);
                return path;
            }
            Rectangle arc = new Rectangle(bounds.Location, new Size(d, d));
            path.AddArc(arc, 180, 90);
            arc.X = bounds.Right - d;
            path.AddArc(arc, 270, 90);
            arc.Y = bounds.Bottom - d;
            path.AddArc(arc, 0, 90);
            arc.X = bounds.Left;
            path.AddArc(arc, 90, 90);
            path.CloseFigure();
            return path;
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
                    bool success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(300));
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

        private void SetLoadingStep(string step, string sub, float progress)
        {
            loadingStepText = step;
            loadingSubText = sub;
            targetProgress = progress;
        }

        private void StartBackendAndOpen()
        {
            SetLoadingStep(
                "Verificando entorno y archivos locales...",
                "Comprobando módulos y compilación de la interfaz",
                0.22f
            );
            Thread.Sleep(320);

            string nodeModulesPath = Path.Combine(appDir, "node_modules");
            string distIndexPath = Path.Combine(appDir, "frontend", "dist", "index.html");

            if (!Directory.Exists(nodeModulesPath) || !File.Exists(distIndexPath))
            {
                SetLoadingStep(
                    "Instalando dependencias por única vez...",
                    "Esto puede demorar unos minutos en la primera ejecución",
                    0.38f
                );
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

            SetLoadingStep(
                "Iniciando servidor y motor de Google Maps...",
                "Levantando servicio local en http://localhost:" + port,
                0.62f
            );

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
                    hasError = true;
                    SetLoadingStep(
                        "Error al iniciar Node.js",
                        ex.Message,
                        1.0f
                    );
                    MessageBox.Show(
                        "No se pudo iniciar Node.js. Asegúrate de tener Node.js instalado en esta PC (https://nodejs.org).",
                        "Node.js Requerido",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning
                    );
                    return;
                }

                for (int i = 0; i < 25; i++)
                {
                    if (IsPortOpen(port)) break;
                    targetProgress = Math.Min(0.88f, 0.62f + (i * 0.012f));
                    Thread.Sleep(250);
                }
            }
            else
            {
                Thread.Sleep(380);
            }

            SetLoadingStep(
                "¡Todo listo! Abriendo la aplicación...",
                "Lanzando ventana principal automáticamente",
                1.0f
            );
            Thread.Sleep(420);

            // First automatic open!
            OpenAppWindow();

            // Reveal the "Entrar a la App" button now that it has opened for the first time
            Thread.Sleep(300);
            isAppReady = true;
        }

        private void OpenAppWindow()
        {
            string url = "http://localhost:" + port;
            try
            {
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
                if (animTimer != null) animTimer.Stop();
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

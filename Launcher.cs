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
        private enum ScreenState
        {
            Arrancando = 0,
            Listo = 1,
            Error = 2
        }

        private Process serverProcess;
        private string appDir;
        private int port = 3005;

        // Current State & Steps
        private ScreenState state = ScreenState.Arrancando;
        private int currentStep = 1; // 1..4 (in Arrancando, steps < currentStep are complete, currentStep is active)
        private string subtituloArrancando = "Iniciando el servidor y el motor de Maps";
        private string errorSubtitle = "Otro programa usa el puerto 3005";
        private string errorDetails = "";

        // High-precision Timing & Animations
        private System.Windows.Forms.Timer animTimer;
        private Stopwatch clock;
        private double stateChangeTime = 0.0;
        private string fontFamilyName = "Segoe UI";

        // Exact Layout Positions in 480 x 340 Client Area
        private static readonly Rectangle RectTopBar = new Rectangle(20, 16, 440, 24);
        private static readonly Rectangle RectRing = new Rectangle(204, 70, 72, 72);
        private static readonly Rectangle RectTitle = new Rectangle(0, 158, 480, 28);
        private static readonly Rectangle RectSubtitle = new Rectangle(60, 188, 360, 20);
        private static readonly Rectangle RectStepIndicator = new Rectangle(116, 248, 248, 4);
        private static readonly Rectangle RectPrimaryBtn = new Rectangle(116, 224, 248, 52);
        private static readonly Rectangle RectSecondaryLeft = new Rectangle(62, 292, 172, 36);
        private static readonly Rectangle RectSecondaryRight = new Rectangle(246, 292, 172, 36);

        // Interaction State (1 = Primary, 2 = Secondary Left, 3 = Secondary Right)
        private int hoveredBtn = 0;
        private int pressedBtn = 0;
        private int focusedBtn = 0; // Keyboard focus (Tab navigation)
        private float hoverPrimary = 0f;
        private float hoverSecLeft = 0f;
        private float hoverSecRight = 0f;
        private float pressPrimary = 0f;

        // Color Tokens (Launcher v2 exact hex values)
        private static readonly Color ColBgBase = Color.FromArgb(253, 253, 255);              // #fdfdff
        private static readonly Color ColText = Color.FromArgb(31, 31, 31);                   // #1f1f1f
        private static readonly Color ColTextSecondary = Color.FromArgb(95, 99, 104);         // #5f6368
        private static readonly Color ColTextBtnSec = Color.FromArgb(60, 64, 67);             // #3c4043
        private static readonly Color ColBorder = Color.FromArgb(218, 220, 224);              // #dadce0
        private static readonly Color ColSurface = Color.FromArgb(255, 255, 255);             // #ffffff
        private static readonly Color ColPrimary = Color.FromArgb(26, 115, 232);              // #1a73e8
        private static readonly Color ColPrimaryHover = Color.FromArgb(23, 101, 204);         // #1765cc
        private static readonly Color ColPrimaryPressed = Color.FromArgb(24, 90, 188);        // #185abc
        private static readonly Color ColTonal = Color.FromArgb(232, 240, 254);               // #e8f0fe
        private static readonly Color ColOnTonal = Color.FromArgb(23, 78, 166);               // #174ea6
        private static readonly Color ColSuccess = Color.FromArgb(30, 142, 62);               // #1e8e3e
        private static readonly Color ColSuccessPillText = Color.FromArgb(19, 115, 51);       // #137333
        private static readonly Color ColSuccessBg = Color.FromArgb(230, 244, 234);           // #e6f4ea
        private static readonly Color ColDangerBg = Color.FromArgb(252, 232, 230);            // #fce8e6
        private static readonly Color ColDangerText = Color.FromArgb(197, 34, 31);            // #c5221f
        private static readonly Color ColDangerSolid = Color.FromArgb(217, 48, 37);           // #d93025
        private static readonly Color ColProgressTrack = Color.FromArgb(232, 234, 237);       // #e8eaed

        // Google 4 Colors
        private static readonly Color GBlue = Color.FromArgb(66, 133, 244);                   // #4285f4
        private static readonly Color GRed = Color.FromArgb(234, 67, 53);                     // #ea4335
        private static readonly Color GYellow = Color.FromArgb(251, 188, 4);                  // #fbbc04
        private static readonly Color GGreen = Color.FromArgb(52, 168, 83);                   // #34a853

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
            this.MouseLeave += (s, e) => { hoveredBtn = 0; this.Cursor = Cursors.Default; };
            this.KeyDown += OnFormKeyDown;
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

            this.Text = "Maps Scraper";
            this.ClientSize = new Size(480, 340);
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = ColBgBase;
            this.KeyPreview = true;

            SetFourColorRingIcon();

            clock = Stopwatch.StartNew();
            stateChangeTime = clock.Elapsed.TotalSeconds;

            animTimer = new System.Windows.Forms.Timer();
            animTimer.Interval = 15; // ~66 FPS
            animTimer.Tick += OnAnimationTick;
            animTimer.Start();
        }

        private void SetFourColorRingIcon()
        {
            string icoPath = Path.Combine(appDir, "app.ico");
            if (File.Exists(icoPath))
            {
                try { this.Icon = new Icon(icoPath); return; } catch { }
            }

            try
            {
                using (Bitmap bmp = new Bitmap(32, 32))
                using (Graphics g = Graphics.FromImage(bmp))
                {
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    g.Clear(Color.Transparent);
                    Rectangle r = new Rectangle(4, 4, 24, 24);
                    using (Pen pB = new Pen(GBlue, 5f))
                    using (Pen pR = new Pen(GRed, 5f))
                    using (Pen pY = new Pen(GYellow, 5f))
                    using (Pen pG = new Pen(GGreen, 5f))
                    {
                        g.DrawArc(pB, r, -90, 90);
                        g.DrawArc(pR, r, 0, 90);
                        g.DrawArc(pY, r, 90, 90);
                        g.DrawArc(pG, r, 180, 90);
                    }
                    this.Icon = Icon.FromHandle(bmp.GetHicon());
                }
            }
            catch { }
        }

        private void TransitionToState(ScreenState newState)
        {
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action(() => TransitionToState(newState)));
                return;
            }
            state = newState;
            stateChangeTime = clock.Elapsed.TotalSeconds;
            if (state == ScreenState.Arrancando && focusedBtn == 1)
            {
                focusedBtn = 0;
            }
            this.Invalidate();
        }

        private void OnAnimationTick(object sender, EventArgs e)
        {
            bool primaryAvailable = (state == ScreenState.Listo || state == ScreenState.Error);

            hoverPrimary = Lerp(hoverPrimary, (primaryAvailable && hoveredBtn == 1) ? 1f : 0f, 0.25f);
            hoverSecLeft = Lerp(hoverSecLeft, (hoveredBtn == 2) ? 1f : 0f, 0.25f);
            hoverSecRight = Lerp(hoverSecRight, (hoveredBtn == 3) ? 1f : 0f, 0.25f);
            pressPrimary = Lerp(pressPrimary, (primaryAvailable && pressedBtn == 1) ? 1f : 0f, 0.35f);

            this.Invalidate();
        }

        private float Lerp(float a, float b, float t)
        {
            return a + (b - a) * t;
        }

        // Approximation matching cubic-bezier(0.2, 0.9, 0.2, 1.0)
        private float CubicBezier02_09_02_1(float t)
        {
            t = Math.Max(0f, Math.Min(1f, t));
            // Solve parametric cubic bezier for x1=0.2, y1=0.9, x2=0.2, y2=1.0 via 5 Newton-Raphson steps
            float u = t;
            for (int i = 0; i < 5; i++)
            {
                float inv = 1f - u;
                float x = 3f * inv * inv * u * 0.2f + 3f * inv * u * u * 0.2f + u * u * u;
                float dx = 3f * inv * inv * 0.2f + 6f * inv * u * (0.2f - 0.2f) + 3f * u * u * (1f - 0.2f);
                if (Math.Abs(dx) < 1e-5f) break;
                u -= (x - t) / dx;
                u = Math.Max(0f, Math.Min(1f, u));
            }
            float invU = 1f - u;
            return 3f * invU * invU * u * 0.9f + 3f * invU * u * u * 1.0f + u * u * u;
        }

        private void OnFormMouseMove(object sender, MouseEventArgs e)
        {
            int newHover = 0;
            bool primaryVisible = (state == ScreenState.Listo || state == ScreenState.Error);

            if (primaryVisible && RectPrimaryBtn.Contains(e.Location))
                newHover = 1;
            else if (RectSecondaryLeft.Contains(e.Location))
                newHover = 2;
            else if (RectSecondaryRight.Contains(e.Location))
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
            if (pressedBtn != 0) focusedBtn = 0;
        }

        private void OnFormMouseUp(object sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            int clicked = pressedBtn;
            pressedBtn = 0;

            if (clicked != 0 && clicked == hoveredBtn)
            {
                ExecuteButtonAction(clicked);
            }
        }

        private void OnFormKeyDown(object sender, KeyEventArgs e)
        {
            bool primaryVisible = (state == ScreenState.Listo || state == ScreenState.Error);

            if (e.KeyCode == Keys.Tab)
            {
                int minBtn = primaryVisible ? 1 : 2;
                if (e.Shift)
                {
                    focusedBtn--;
                    if (focusedBtn < minBtn) focusedBtn = 3;
                }
                else
                {
                    focusedBtn++;
                    if (focusedBtn < minBtn || focusedBtn > 3) focusedBtn = minBtn;
                }
                e.Handled = true;
                this.Invalidate();
            }
            else if ((e.KeyCode == Keys.Enter || e.KeyCode == Keys.Space) && focusedBtn != 0)
            {
                ExecuteButtonAction(focusedBtn);
                e.Handled = true;
            }
            else if (e.KeyCode == Keys.Escape && state == ScreenState.Arrancando)
            {
                this.Close();
            }
        }

        private void ExecuteButtonAction(int btnId)
        {
            if (btnId == 1)
            {
                if (state == ScreenState.Listo)
                {
                    OpenAppWindow();
                }
                else if (state == ScreenState.Error)
                {
                    RetryStartup();
                }
            }
            else if (btnId == 2)
            {
                if (state == ScreenState.Error)
                {
                    ShowErrorDetailsDialog();
                }
                else
                {
                    OpenExcelsFolder();
                }
            }
            else if (btnId == 3)
            {
                if (state == ScreenState.Error)
                {
                    OpenExcelsFolder();
                }
                else
                {
                    // Both "Cancelar" (in Arrancando) and "Apagar servidor" (in Listo)
                    this.Close();
                }
            }
        }

        private void RetryStartup()
        {
            currentStep = 1;
            subtituloArrancando = "Iniciando el servidor y el motor de Maps";
            TransitionToState(ScreenState.Arrancando);
            ThreadPool.QueueUserWorkItem(_ => StartBackendAndOpen());
        }

        private void ShowErrorDetailsDialog()
        {
            string msg = string.IsNullOrEmpty(errorDetails)
                ? "El puerto " + port + " se encuentra ocupado o Node.js no pudo iniciar correctamente."
                : errorDetails;
            MessageBox.Show(this, msg, "Detalles del error — Maps Scraper", MessageBoxButtons.OK, MessageBoxIcon.Information);
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

            int w = this.ClientSize.Width;   // 480
            int h = this.ClientSize.Height;  // 340
            if (w <= 0 || h <= 0) return;

            double now = clock.Elapsed.TotalSeconds;
            double elapsedInState = Math.Max(0.0, now - stateChangeTime);

            // 1. Background (#fdfdff + 4 corner radial glows 70% x 60% of 480x340)
            g.Clear(ColBgBase);
            int rx = (int)(w * 0.70f); // 336
            int ry = (int)(h * 0.60f); // 204
            DrawCornerRadialGlow(g, 0, 0, rx, ry, Color.FromArgb(69, 190, 215, 255));     // Arriba izquierda: celeste (.27)
            DrawCornerRadialGlow(g, w, 0, rx, ry, Color.FromArgb(59, 232, 205, 255));     // Arriba derecha: lila (.23)
            DrawCornerRadialGlow(g, w, h, rx, ry, Color.FromArgb(64, 255, 224, 214));     // Abajo derecha: durazno (.25)
            DrawCornerRadialGlow(g, 0, h, rx, ry, Color.FromArgb(59, 198, 244, 230));     // Abajo izquierda: menta (.23)

            // 2. Top Status Bar (left: 20, right: 20, top: 16, height: 24)
            DrawTopBar(g, now);

            // 3. Center Ring (left: 204, top: 70, width: 72, height: 72)
            DrawCenterRing(g, now, elapsedInState);

            // 4. Title (top: 158, height: 28) & Subtitle (left: 60, right: 60, top: 188, height: 20)
            DrawTitleAndSubtitle(g);

            // 5. Action Zone:
            //    - Arrancando -> Step Indicator (left: 116, top: 248, width: 248, height: 4)
            //    - Listo / Error -> Primary Pill Button (left: 116, top: 224, width: 248, height: 52)
            if (state == ScreenState.Arrancando)
            {
                DrawStepIndicator(g, now);
            }
            else
            {
                DrawPrimaryButton(g, elapsedInState);
            }

            // 6. Secondary Buttons (left: 62, top: 292, 172x36 | right: 246, top: 292, 172x36)
            DrawSecondaryButtons(g);
        }

        private void DrawCornerRadialGlow(Graphics g, int cornerX, int cornerY, int radiusX, int radiusY, Color centerColor)
        {
            Rectangle bounds = new Rectangle(cornerX - radiusX, cornerY - radiusY, radiusX * 2, radiusY * 2);
            using (GraphicsPath path = new GraphicsPath())
            {
                path.AddEllipse(bounds);
                using (PathGradientBrush pgb = new PathGradientBrush(path))
                {
                    pgb.CenterPoint = new PointF(cornerX, cornerY);
                    pgb.CenterColor = centerColor;
                    pgb.SurroundColors = new Color[] { Color.FromArgb(0, centerColor.R, centerColor.G, centerColor.B) };
                    g.FillPath(pgb, path);
                }
            }
        }

        private void DrawTopBar(Graphics g, double now)
        {
            // Left: 8px status dot + "App local"
            Color dotColor = (state == ScreenState.Arrancando)
                ? ColPrimary
                : (state == ScreenState.Listo ? ColSuccess : ColDangerSolid);
            bool hasPulse = (state != ScreenState.Error);

            float dotCenterX = RectTopBar.Left + 4f; // 24
            float dotCenterY = RectTopBar.Top + 12f; // 28

            if (hasPulse)
            {
                // Pulse: halo from 0 to 7px fading out, 2.2s infinite
                float phase = (float)((now % 2.2) / 2.2);
                float spread = phase * 7f;
                int alpha = (int)((1f - phase) * 90f);
                if (alpha > 0)
                {
                    float r = 4f + spread;
                    using (Brush haloBrush = new SolidBrush(Color.FromArgb(alpha, dotColor)))
                    {
                        g.FillEllipse(haloBrush, dotCenterX - r, dotCenterY - r, r * 2f, r * 2f);
                    }
                }
            }

            using (Brush dotBrush = new SolidBrush(dotColor))
            {
                g.FillEllipse(dotBrush, dotCenterX - 4f, dotCenterY - 4f, 8f, 8f);
            }

            using (Font barFont = new Font(fontFamilyName, 13f, FontStyle.Regular, GraphicsUnit.Pixel))
            using (Brush textBrush = new SolidBrush(ColTextSecondary))
            {
                StringFormat sf = new StringFormat { LineAlignment = StringAlignment.Center };
                g.DrawString("App local", barFont, textBrush, new RectangleF(RectTopBar.Left + 16, RectTopBar.Top, 140, RectTopBar.Height), sf);
            }

            // Right: Status Pill (height 24, horizontal padding 12, radius 99)
            string pillText = (state == ScreenState.Arrancando)
                ? "Iniciando"
                : (state == ScreenState.Listo ? "Activo · Puerto " + port : "Detenido");
            Color pillBg = (state == ScreenState.Arrancando)
                ? ColTonal
                : (state == ScreenState.Listo ? ColSuccessBg : ColDangerBg);
            Color pillFg = (state == ScreenState.Arrancando)
                ? ColOnTonal
                : (state == ScreenState.Listo ? ColSuccessPillText : ColDangerText);

            using (Font pillFont = new Font(fontFamilyName, 12f, FontStyle.Bold, GraphicsUnit.Pixel))
            {
                SizeF textSize = g.MeasureString(pillText, pillFont, 300, StringFormat.GenericTypographic);
                int pillW = (int)Math.Ceiling(textSize.Width) + 24; // 12px padding each side
                int pillH = 24;
                Rectangle pillRect = new Rectangle(RectTopBar.Right - pillW, RectTopBar.Top, pillW, pillH);

                using (GraphicsPath pp = CreateRoundedRect(pillRect, pillH))
                using (Brush pb = new SolidBrush(pillBg))
                {
                    g.FillPath(pb, pp);
                }

                StringFormat csf = new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                };
                using (Brush fb = new SolidBrush(pillFg))
                {
                    g.DrawString(pillText, pillFont, fb, pillRect, csf);
                }
            }
        }

        private void DrawCenterRing(Graphics g, double now, double elapsedInState)
        {
            // ViewBox 0 0 72 72 at (204, 70), center (240, 106), radius 30, stroke 5
            float cx = 240f;
            float cy = 106f;
            float radius = 30f;

            if (state == ScreenState.Arrancando)
            {
                // 1 turn every 2.4s (150 deg/s), 4 arcs of 68 deg
                float baseAngle = (float)((now * 150.0) % 360.0) - 90f;
                RectangleF arcBounds = new RectangleF(cx - radius, cy - radius, radius * 2f, radius * 2f);

                Color[] colors = new Color[] { GBlue, GRed, GYellow, GGreen };
                float[] offsets = new float[] { 0f, 90f, 180f, 270f };

                for (int i = 0; i < 4; i++)
                {
                    using (Pen p = new Pen(colors[i], 5f))
                    {
                        p.StartCap = LineCap.Round;
                        p.EndCap = LineCap.Round;
                        g.DrawArc(p, arcBounds, baseAngle + offsets[i], 68f);
                    }
                }
            }
            else if (state == ScreenState.Listo)
            {
                // "cl": 0.6s duration with 0.15s delay, cubic-bezier(.2,.9,.2,1)
                // Each arc grows from 68 deg to 90 deg and transitions to #1e8e3e
                float tCloseRaw = (float)((elapsedInState - 0.15) / 0.6);
                float tClose = CubicBezier02_09_02_1(tCloseRaw);

                float sweep = Lerp(68f, 92f, tClose); // 92f overlaps rounded caps seamlessly into a closed ring
                float rotOffset = -90f;
                RectangleF arcBounds = new RectangleF(cx - radius, cy - radius, radius * 2f, radius * 2f);

                Color[] startCols = new Color[] { GBlue, GRed, GYellow, GGreen };
                float[] offsets = new float[] { 0f, 90f, 180f, 270f };

                for (int i = 0; i < 4; i++)
                {
                    Color c = BlendColor(startCols[i], ColSuccess, tClose);
                    using (Pen p = new Pen(c, 5f))
                    {
                        p.StartCap = LineCap.Round;
                        p.EndCap = LineCap.Round;
                        g.DrawArc(p, arcBounds, rotOffset + offsets[i], sweep);
                    }
                }

                // "ck": checkmark M24 37.5 l8 8 l16 -17, thickness 5, length 36, 0.3s duration with 0.65s delay
                if (elapsedInState > 0.65)
                {
                    float tCheck = Math.Max(0f, Math.Min(1f, (float)((elapsedInState - 0.65) / 0.3)));
                    DrawProgressiveCheckmark(g, RectRing.Left, RectRing.Top, tCheck);
                }
            }
            else if (state == ScreenState.Error)
            {
                // "sk": shake +-4px horizontal at 20%, 40%, 60%, 80%, 0.3s duration with 0.1s delay
                float shakeX = 0f;
                if (elapsedInState >= 0.1 && elapsedInState <= 0.4)
                {
                    float p = (float)((elapsedInState - 0.1) / 0.3);
                    shakeX = EvaluateShakeOffset(p);
                }

                RectangleF arcBounds = new RectangleF(cx - radius + shakeX, cy - radius, radius * 2f, radius * 2f);
                using (Pen ringPen = new Pen(ColDangerSolid, 5f))
                {
                    g.DrawEllipse(ringPen, arcBounds);
                }

                // Exclamation mark: line M36 22 v17, dot at (36, 49) radius 2.5
                float ox = RectRing.Left + shakeX;
                float oy = RectRing.Top;
                using (Pen exPen = new Pen(ColDangerSolid, 5f))
                {
                    exPen.StartCap = LineCap.Round;
                    exPen.EndCap = LineCap.Round;
                    g.DrawLine(exPen, ox + 36f, oy + 22f, ox + 36f, oy + 39f);
                }
                using (Brush dotB = new SolidBrush(ColDangerSolid))
                {
                    g.FillEllipse(dotB, ox + 36f - 2.5f, oy + 49f - 2.5f, 5f, 5f);
                }
            }
        }

        private void DrawProgressiveCheckmark(Graphics g, float originX, float originY, float progress)
        {
            // Segment 1: (24, 37.5) -> (32, 45.5), length = sqrt(64+64) = 11.31
            // Segment 2: (32, 45.5) -> (48, 28.5), length = sqrt(256+289) = 23.35
            // Total length ~= 34.66 (~36 in spec)
            PointF p0 = new PointF(originX + 24f, originY + 37.5f);
            PointF p1 = new PointF(originX + 32f, originY + 45.5f);
            PointF p2 = new PointF(originX + 48f, originY + 28.5f);

            float len1 = 11.31f;
            float len2 = 23.35f;
            float total = len1 + len2;
            float dist = progress * total;

            using (Pen ckPen = new Pen(ColSuccess, 5f))
            {
                ckPen.StartCap = LineCap.Round;
                ckPen.EndCap = LineCap.Round;
                ckPen.LineJoin = LineJoin.Round;

                if (dist <= len1)
                {
                    float f = dist / len1;
                    PointF end1 = new PointF(Lerp(p0.X, p1.X, f), Lerp(p0.Y, p1.Y, f));
                    g.DrawLine(ckPen, p0, end1);
                }
                else
                {
                    float f = Math.Min(1f, (dist - len1) / len2);
                    PointF end2 = new PointF(Lerp(p1.X, p2.X, f), Lerp(p1.Y, p2.Y, f));
                    g.DrawLines(ckPen, new PointF[] { p0, p1, end2 });
                }
            }
        }

        private float EvaluateShakeOffset(float p)
        {
            // Keyframes: 0% -> 0, 20% -> -4, 40% -> +4, 60% -> -4, 80% -> +4, 100% -> 0
            float[] times = new float[] { 0f, 0.2f, 0.4f, 0.6f, 0.8f, 1.0f };
            float[] vals = new float[] { 0f, -4f, 4f, -4f, 4f, 0f };
            for (int i = 0; i < times.Length - 1; i++)
            {
                if (p >= times[i] && p <= times[i + 1])
                {
                    float localT = (p - times[i]) / (times[i + 1] - times[i]);
                    return Lerp(vals[i], vals[i + 1], localT);
                }
            }
            return 0f;
        }

        private void DrawTitleAndSubtitle(Graphics g)
        {
            string titleText = (state == ScreenState.Arrancando)
                ? "Preparando todo"
                : (state == ScreenState.Listo ? "Todo listo" : "No pudimos iniciar");

            string subText = (state == ScreenState.Arrancando)
                ? subtituloArrancando
                : (state == ScreenState.Listo ? "La app está abierta en otra ventana" : errorSubtitle);

            using (Font titleFont = new Font(fontFamilyName, 21f, FontStyle.Regular, GraphicsUnit.Pixel))
            using (Brush titleBrush = new SolidBrush(ColText))
            {
                StringFormat sf = new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                };
                g.DrawString(titleText, titleFont, titleBrush, RectTitle, sf);
            }

            using (Font subFont = new Font(fontFamilyName, 13.5f, FontStyle.Regular, GraphicsUnit.Pixel))
            using (Brush subBrush = new SolidBrush(ColTextSecondary))
            {
                StringFormat sf = new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center,
                    Trimming = StringTrimming.EllipsisCharacter,
                    FormatFlags = StringFormatFlags.NoWrap
                };
                g.DrawString(subText, subFont, subBrush, RectSubtitle, sf);
            }
        }

        private void DrawStepIndicator(Graphics g, double now)
        {
            // 4 segments at (116, 248), width 248, height 4, gap 8, segment width 56, radius 2
            int segWidth = 56;
            int gap = 8;
            int h = 4;

            for (int i = 0; i < 4; i++)
            {
                int stepNum = i + 1;
                int sx = RectStepIndicator.Left + i * (segWidth + gap);
                Rectangle segRect = new Rectangle(sx, RectStepIndicator.Top, segWidth, h);

                using (GraphicsPath segPath = CreateRoundedRect(segRect, 4))
                {
                    if (stepNum < currentStep)
                    {
                        // Completed step: #1a73e8
                        using (Brush b = new SolidBrush(ColPrimary))
                        {
                            g.FillPath(b, segPath);
                        }
                    }
                    else if (stepNum == currentStep)
                    {
                        // Active step ("sh"): linear-gradient(90deg, azul, rojo, amarillo, verde, azul) shifting over 2s
                        float shift = (float)((now % 2.0) / 2.0) * (segWidth * 2f);
                        float gradStartX = sx - shift;
                        float gradWidth = segWidth * 2f;

                        using (LinearGradientBrush lgb = new LinearGradientBrush(
                            new PointF(gradStartX, segRect.Top),
                            new PointF(gradStartX + gradWidth, segRect.Top),
                            GBlue,
                            GBlue))
                        {
                            lgb.WrapMode = WrapMode.Tile;
                            ColorBlend cb = new ColorBlend(5);
                            cb.Colors = new Color[] { GBlue, GRed, GYellow, GGreen, GBlue };
                            cb.Positions = new float[] { 0f, 0.25f, 0.50f, 0.75f, 1f };
                            lgb.InterpolationColors = cb;
                            g.FillPath(lgb, segPath);
                        }
                    }
                    else
                    {
                        // Pending step: #e8eaed
                        using (Brush b = new SolidBrush(ColProgressTrack))
                        {
                            g.FillPath(b, segPath);
                        }
                    }
                }
            }
        }

        private void DrawPrimaryButton(Graphics g, double elapsedInState)
        {
            // Entrance animation "up": 0.35s cubic-bezier(.2,.9,.2,1), opacity 0 -> 1, translateY(12px) -> 0
            float tUp = CubicBezier02_09_02_1((float)(elapsedInState / 0.35));
            int alpha255 = (int)(tUp * 255f);
            if (alpha255 <= 2) return;

            float slideY = (1f - tUp) * 12f;
            float hoverLift = hoverPrimary * -2f;
            float scale = 1f - (pressPrimary * 0.03f); // scale(.97) on press

            int w = (int)Math.Round(RectPrimaryBtn.Width * scale);
            int h = (int)Math.Round(RectPrimaryBtn.Height * scale);
            int x = RectPrimaryBtn.X + (RectPrimaryBtn.Width - w) / 2;
            int y = (int)Math.Round(RectPrimaryBtn.Y + slideY + hoverLift + (RectPrimaryBtn.Height - h) / 2f);
            Rectangle btnRect = new Rectangle(x, y, w, h);

            // Multi-layer soft shadow: 0 4px 12px rgba(26,115,232,.28), hover: 0 6px 18px rgba(26,115,232,.36)
            int shadowOffsetY = (int)Math.Round(Lerp(4f, 6f, hoverPrimary));
            float baseShadowAlpha = Lerp(71f, 92f, hoverPrimary) * tUp;
            for (int layer = 3; layer >= 1; layer--)
            {
                int spread = layer * 2;
                Rectangle sRect = new Rectangle(
                    btnRect.X - spread / 2,
                    btnRect.Y + shadowOffsetY - spread / 3,
                    btnRect.Width + spread,
                    btnRect.Height + spread
                );
                int layerAlpha = (int)(baseShadowAlpha / (layer * 1.35f));
                using (GraphicsPath sp = CreateRoundedRect(sRect, sRect.Height))
                using (Brush sb = new SolidBrush(Color.FromArgb(Math.Min(255, layerAlpha), ColPrimary)))
                {
                    g.FillPath(sb, sp);
                }
            }

            // Fill Color (#1a73e8 -> hover #1765cc -> pressed #185abc)
            Color bg = BlendColor(ColPrimary, ColPrimaryHover, hoverPrimary);
            bg = BlendColor(bg, ColPrimaryPressed, pressPrimary);

            using (GraphicsPath bp = CreateRoundedRect(btnRect, btnRect.Height))
            using (Brush bb = new SolidBrush(Color.FromArgb(alpha255, bg)))
            {
                g.FillPath(bb, bp);
            }

            // Keyboard focus ring (2px #1a73e8 at 3px distance)
            if (focusedBtn == 1)
            {
                Rectangle focusRect = new Rectangle(btnRect.X - 4, btnRect.Y - 4, btnRect.Width + 8, btnRect.Height + 8);
                using (GraphicsPath fp = CreateRoundedRect(focusRect, focusRect.Height))
                using (Pen fPen = new Pen(Color.FromArgb(alpha255, ColPrimary), 2f))
                {
                    g.DrawPath(fPen, fp);
                }
            }

            string label = (state == ScreenState.Listo) ? "Abrir la app" : "Reintentar";
            using (Font btnFont = new Font(fontFamilyName, 15f, FontStyle.Bold, GraphicsUnit.Pixel))
            using (Brush tb = new SolidBrush(Color.FromArgb(alpha255, Color.White)))
            {
                StringFormat sf = new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                };
                g.DrawString(label, btnFont, tb, btnRect, sf);
            }
        }

        private void DrawSecondaryButtons(Graphics g)
        {
            if (state == ScreenState.Arrancando)
            {
                DrawSecondaryPill(g, RectSecondaryLeft, "Carpeta de Excels", "carpeta", false, hoverSecLeft, focusedBtn == 2);
                DrawSecondaryPill(g, RectSecondaryRight, "Cancelar", "cerrar", true, hoverSecRight, focusedBtn == 3);
            }
            else if (state == ScreenState.Listo)
            {
                DrawSecondaryPill(g, RectSecondaryLeft, "Carpeta de Excels", "carpeta", false, hoverSecLeft, focusedBtn == 2);
                DrawSecondaryPill(g, RectSecondaryRight, "Apagar servidor", "detener", true, hoverSecRight, focusedBtn == 3);
            }
            else
            {
                DrawSecondaryPill(g, RectSecondaryLeft, "Ver detalles", "lista", false, hoverSecLeft, focusedBtn == 2);
                DrawSecondaryPill(g, RectSecondaryRight, "Carpeta de Excels", "carpeta", false, hoverSecRight, focusedBtn == 3);
            }
        }

        private void DrawSecondaryPill(
            Graphics g,
            Rectangle rect,
            string label,
            string iconType,
            bool isCancelOrStopVariant,
            float hoverAmt,
            bool hasFocus)
        {
            Color bgIdle = ColSurface;
            Color bgHover = isCancelOrStopVariant ? ColDangerBg : ColTonal;
            Color borderIdle = ColBorder;
            Color borderHover = isCancelOrStopVariant ? ColDangerBg : ColTonal;
            Color textIdle = isCancelOrStopVariant ? ColTextSecondary : ColTextBtnSec;
            Color textHover = isCancelOrStopVariant ? ColDangerText : ColOnTonal;
            Color iconIdle = isCancelOrStopVariant ? ColTextSecondary : ColPrimary;
            Color iconHover = isCancelOrStopVariant ? ColDangerText : ColOnTonal;

            Color bg = BlendColor(bgIdle, bgHover, hoverAmt);
            Color brd = BlendColor(borderIdle, borderHover, hoverAmt);
            Color fg = BlendColor(textIdle, textHover, hoverAmt);
            Color ic = BlendColor(iconIdle, iconHover, hoverAmt);

            using (GraphicsPath path = CreateRoundedRect(rect, rect.Height))
            {
                using (Brush bb = new SolidBrush(bg))
                {
                    g.FillPath(bb, path);
                }
                using (Pen bp = new Pen(brd, 1f))
                {
                    g.DrawPath(bp, path);
                }
            }

            if (hasFocus)
            {
                Rectangle focusRect = new Rectangle(rect.X - 4, rect.Y - 4, rect.Width + 8, rect.Height + 8);
                using (GraphicsPath fp = CreateRoundedRect(focusRect, focusRect.Height))
                using (Pen fPen = new Pen(ColPrimary, 2f))
                {
                    g.DrawPath(fPen, fp);
                }
            }

            using (Font f = new Font(fontFamilyName, 13.5f, FontStyle.Regular, GraphicsUnit.Pixel))
            {
                SizeF textSz = g.MeasureString(label, f, 200, StringFormat.GenericTypographic);
                float iconSize = 16f;
                float gap = 8f;
                float totalW = iconSize + gap + textSz.Width;
                float startX = rect.X + (rect.Width - totalW) / 2f;
                float iconY = rect.Y + (rect.Height - iconSize) / 2f;

                DrawMaterialIcon16(g, iconType, startX, iconY, ic);

                using (Brush tb = new SolidBrush(fg))
                {
                    StringFormat sf = new StringFormat { LineAlignment = StringAlignment.Center };
                    RectangleF textRect = new RectangleF(startX + iconSize + gap, rect.Y, textSz.Width + 6f, rect.Height);
                    g.DrawString(label, f, tb, textRect, sf);
                }
            }
        }

        private void DrawMaterialIcon16(Graphics g, string iconType, float x, float y, Color color)
        {
            // Scale 24x24 Material viewBox to 16x16
            GraphicsState stateBackup = g.Save();
            g.TranslateTransform(x, y);
            g.ScaleTransform(16f / 24f, 16f / 24f);

            using (Brush b = new SolidBrush(color))
            {
                if (iconType == "carpeta")
                {
                    // M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z
                    using (GraphicsPath p = new GraphicsPath())
                    {
                        p.AddPolygon(new PointF[]
                        {
                            new PointF(2f, 6f),
                            new PointF(4f, 4f),
                            new PointF(10f, 4f),
                            new PointF(12f, 6f),
                            new PointF(20f, 6f),
                            new PointF(22f, 8f),
                            new PointF(22f, 18f),
                            new PointF(20f, 20f),
                            new PointF(4f, 20f),
                            new PointF(2f, 18f)
                        });
                        g.FillPath(b, p);
                    }
                }
                else if (iconType == "cerrar")
                {
                    // M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z
                    using (GraphicsPath p = new GraphicsPath())
                    {
                        p.AddPolygon(new PointF[]
                        {
                            new PointF(19f, 6.41f),
                            new PointF(17.59f, 5f),
                            new PointF(12f, 10.59f),
                            new PointF(6.41f, 5f),
                            new PointF(5f, 6.41f),
                            new PointF(10.59f, 12f),
                            new PointF(5f, 17.59f),
                            new PointF(6.41f, 19f),
                            new PointF(12f, 13.41f),
                            new PointF(17.59f, 19f),
                            new PointF(19f, 17.59f),
                            new PointF(13.41f, 12f)
                        });
                        g.FillPath(b, p);
                    }
                }
                else if (iconType == "detener")
                {
                    // M6 6h12v12H6z
                    g.FillRectangle(b, 6f, 6f, 12f, 12f);
                }
                else if (iconType == "lista")
                {
                    // M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z
                    g.FillRectangle(b, 3f, 7f, 2f, 2f);
                    g.FillRectangle(b, 3f, 11f, 2f, 2f);
                    g.FillRectangle(b, 3f, 15f, 2f, 2f);
                    g.FillRectangle(b, 7f, 7f, 14f, 2f);
                    g.FillRectangle(b, 7f, 11f, 14f, 2f);
                    g.FillRectangle(b, 7f, 15f, 14f, 2f);
                }
            }

            g.Restore(stateBackup);
        }

        private Color BlendColor(Color c1, Color c2, float t)
        {
            t = Math.Max(0f, Math.Min(1f, t));
            int r = (int)(c1.R + (c2.R - c1.R) * t);
            int gr = (int)(c1.G + (c2.G - c1.G) * t);
            int b = (int)(c1.B + (c2.B - c1.B) * t);
            return Color.FromArgb(r, gr, b);
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

        private void SetStartupStep(int step, string subtitle)
        {
            currentStep = step;
            subtituloArrancando = subtitle;
        }

        private void StartBackendAndOpen()
        {
            try
            {
                // Paso 1 de 4: Verificando entorno local
                SetStartupStep(1, "Verificando archivos y entorno local");
                Thread.Sleep(320);

                string nodeModulesPath = Path.Combine(appDir, "node_modules");
                string distIndexPath = Path.Combine(appDir, "frontend", "dist", "index.html");

                // Paso 2 de 4: Dependencias y compilación
                SetStartupStep(2, "Comprobando módulos y paneles locales");
                if (!Directory.Exists(nodeModulesPath) || !File.Exists(distIndexPath))
                {
                    SetStartupStep(2, "Instalando dependencias por única vez...");
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
                else
                {
                    Thread.Sleep(280);
                }

                // Paso 3 de 4: Iniciando el servidor y el motor de Maps
                SetStartupStep(3, "Iniciando el servidor y el motor de Maps");

                if (!IsPortOpen(port))
                {
                    try
                    {
                        string nodeExe = "node";
                        if (File.Exists(@"C:\Program Files\nodejs\node.exe"))
                        {
                            nodeExe = @"C:\Program Files\nodejs\node.exe";
                        }
                        else if (File.Exists(@"C:\Program Files (x86)\nodejs\node.exe"))
                        {
                            nodeExe = @"C:\Program Files (x86)\nodejs\node.exe";
                        }

                        ProcessStartInfo psi = new ProcessStartInfo(nodeExe, "server.js")
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
                        errorSubtitle = "No se encontró Node.js en el sistema";
                        errorDetails = "Error al ejecutar 'node server.js':\n" + ex.Message + "\n\nInstala Node.js desde https://nodejs.org.";
                        TransitionToState(ScreenState.Error);
                        return;
                    }

                    bool connected = false;
                    for (int i = 0; i < 25; i++)
                    {
                        if (IsPortOpen(port))
                        {
                            connected = true;
                            break;
                        }
                        Thread.Sleep(240);
                    }

                    if (!connected)
                    {
                        errorSubtitle = "Otro programa usa el puerto " + port;
                        errorDetails = "El servidor no respondió en 127.0.0.1:" + port + " tras esperar 6 segundos.";
                        TransitionToState(ScreenState.Error);
                        return;
                    }
                }
                else
                {
                    Thread.Sleep(450);
                }

                // Paso 4 de 4: Abriendo ventana principal automáticamente
                SetStartupStep(4, "Abriendo ventana de la aplicación...");
                Thread.Sleep(350);

                OpenAppWindow();

                // Transition to "Listo" (closes ring into green checkmark and slides up "Abrir la app" button)
                Thread.Sleep(220);
                TransitionToState(ScreenState.Listo);
            }
            catch (Exception ex)
            {
                errorSubtitle = "Error inesperado durante el arranque";
                errorDetails = ex.ToString();
                TransitionToState(ScreenState.Error);
            }
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

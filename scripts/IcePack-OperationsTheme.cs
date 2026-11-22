using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace IcePack.Operations
{
    internal static class ThemePaint
    {
        internal const TextFormatFlags CenteredText = TextFormatFlags.HorizontalCenter |
            TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.NoPrefix;

        internal static void Surface(Graphics graphics, Rectangle bounds, int radius, Color start, Color end, Color border, float borderWidth)
        {
            float scale = graphics.DpiX / 96f;
            float stroke = borderWidth * scale;
            float inset = Math.Max(0.5f, stroke / 2);
            RectangleF rect = RectangleF.Inflate(bounds, -inset, -inset);
            if (rect.Width <= 0 || rect.Height <= 0) return;

            float diameter = Math.Min(radius * scale * 2, Math.Min(rect.Width, rect.Height));
            GraphicsState state = graphics.Save();
            try
            {
                graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath shape = new GraphicsPath())
                {
                    shape.AddArc(rect.Left, rect.Top, diameter, diameter, 180, 90);
                    shape.AddArc(rect.Right - diameter, rect.Top, diameter, diameter, 270, 90);
                    shape.AddArc(rect.Right - diameter, rect.Bottom - diameter, diameter, diameter, 0, 90);
                    shape.AddArc(rect.Left, rect.Bottom - diameter, diameter, diameter, 90, 90);
                    shape.CloseFigure();

                    if (start == end)
                    {
                        using (SolidBrush brush = new SolidBrush(start)) graphics.FillPath(brush, shape);
                    }
                    else
                    {
                        using (LinearGradientBrush brush = new LinearGradientBrush(rect, start, end, 20f, true))
                            graphics.FillPath(brush, shape);
                    }
                    if (border.A != 0 && stroke > 0)
                    {
                        using (Pen pen = new Pen(border, stroke)) graphics.DrawPath(pen, shape);
                    }
                }
            }
            finally
            {
                graphics.Restore(state);
            }
        }
    }

    public class RoundedSurface : TableLayoutPanel
    {
        public int Radius { get; set; }
        public Color FillStart { get; set; }
        public Color FillEnd { get; set; }
        public Color Outline { get; set; }

        public RoundedSurface()
        {
            SetStyle(ControlStyles.SupportsTransparentBackColor | ControlStyles.ResizeRedraw, true);
            BackColor = Color.Transparent;
            DoubleBuffered = true;
            Radius = 18;
        }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
            base.OnPaintBackground(e);
            ThemePaint.Surface(e.Graphics, ClientRectangle, Radius, FillStart, FillEnd, Outline, 1f);
        }
    }

    public sealed class BrandMark : RoundedSurface
    {
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics graphics = e.Graphics;
            GraphicsState state = graphics.Save();
            try
            {
                float size = Math.Min(Width, Height) * 0.58f;
                graphics.TranslateTransform((Width - size) / 2, (Height - size) / 2);
                graphics.ScaleTransform(size / 24f, size / 24f);
                graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (Pen pen = new Pen(ForeColor, 1.8f))
                using (GraphicsPath gamepad = new GraphicsPath())
                {
                    pen.StartCap = LineCap.Round;
                    pen.EndCap = LineCap.Round;
                    gamepad.AddLine(7, 7, 17, 7);
                    gamepad.AddBezier(17, 7, 20, 7, 21, 10, 22, 16);
                    gamepad.AddBezier(22, 16, 22.5f, 19, 20, 20, 18.5f, 18.5f);
                    gamepad.AddLine(18.5f, 18.5f, 16, 16);
                    gamepad.AddLine(16, 16, 8, 16);
                    gamepad.AddLine(8, 16, 5.5f, 18.5f);
                    gamepad.AddBezier(5.5f, 18.5f, 4, 20, 1.5f, 19, 2, 16);
                    gamepad.AddBezier(2, 16, 3, 10, 4, 7, 7, 7);
                    gamepad.CloseFigure();
                    graphics.DrawPath(pen, gamepad);
                    graphics.DrawLine(pen, 6, 11.5f, 10, 11.5f);
                    graphics.DrawLine(pen, 8, 9.5f, 8, 13.5f);
                }
                using (SolidBrush ink = new SolidBrush(ForeColor))
                {
                    graphics.FillEllipse(ink, 14, 10, 2, 2);
                    graphics.FillEllipse(ink, 17, 12, 2, 2);
                }
            }
            finally
            {
                graphics.Restore(state);
            }
        }
    }

    public sealed class StatusPill : Label
    {
        public StatusPill()
        {
            SetStyle(ControlStyles.SupportsTransparentBackColor | ControlStyles.ResizeRedraw, true);
            BackColor = Color.Transparent;
            DoubleBuffered = true;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Color fill = Color.FromArgb(26, ForeColor);
            Color border = Color.FromArgb(72, ForeColor);
            ThemePaint.Surface(e.Graphics, ClientRectangle, 100, fill, fill, border, 1f);
            TextRenderer.DrawText(e.Graphics, Text, Font, ClientRectangle, ForeColor, ThemePaint.CenteredText);
        }
    }

    public sealed class ActionStrip : FlowLayoutPanel
    {
        public ActionStrip()
        {
            // The card uses the strip's actual height after its width has been assigned.
            AutoSize = false;
            WrapContents = true;
            Height = 0;
        }

        protected override void OnLayout(LayoutEventArgs e)
        {
            base.OnLayout(e);
            if (ClientSize.Width <= 0) return;

            int wrappedHeight = GetPreferredSize(new Size(ClientSize.Width, 0)).Height;
            if (Height != wrappedHeight) Height = wrappedHeight;
        }
    }

    public sealed class RoundedButton : Button
    {
        public Color FillStart { get; set; }
        public Color FillEnd { get; set; }
        public Color HoverStart { get; set; }
        public Color HoverEnd { get; set; }
        public Color Outline { get; set; }
        private bool hovered;
        private bool spaceDown;

        public RoundedButton()
        {
            FlatStyle = FlatStyle.Flat;
            UseVisualStyleBackColor = false;
            SetStyle(ControlStyles.Opaque | ControlStyles.ResizeRedraw, true);
            DoubleBuffered = true;

            MouseEnter += delegate { hovered = true; Invalidate(); };
            MouseLeave += delegate { hovered = false; Invalidate(); };
            MouseDown += delegate { Invalidate(); };
            MouseUp += delegate { Invalidate(); };
            MouseCaptureChanged += delegate { Invalidate(); };
            GotFocus += delegate { Invalidate(); };
            LostFocus += delegate { spaceDown = false; Invalidate(); };
            EnabledChanged += delegate { spaceDown = false; Invalidate(); };
            KeyDown += delegate(object sender, KeyEventArgs e)
            {
                if (e.KeyCode == Keys.Space) { spaceDown = true; Invalidate(); }
            };
            KeyUp += delegate(object sender, KeyEventArgs e)
            {
                if (e.KeyCode == Keys.Space) { spaceDown = false; Invalidate(); }
            };
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            // Clear the corners as well as the face so no previous frame shows through.
            using (SolidBrush background = new SolidBrush(BackColor))
                e.Graphics.FillRectangle(background, e.ClipRectangle);

            Color start = hovered ? HoverStart : FillStart;
            Color end = hovered ? HoverEnd : FillEnd;
            Color ink = ForeColor;
            Color border = Outline;
            bool pushed = spaceDown || (hovered && Capture && (MouseButtons & MouseButtons.Left) != 0);
            bool focus = Focused && ShowFocusCues;

            if (!Enabled)
            {
                start = end = Color.FromArgb(25, 39, 57);
                ink = Color.FromArgb(148, 163, 184);
                border = Color.FromArgb(48, 64, 82);
            }
            else
            {
                if (pushed)
                {
                    start = ControlPaint.Dark(start, 0.13f);
                    end = ControlPaint.Dark(end, 0.13f);
                }
                if (focus) border = Color.FromArgb(103, 232, 249);
            }

            ThemePaint.Surface(e.Graphics, ClientRectangle, 10, start, end, border, focus ? 2f : 1f);
            Rectangle label = Rectangle.FromLTRB(Padding.Left, Padding.Top, Width - Padding.Right, Height - Padding.Bottom);
            TextRenderer.DrawText(e.Graphics, Text, Font, label, ink, ThemePaint.CenteredText | TextFormatFlags.EndEllipsis);
        }
    }
}

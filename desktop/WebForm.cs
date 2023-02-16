using Microsoft.Web.WebView2.Core;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace SMarker {

    public partial class WebForm : Form {

        public WebForm() {
            InitializeComponent();
            webView21.CoreWebView2InitializationCompleted += WebViewInitialized;
            StartPosition = FormStartPosition.CenterScreen;
            Opacity = 0;
        }

        private CoreWebView2 View {
            get {
                return webView21?.CoreWebView2;
            }
        }

        public bool isDebug = false;

        private void WebViewInitialized(object sender, CoreWebView2InitializationCompletedEventArgs e) {
            View.PermissionRequested += (object _, CoreWebView2PermissionRequestedEventArgs ev) => {
                var def = ev.GetDeferral();
                ev.State = CoreWebView2PermissionState.Allow;
                ev.Handled = true;
                def.Complete();
            };
            View.Settings.AreBrowserAcceleratorKeysEnabled = false;
            View.Settings.IsPasswordAutosaveEnabled = false;
            if (isDebug) View.OpenDevToolsWindow();
        }

        private void Form1_FormClosing(object sender, FormClosingEventArgs e) {
            var location = new FormLocation().Read(this);
            Properties.Settings.Default.FormLocation = location.ToJSON();
            Properties.Settings.Default.Save();
        }


        private void Form1_Load(object sender, EventArgs e) {
            var location = FormLocation.FromJSON(Properties.Settings.Default.FormLocation);
            location?.Write(this);
            BringToTop();
            InitializeAsync();
        }

        private Dictionary<string, Service> services = new Dictionary<string, Service>();
        internal void AddService(string name, Service serviceObj) {
            services.Add(name, serviceObj);
        }

        public string IndexPage;

        async void InitializeAsync() {
            var options = new CoreWebView2EnvironmentOptions("--allow-file-access-from-files");
            var UserDataFolder = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                         "SMarkdownEditorWeb"); ;
            var environment = await CoreWebView2Environment.CreateAsync(null, UserDataFolder, options);
            await webView21.EnsureCoreWebView2Async(environment);

            View.DOMContentLoaded += View_DOMContentLoaded;
            //View.WebMessageReceived += View_WebMessageReceived;
            foreach (var entry in services) {
                var service = entry.Value;
                service.form = this;
                service.view = View;
                service.Init();
                View.AddHostObjectToScript(entry.Key, service);
            }

            View.Navigate(IndexPage);
        }

        private void View_DOMContentLoaded(object sender, CoreWebView2DOMContentLoadedEventArgs e) {
            Debug.WriteLine("loaded");
        }

        public void RunUI(Action action) {
            Invoke(new MethodInvoker(action));
        }

        public void BringToTop() {
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            if (WindowState == FormWindowState.Normal) {
                var workingArea = Screen.FromControl(this).WorkingArea;
                var formBounds = new Rectangle(Location, Size);
                if (!workingArea.Contains(formBounds)) {
                    DoCenterToScreen();
                }
            }
            bool top = TopMost;
            TopMost = true;
            TopMost = top;
        }

        private void DoCenterToScreen() {
            Form form = this;
            Rectangle workingArea = Screen.FromControl(form).WorkingArea;
            form.Width = Math.Min(workingArea.Width, form.Width);
            form.Height = Math.Min(workingArea.Height, form.Height);
            form.Location = new Point() {
                X = Math.Max(workingArea.X, workingArea.X + (workingArea.Width - form.Width) / 2),
                Y = Math.Max(workingArea.Y, workingArea.Y + (workingArea.Height - form.Height) / 2)
            };
        }
    }


    public class FormLocation {
        public Size Size;
        public Point Location;
        public FormWindowState WindowState;

        public FormLocation Read(Form form) {
            if (form.WindowState == FormWindowState.Normal) {
                Location = form.Location;
                Size = form.Size;
            } else {
                Location = form.RestoreBounds.Location;
                Size = form.RestoreBounds.Size;
            }
            WindowState = form.WindowState;
            return this;
        }

        public FormLocation Write(Form form) {
            form.Location = Location;
            form.WindowState = WindowState;
            form.Size = Size;
            return this;
        }

        public string ToJSON() {
            return JsonConvert.SerializeObject(this);
        }

        public static FormLocation FromJSON(string json) {
            if (json == null) return null;
            return JsonConvert.DeserializeObject<FormLocation>(json);
        }
    }

    public class FormEvent {
        public string type;
        public object payload;
        public FormEvent(string type, object payload = null) {
            this.type = type;
            this.payload = payload;
        }
    }


    public abstract class Service {
        public Form form;
        public CoreWebView2 view;
        public abstract void Init();

        public void FireEvent(string name, object payload = null) {
            FireEvent(new FormEvent(name, payload));
        }

        public void FireEvent(FormEvent evt) {
            var script = string.Format("fireFormEvent(`{0}`)",
                JsonConvert.SerializeObject(evt));
            Debug.WriteLine(script);
            view.ExecuteScriptAsync(script);
        }
    }
}

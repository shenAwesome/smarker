
using Microsoft.Web.WebView2.Core;
using Newtonsoft.Json;
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace SMarkdownReader {


    public partial class WebForm : Form {
        private string _filePath;
        private FileSystemWatcher _watcher;

        public WebForm() {
            InitializeComponent();
            webView21.CoreWebView2InitializationCompleted += WebViewInitialized;
            StartPosition = FormStartPosition.CenterScreen;
        }

        private void WebViewInitialized(object sender, CoreWebView2InitializationCompletedEventArgs e) {
            webView21.CoreWebView2.PermissionRequested += (object _, CoreWebView2PermissionRequestedEventArgs ev) => {
                var def = ev.GetDeferral();
                ev.State = CoreWebView2PermissionState.Allow;
                ev.Handled = true;
                def.Complete();
            };
        }

        private void Form1_FormClosing(object sender, FormClosingEventArgs e) {
            var location = new FormLocation().Read(this);
            Properties.Settings.Default.FormLocation = location.ToJSON();
            Properties.Settings.Default.Save();
        }


        private void Form1_Load(object sender, EventArgs e) {
            var location = FormLocation.FromJSON(Properties.Settings.Default.FormLocation);
            location?.Write(this);
            InitializeAsync();
        }

        async void InitializeAsync() {
            var options = new CoreWebView2EnvironmentOptions("--allow-file-access-from-files");
            var environment = await CoreWebView2Environment.CreateAsync(null, null, options);
            await webView21.EnsureCoreWebView2Async(environment);
            var view = webView21.CoreWebView2;
            view.Navigate("file:///D:/code/github/mdeditor/core/dist/index.html");
            view.DOMContentLoaded += View_DOMContentLoaded;
            view.WebMessageReceived += View_WebMessageReceived;
        }

        private void View_WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs args) {
            var content = args.WebMessageAsJson;
            var message = JsonConvert.DeserializeObject<Request>(content);
            HandleRequest(message);
            var view = webView21.CoreWebView2;
            view.PostWebMessageAsJson(JsonConvert.SerializeObject(message));
        }

        private void View_DOMContentLoaded(object sender, CoreWebView2DOMContentLoadedEventArgs e) {
            Debug.WriteLine("loaded");
        }

        private void HandleRequest(Request webMessage) {

        }

        private void OpenFile(string filePath) {
            _filePath = filePath;
            if (_watcher != null) _watcher.Dispose();
            _watcher = new FileSystemWatcher {
                Path = Path.GetDirectoryName(_filePath),
                Filter = Path.GetFileName(_filePath)
            };
            _watcher.Changed += new FileSystemEventHandler((object source, FileSystemEventArgs fe) => {
                OpenFile(_filePath);
            });
            _watcher.EnableRaisingEvents = true;

            string text = "";

            int NumberOfRetries = 10;
            int DelayOnRetry = 100;

            for (int i = 1; i <= NumberOfRetries; ++i) {
                try {
                    text = File.ReadAllText(_filePath);
                    break; // When done we can break loop
                } catch (IOException) when (i <= NumberOfRetries) {
                    Thread.Sleep(DelayOnRetry);
                }
            }
            var css = @"<link rel='stylesheet' href='http://markdowncss.github.io/retro/css/retro.css'>";
            RunUI(() => webView21.NavigateToString(text));
        }

        public void RunUI(Action action) {
            Invoke(new MethodInvoker(action));
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

        void CenterToScreen(Form form) {
            Rectangle workingArea = Screen.FromControl(form).WorkingArea;
            form.Width = Math.Min(workingArea.Width, form.Width);
            form.Height = Math.Min(workingArea.Height, form.Height);
            form.Location = new Point() {
                X = Math.Max(workingArea.X, workingArea.X + (workingArea.Width - form.Width) / 2),
                Y = Math.Max(workingArea.Y, workingArea.Y + (workingArea.Height - form.Height) / 2)
            };
        }

        public FormLocation Write(Form form) {
            form.Location = Location;
            form.WindowState = WindowState;
            form.Size = Size;
            if (WindowState == FormWindowState.Normal) {
                var workingArea = Screen.FromControl(form).WorkingArea;
                var formBounds = new Rectangle(form.Location, form.Size);
                if (!workingArea.Contains(formBounds)) {
                    CenterToScreen(form);
                }
            }
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

    class Request {
        readonly string _type_ = "Request";
        string id;
        string type;
        string message;
        string payload;
    }

    class Signal {
        readonly string _type_ = "Signal";
        string message;
    }

}

using Microsoft.Web.WebView2.Core;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SMarkdownReader {

    public partial class WebForm : Form {

        private readonly List<WebHandler> handlers = new List<WebHandler>();

        public void AddHandler(WebHandler handler) {
            handlers.Add(handler);
        }

        public WebForm() {
            InitializeComponent();
            webView21.CoreWebView2InitializationCompleted += WebViewInitialized;
            StartPosition = FormStartPosition.CenterScreen;
        }

        private void fireEvent(object sender, FormEvent e) {
            View.PostWebMessageAsJson(JsonConvert.SerializeObject(e));

        }

        private CoreWebView2 View {
            get {
                return webView21.CoreWebView2;
            }
        }

        private void WebViewInitialized(object sender, CoreWebView2InitializationCompletedEventArgs e) {
            View.PermissionRequested += (object _, CoreWebView2PermissionRequestedEventArgs ev) => {
                var def = ev.GetDeferral();
                ev.State = CoreWebView2PermissionState.Allow;
                ev.Handled = true;
                def.Complete();
            };
            foreach (var handler in handlers) {
                handler.form = this;
                handler.view = View;
                handler.Init();
            }
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
            //View.Navigate("file:///D:/code/github/mdeditor/core/dist/index.html"); 
            View.DOMContentLoaded += View_DOMContentLoaded;
            View.WebMessageReceived += View_WebMessageReceived;
            View.Navigate("http://localhost:4000/");
        }

        private void View_WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs args) {
            var content = args.WebMessageAsJson;
            var message = JsonConvert.DeserializeObject<Request>(content);
            HandleRequest(message);
            View.PostWebMessageAsJson(JsonConvert.SerializeObject(message));
        }

        private void View_DOMContentLoaded(object sender, CoreWebView2DOMContentLoadedEventArgs e) {
            Debug.WriteLine("loaded");
        }

        private void HandleRequest(Request request) {
            handlers.ForEach(h => {
                try {
                    h.HandleRequest(request);
                } catch (Exception e) {
                    Debug.WriteLine(e.Message);
                }
            });
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

    public class Request {
        public string _type_ = "Request";
        public string id;
        public string method;
        public string[] parameters;
        public string payload;
    }

    public class FormEvent {
        public string type;
        public string payload;
        public FormEvent(string type, object payload = null) {
            this.type = type;
            if (payload != null) {
                this.payload = JsonConvert.SerializeObject(payload);
            }
        }
    }

    public abstract class WebHandler {
        public Form form;
        public CoreWebView2 view;
        public abstract void Init();
        public abstract void HandleRequest(Request request);


        async protected Task<bool> FireEvent(string name) {
            var evt = new FormEvent(name);
            return await FireEvent(evt);
        }

        async protected Task<bool> FireEvent(FormEvent evt) {
            var script = string.Format("fireFormEvent('{0}')",
                JsonConvert.SerializeObject(evt));
            var ret = await view.ExecuteScriptAsync(script);
            return (ret == "true");
        }
    }
}

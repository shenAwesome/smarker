using Newtonsoft.Json;
using System;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Windows.Forms;

namespace SMarkdownReader {
    class CoreHandler : WebHandler {

        public object Home() {
            var UserProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            var ExecutablePath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            var UserName = System.Security.Principal.WindowsIdentity.GetCurrent().Name;
            var Args = Environment.GetCommandLineArgs();
            var MachineName = Environment.MachineName;
            var OSVersion = Environment.OSVersion.ToString();
            var LocalIPs = Dns.GetHostAddresses(Dns.GetHostName()).Select(x => x.ToString());
            var Culture = CultureInfo.CurrentUICulture.Name;
            return new { UserProfile, ExecutablePath, Args, UserName, MachineName, OSVersion, LocalIPs, Culture };
        }

        public string[] GetFiles(string path) {
            return Directory.GetFiles(path, "*.*", SearchOption.AllDirectories);
        }

        public void Mkdir(string path) {
            Directory.CreateDirectory(path);
        }

        public string ReadFile(string path) {
            return File.ReadAllText(path);
        }

        public void WriteFile(string path, string content) {
            File.WriteAllText(path, content);
        }

        public void Rename(string path, string newPath) {
            if (File.Exists(path)) {
                File.Move(path, newPath);
            }
            if (Directory.Exists(path)) {
                Directory.Move(path, newPath);
            }
        }

        public void Delete(string path) {
            if (File.Exists(path)) {
                File.Delete(path);
            }
            if (Directory.Exists(path)) {
                Directory.Delete(path, true);
            }
        }

        public void SetTitle(string title) {
            form.Text = title;
        }

        public override void HandleRequest(Request request) {
            var method = typeof(CoreHandler).GetMethod(request.method);
            if (method != null) {
                var ret = method.Invoke(this, request.parameters);
                request.payload = JsonConvert.SerializeObject(ret);
            }
        }

        private Form form;

        public override void Init(Form form) {
            this.form = form;
        }
    }
}

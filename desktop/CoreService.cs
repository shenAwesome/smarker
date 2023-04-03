using Newtonsoft.Json;
using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace SMarker {


    [ClassInterface(ClassInterfaceType.AutoDual)]
    [ComVisible(true)]
    public class CoreService : Service {

        public string[] Args;

        public CoreService() {
            var args = Environment.GetCommandLineArgs();
            if (args.Length == 1) args = new string[] { args[0], "" };
            Args = args;
        }

        public override void Init() {
            form.FormClosing += (object sender, FormClosingEventArgs e) => {
                if (!closeConfirmed) {
                    e.Cancel = true;
                    FireEvent("FormClosing");
                }
            };
        }
        bool closeConfirmed = false;

        public string Test() {
            return "hello";
        }

        public string Home() {
            var UserProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            var ExecutablePath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            var UserName = System.Security.Principal.WindowsIdentity.GetCurrent().Name;
            var MachineName = Environment.MachineName;
            var OSVersion = Environment.OSVersion.ToString();
            var LocalIPs = Dns.GetHostAddresses(Dns.GetHostName()).Select(x => x.ToString());
            var Culture = CultureInfo.CurrentUICulture.Name;
            return JsonConvert.SerializeObject(new {
                UserProfile, ExecutablePath, Args, UserName,
                MachineName, OSVersion, LocalIPs, Culture
            });
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

        public string WriteFile(string path, string content) {
            if (path == "") {
                SaveFileDialog saveFileDialog1 = new SaveFileDialog {
                    Filter = "Markdown File|*.md",
                    Title = "Save an Markdown File"
                };
                saveFileDialog1.ShowDialog();
                path = saveFileDialog1.FileName;
                Debug.WriteLine(path);
            }
            var noChange = File.Exists(path) && content == File.ReadAllText(path);
            if ((path != "") && !noChange) {
                File.WriteAllText(path, content);
            }
            return path;
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
            form.Opacity = 1;
        }

        public void CloseForm() {
            closeConfirmed = true;
            form.Close();
        }

        public void OpenURL(string url) {
            Process.Start(url);
        }
    }
}

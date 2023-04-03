using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Windows.Forms;
using XDMessaging;

namespace SMarker {
    internal static class Program {

        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main() {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            var service = new CoreService();
            var exeLoc = Assembly.GetExecutingAssembly().Location;
            var myProcess = Process.GetCurrentProcess();
            var processExists = Process.GetProcesses().Any(
                p => p.ProcessName.Equals(myProcess.ProcessName)
                && p.Id != myProcess.Id);
            var client = new XDMessagingClient();
            var channel = Path.GetFileNameWithoutExtension(exeLoc) + "+commands";

            if (processExists) {
                var path = service.Args[1];
                IXDBroadcaster broadcaster = client.Broadcasters
                    .GetBroadcasterForMode(XDTransportMode.HighPerformanceUI);
                broadcaster.SendToChannel(channel, "Reload:" + path);
            } else {
                var indexPage = "file://" + Path.Combine(Path.GetDirectoryName(exeLoc), "content/index.html");
                var isDebug = service.Args[0].Contains(@"bin\Debug");
                if (isDebug) indexPage = "http://localhost:4000/";

                var form = new WebForm {
                    isDebug = isDebug,
                    IndexPage = indexPage
                };

                IXDListener listener = client.Listeners.GetListenerForMode(XDTransportMode.HighPerformanceUI);
                listener.RegisterChannel(channel);
                listener.MessageReceived += (o, e) => {
                    if (e.DataGram.Channel == channel) {
                        var msg = e.DataGram.Message;
                        if (msg.StartsWith("Reload:")) {
                            form.BringToTop();
                            var path = msg.Replace("Reload:", "").Replace("\\", "/").Trim();
                            if (path.Length > 0) {
                                service.Args[1] = path;
                                service.FireEvent("Reload");
                            }
                        }
                    }
                };

                form.AddService("Core", service);
                Application.Run(form);

            }
        }
    }
}

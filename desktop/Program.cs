using System;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using XDMessaging;

namespace SMarkdownReader {
    internal static class Program {
        private static Mutex mutex = null;
        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main() {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            var coreHandler = new CoreHandler();

            var isDebug = false;
            var indexPage = "file://" + Path.Combine(Path.GetDirectoryName(
                Assembly.GetExecutingAssembly().Location), "content/index.html");

            if (coreHandler.Args.Length != 2) {
                coreHandler.Args = new string[] { "", @"D:\temp\test.md" };
                isDebug = true;
                indexPage = "http://localhost:4000/";
            }

            string appName = Path.GetFileNameWithoutExtension(Assembly.GetEntryAssembly().Location);
            mutex = new Mutex(true, appName, out bool firstInstance);
            XDMessagingClient client = new XDMessagingClient();
            var channel = appName + "+commands";
            if (firstInstance) {
                IXDListener listener = client.Listeners
                .GetListenerForMode(XDTransportMode.HighPerformanceUI);
                listener.RegisterChannel(channel);
                listener.MessageReceived += (o, e) => {
                    if (e.DataGram.Channel == channel) {
                        var msg = e.DataGram.Message;
                        if (msg.StartsWith("Reload:")) {
                            var path = msg.Replace("Reload:", "").Replace("\\", "/");
                            coreHandler.Args[1] = path;
                            coreHandler.FireEvent("Reload");
                        }
                    }
                };
                var form = new WebForm {
                    isDebug = isDebug,
                    IndexPage = indexPage
                };
                form.AddHandler(coreHandler);
                Application.Run(form);
            } else {
                var path = coreHandler.Args[1];
                IXDBroadcaster broadcaster = client.Broadcasters
                    .GetBroadcasterForMode(XDTransportMode.HighPerformanceUI);
                broadcaster.SendToChannel(channel, "Reload:" + path);
            }
        }
    }
}

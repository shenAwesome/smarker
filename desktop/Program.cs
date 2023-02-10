using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using XDMessaging;

namespace SMarkdownReader {
    internal static class Program {

        private static Mutex mutex = null;
        private static CoreHandler coreHandler = null;
        private static WebForm form = null;
        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main() {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

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
                        switch (e.DataGram.Message) {
                            case "reload":
                                //start(new String[] { });
                                break;
                        }
                    }
                };
            } else {
                IXDBroadcaster broadcaster = client.Broadcasters
                    .GetBroadcasterForMode(XDTransportMode.HighPerformanceUI);
                broadcaster.SendToChannel(channel, "reload");
                return;
            }
            form = new WebForm();
            coreHandler = new CoreHandler();
            form.AddHandler(coreHandler);
            Application.Run(form);
        }
    }
}

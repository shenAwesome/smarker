using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SMarkdownReader {
    internal static class Program {
        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main() {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            var home = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            var indexPage = Path.Combine(home, "content/index.html");
            var url = "http://localhost:4000/";
            if (File.Exists(indexPage)) {
                //url = "file:///" + indexPage;
            }
            var form = new WebForm(url);
            form.AddHandler(new CoreHandler());
            Application.Run(form);
        }
    }
}

using Markdig;
using Microsoft.Web.WebView2.Core;
using System;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace SMarkdownReader {
    public partial class Form1 : Form {
        private string _filePath;
        private FileSystemWatcher _watcher;
        private MarkdownPipeline _pipeline = new Markdig.MarkdownPipelineBuilder().UseAdvancedExtensions().Build();

        public Form1() {
            InitializeComponent();
            //ApplyTheme();
            //setupToolbar(); 
        }

        private void Form1_Load(object sender, EventArgs e) {
            InitializeAsync();
        }

        async void InitializeAsync() {
            var options = new CoreWebView2EnvironmentOptions("--allow-file-access-from-files");
            var environment = await CoreWebView2Environment.CreateAsync(null, null, options);
            await webView21.EnsureCoreWebView2Async(environment);
            webView21.CoreWebView2.SetVirtualHostNameToFolderMapping("home",
                    @"D:\temp\", CoreWebView2HostResourceAccessKind.Allow);

            OpenFile(@"D:\temp\test.md");
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
            //webBrowser1.DocumentText = Markdig.Markdown.ToHtml(text, _pipeline);

            //webView21.  .DocumentText = text; 
            RunUI(() => webView21.NavigateToString(text));
        }

        public void RunUI(Action action) {
            Invoke(new MethodInvoker(action));
        }

        public void setupToolbar() {
            var imgSize = 16;
            var height = 28;

            toolStrip1.AutoSize = false;
            toolStrip1.Height = height;

            toolStripButton1.AutoSize = false;
            toolStripButton1.Width = height - 2;
            toolStripButton1.Height = height - 2;

            //resize the image of the button to the new size
            int sourceWidth = toolStripButton1.Image.Width;
            int sourceHeight = toolStripButton1.Image.Height;
            Bitmap b = new Bitmap(imgSize, imgSize);
            using (Graphics g = Graphics.FromImage((Image)b)) {
                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                g.DrawImage(toolStripButton1.Image, 0, 0, imgSize, imgSize);
            }
            Image myResizedImg = (Image)b;

            //put the resized image back to the button and change toolstrip's ImageScalingSize property 
            toolStripButton1.Image = myResizedImg;
            toolStrip1.ImageScalingSize = new Size(imgSize, imgSize);
        }
    }
}

using System;
using System.IO;
using System.Threading;

public static class DesktopLaunchProbe
{
    [STAThread]
    public static void Main()
    {
        File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "launched.marker"), Directory.GetCurrentDirectory());
        Thread.Sleep(3000);
    }
}

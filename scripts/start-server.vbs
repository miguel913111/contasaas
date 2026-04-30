' Start Next.js server silently
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\xampp\htdocs\SAAS CONTABILISTICO"
WshShell.Run "cmd /c npm start", 0, False
Set WshShell = Nothing

' Start Prisma Studio silently
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\xampp\htdocs\SAAS CONTABILISTICO"
WshShell.Run "cmd /c npx prisma studio --port 5555", 0, False
Set WshShell = Nothing

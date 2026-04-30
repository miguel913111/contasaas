' Stop Next.js and Prisma Studio servers
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "taskkill /F /IM node.exe", 0, True
Set WshShell = Nothing

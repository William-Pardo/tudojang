# Engram Bank Instructions

This project uses the central Engram memory bank at:

```text
E:\Apps\ENGRAM-BANK
```

Before meaningful work:

```powershell
cd E:\Apps\ENGRAM-BANK
.\scripts\Ensure-Engram.ps1
git pull
.\scripts\Sync-EngramBank.ps1 -Import
```

After meaningful work:

```powershell
cd E:\Apps\ENGRAM-BANK
.\scripts\Sync-EngramBank.ps1 -All -Push
```

Preferred local Engram installation on this PC:

```text
E:\Apps\engram\bin\engram.exe
E:\Apps\engram\data\engram.db
```

If `E:\Apps\engram\bin\engram.exe` is missing, install/build Engram from:

```text
https://github.com/Gentleman-Programming/engram
```

Do not commit the live Engram database. Commit only `.engram/` sync exports.



## Imported Claude Cowork project instructions

# Launcher path fix

This revision fixes startup failure:

`Cannot bind argument to parameter 'LiteralPath' because it is an empty string.`

Changes:
- `START-CBAI.cmd` now passes the extracted project folder explicitly.
- `Start-Docker.ps1` no longer calls `Resolve-Path` with a potentially empty value.
- The script falls back safely to the script folder or current directory.
- Error messages identify an invalid project folder before Docker commands run.

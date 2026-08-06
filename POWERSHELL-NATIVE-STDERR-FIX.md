# Windows PowerShell native stderr fix

Fixed false startup failure where Docker Compose printed:

```text
Image cbai-mvp-app Building
```

Windows PowerShell 5.1 can represent normal native stderr output as an
`ErrorRecord`. Because the launcher uses `ErrorActionPreference = Stop`, the
status line was incorrectly treated as a terminating error before Docker
returned an exit code.

The launcher now:

- temporarily uses `Continue` only around native process output;
- writes stdout and stderr visibly and into the startup log;
- restores the strict error preference immediately afterwards;
- treats the real native process exit code as the success/failure signal;
- preserves full BuildKit output for any genuine build error.

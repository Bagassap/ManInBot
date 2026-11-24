
!macro customUnInstall
  IfSilent brainKeep
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION "Hapus juga otak MiB (mesin AI dan model, beberapa GB) dari komputer ini?" IDNO brainKeep
    nsExec::Exec 'powershell.exe -NoProfile -NonInteractive -Command "Get-Process ollama -ErrorAction SilentlyContinue | Where-Object { $$_.Path -like \"$$env:LOCALAPPDATA\MiB\*\" } | Stop-Process -Force"'
    Pop $0
    RMDir /r "$LOCALAPPDATA\MiB"
  ${endIf}
  brainKeep:
!macroend

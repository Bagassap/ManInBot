; Halaman "Pilih otak MiB" di pemasang, lalu pemasangan Ollama + model untuk pengguna ini.
; Pilihan awal: hasil cek PC. Nama berkas dari halaman unduh (MiB-Setup-sedang.exe) mendahuluinya.

!ifndef BUILD_UNINSTALLER
!include nsDialogs.nsh
!include LogicLib.nsh

Var BrainTier
Var BrainInfo
Var BrainR1
Var BrainR2
Var BrainR3

; Masukan: $R1 = teks, $R2 = yang dicari. Keluaran: $R0 = posisi atau -1.
Function BrainFind
  StrLen $R3 $R2
  StrCpy $R0 0
  loop:
    StrCpy $R4 $R1 $R3 $R0
    StrCmp $R4 $R2 done
    StrCmp $R4 "" none
    IntOp $R0 $R0 + 1
    Goto loop
  none:
    StrCpy $R0 -1
  done:
FunctionEnd

Function BrainDetect
  StrCmp $BrainTier "" 0 end
  InitPluginsDir
  File "/oname=$PLUGINSDIR\setup-brain.ps1" "${BUILD_RESOURCES_DIR}\setup-brain.ps1"
  nsExec::ExecToStack 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\setup-brain.ps1" -Detect'
  Pop $R5
  Pop $R1
  StrCpy $BrainTier "sedang"
  StrCpy $BrainInfo "Spesifikasi PC tidak terbaca."
  StrCmp $R5 "0" 0 fromName
  StrCpy $R2 "|"
  Call BrainFind
  IntCmp $R0 0 fromName fromName
  StrCpy $BrainTier $R1 $R0
  IntOp $R0 $R0 + 1
  StrCpy $BrainInfo $R1 "" $R0
  fromName:
  StrCpy $BrainInfo "Terdeteksi: $BrainInfo"
  StrCpy $R1 $EXEFILE
  StrCpy $R2 "-ringan"
  Call BrainFind
  IntCmp $R0 0 0 +2
  StrCpy $BrainTier "ringan"
  StrCpy $R2 "-sedang"
  Call BrainFind
  IntCmp $R0 0 0 +2
  StrCpy $BrainTier "sedang"
  StrCpy $R2 "-kuat"
  Call BrainFind
  IntCmp $R0 0 0 +2
  StrCpy $BrainTier "kuat"
  end:
FunctionEnd

Function BrainPageShow
  Call BrainDetect
  ; Berkas ini dimuat sebelum MUI, jadi judul halaman diisi langsung ke kontrolnya.
  GetDlgItem $0 $HWNDPARENT 1037
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Pilih otak MiB"
  GetDlgItem $0 $HWNDPARENT 1038
  SendMessage $0 ${WM_SETTEXT} 0 "STR:MiB bekerja offline. Pilih model sesuai komputer Anda."
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 14u "$BrainInfo"
  Pop $0
  ${NSD_CreateRadioButton} 0 20u 100% 14u "Ringan: untuk Core i3 / Ryzen 3 (unduh sekitar 3 GB, RAM 4-8 GB)"
  Pop $BrainR1
  ${NSD_CreateRadioButton} 0 38u 100% 14u "Sedang: untuk Core i5 / Ryzen 5 (unduh sekitar 4 GB, RAM 8 GB ke atas)"
  Pop $BrainR2
  ${NSD_CreateRadioButton} 0 56u 100% 14u "Kuat: untuk Core i7 / Ryzen 7 (unduh sekitar 7 GB, RAM 16 GB ke atas)"
  Pop $BrainR3
  ${If} $BrainTier == "ringan"
    ${NSD_Check} $BrainR1
  ${ElseIf} $BrainTier == "kuat"
    ${NSD_Check} $BrainR3
  ${Else}
    ${NSD_Check} $BrainR2
  ${EndIf}
  ${NSD_CreateLabel} 0 80u 100% 34u "Mesin AI dan model diunduh sekali saat pemasangan, jadi perlu internet dan bisa memakan waktu. Setelah itu MiB berjalan tanpa internet dan data Anda tidak keluar dari komputer ini."
  Pop $0
  nsDialogs::Show
FunctionEnd

Function BrainPageLeave
  ${NSD_GetState} $BrainR1 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $BrainTier "ringan"
  ${EndIf}
  ${NSD_GetState} $BrainR2 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $BrainTier "sedang"
  ${EndIf}
  ${NSD_GetState} $BrainR3 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $BrainTier "kuat"
  ${EndIf}
FunctionEnd
!endif

!macro customPageAfterChangeDir
  Page custom BrainPageShow BrainPageLeave
!macroend

!macro customInstall
  ; Mode senyap tidak memasang otak: aplikasi menawarkannya saat pertama dibuka.
  IfSilent brainSkip
  StrCmp $BrainTier "" 0 +2
  StrCpy $BrainTier "auto"
  DetailPrint "Memasang otak MiB ($BrainTier). Jendela kemajuan terbuka; mohon tunggu."
  ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\brain\setup-brain.ps1" -Tier $BrainTier' $0
  StrCmp $0 "0" brainSkip
  MessageBox MB_OK|MB_ICONINFORMATION "Otak MiB belum selesai dipasang (misalnya koneksi terputus). Pemasangan MiB tetap lanjut. Buka MiB, lalu klik Pasang untuk melanjutkan unduhan."
  brainSkip:
!macroend

!macro customUnInstall
  ; Saat pembaruan, otak dan model tetap ada.
  IfSilent brainKeep
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION "Hapus juga otak MiB (mesin AI dan model, beberapa GB) dari komputer ini?" IDNO brainKeep
    nsExec::Exec 'powershell.exe -NoProfile -NonInteractive -Command "Get-Process ollama -ErrorAction SilentlyContinue | Where-Object { $$_.Path -like \"$$env:LOCALAPPDATA\MiB\*\" } | Stop-Process -Force"'
    Pop $0
    RMDir /r "$LOCALAPPDATA\MiB"
  ${endIf}
  brainKeep:
!macroend

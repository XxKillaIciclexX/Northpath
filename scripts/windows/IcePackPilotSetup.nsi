Unicode true
!include "MUI2.nsh"
!include "x64.nsh"

!ifdef STREAMER_SETUP
!define PRODUCT "Ice Pack Companion Streamer"
!define INSTALL_PARENT "$LOCALAPPDATA\IcePackCompanionStreamer"
!define INSTALL_FOLDER "${INSTALL_PARENT}\app"
!define SHORTCUT "$SMPROGRAMS\${PRODUCT}.lnk"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\IcePackCompanionStreamer"
!else
!define PRODUCT "Ice Pack Companion Pilot"
!define INSTALL_PARENT "$LOCALAPPDATA\IcePackCompanionPilot"
!define INSTALL_FOLDER "${INSTALL_PARENT}\v${PILOT_VERSION}"
!define SHORTCUT "$SMPROGRAMS\${PRODUCT} ${PILOT_VERSION}.lnk"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\IcePackCompanionPilot-${PILOT_VERSION}"
!endif

Name "${PRODUCT} ${PILOT_VERSION}"
OutFile "${SETUP_FILE}"
InstallDir "${INSTALL_FOLDER}"
RequestExecutionLevel user
SetCompressor /SOLID lzma
VIProductVersion "${PILOT_VERSION}.0.0"
VIAddVersionKey "ProductName" "${PRODUCT}"
VIAddVersionKey "FileDescription" "${PRODUCT} Windows setup"
VIAddVersionKey "FileVersion" "${PILOT_VERSION}.0.0"
VIAddVersionKey "CompanyName" "Northpath"
VIAddVersionKey "LegalCopyright" "Northpath"

!define MUI_WELCOMEPAGE_TEXT "Install ${PRODUCT} for this Windows user. It includes its own Node.js runtime. Open it from the Start menu after setup."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "This setup requires 64-bit Windows."
    Abort
  ${EndIf}
  SetRegView 64
  SetShellVarContext current
  StrCpy $INSTDIR "${INSTALL_FOLDER}"
  IfFileExists "$INSTDIR\*.*" 0 ready
  MessageBox MB_ICONSTOP "This app is already installed. Open it from the Start menu or uninstall it before reinstalling."
  Abort
  ready:
FunctionEnd

Section "Install Companion"
  CreateDirectory "${INSTALL_PARENT}"
  ClearErrors
  GetTempFileName $0 "${INSTALL_PARENT}"
  IfErrors failed
  Delete "$0"
  CreateDirectory "$0"
  SetOutPath "$0"
  ClearErrors
  File /r "${PAYLOAD_FILES}"
  IfErrors cleanup
  WriteUninstaller "$0\Uninstall.exe"
  IfErrors cleanup
  SetOutPath "${INSTALL_PARENT}"
  Rename "$0" "$INSTDIR"
  IfErrors cleanup

  SetOutPath "$INSTDIR"
  !ifdef STREAMER_SETUP
  CreateShortCut "${SHORTCUT}" "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" '-NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "$INSTDIR\scripts\Open-IcePackControlCenter.ps1"' "$INSTDIR\runtime\node.exe"
  !else
  CreateShortCut "${SHORTCUT}" "$INSTDIR\runtime\node.exe" '"$INSTDIR\Start-IcePackPilot.mjs"'
  !endif
  IfErrors rollback
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${PRODUCT} ${PILOT_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "Northpath"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${PILOT_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
  IfErrors rollback
  Goto done

  rollback:
    SetOutPath "${INSTALL_PARENT}"
    Delete "${SHORTCUT}"
    DeleteRegKey HKCU "${UNINSTALL_KEY}"
    RMDir /r "$INSTDIR"
    Goto failed
  cleanup:
    SetOutPath "${INSTALL_PARENT}"
    RMDir /r "$0"
  failed:
    SetErrorLevel 1
    Abort "Setup could not install ${PRODUCT}."
  done:
SectionEnd

Function un.onInit
  SetRegView 64
  SetShellVarContext current
  ${If} $INSTDIR != "${INSTALL_FOLDER}"
    MessageBox MB_ICONSTOP "Open the Companion uninstaller from Windows Installed apps."
    Abort
  ${EndIf}
FunctionEnd

Section "Uninstall"
  SetOutPath "${INSTALL_PARENT}"
  Delete "$INSTDIR\runtime\node.exe"
  IfFileExists "$INSTDIR\runtime\node.exe" running
  ClearErrors
  RMDir /r "$INSTDIR"
  IfErrors running
  Delete "${SHORTCUT}"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  RMDir "${INSTALL_PARENT}"
  Goto done
  running:
    SetErrorLevel 1
    Abort "Stop Companion from its app window, close the window, then retry uninstall."
  done:
SectionEnd

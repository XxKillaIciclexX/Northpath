Unicode true
!include "MUI2.nsh"
!include "x64.nsh"

!define PRODUCT "Ice Pack Companion Pilot"
!define INSTALL_FOLDER "$LOCALAPPDATA\IcePackCompanionPilot\v${PILOT_VERSION}"
!define SHORTCUT "$SMPROGRAMS\${PRODUCT} ${PILOT_VERSION}.lnk"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\IcePackCompanionPilot-${PILOT_VERSION}"

Name "${PRODUCT} ${PILOT_VERSION}"
OutFile "${SETUP_FILE}"
InstallDir "${INSTALL_FOLDER}"
RequestExecutionLevel user
SetCompressor /SOLID lzma
VIProductVersion "${PILOT_VERSION}.0.0"
VIAddVersionKey "ProductName" "${PRODUCT}"
VIAddVersionKey "FileDescription" "Ice Pack Companion Windows pilot setup"
VIAddVersionKey "FileVersion" "${PILOT_VERSION}.0.0"
VIAddVersionKey "CompanyName" "Northpath"
VIAddVersionKey "LegalCopyright" "Northpath"

!define MUI_WELCOMEPAGE_TEXT "Install the Ice Pack Companion preview for this Windows user. It includes its own Node.js runtime. Open it from the Start menu after setup."
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
  MessageBox MB_ICONSTOP "This pilot version is already installed. Open it from the Start menu or uninstall it before reinstalling."
  Abort
  ready:
FunctionEnd

Section "Install Pilot"
  CreateDirectory "$LOCALAPPDATA\IcePackCompanionPilot"
  ClearErrors
  GetTempFileName $0 "$LOCALAPPDATA\IcePackCompanionPilot"
  IfErrors failed
  Delete "$0"
  CreateDirectory "$0"
  SetOutPath "$0"
  ClearErrors
  File /r "${PAYLOAD_DIR}/*"
  IfErrors cleanup
  WriteUninstaller "$0\Uninstall.exe"
  IfErrors cleanup
  SetOutPath "$LOCALAPPDATA\IcePackCompanionPilot"
  Rename "$0" "$INSTDIR"
  IfErrors cleanup

  SetOutPath "$INSTDIR"
  CreateShortCut "${SHORTCUT}" "$INSTDIR\runtime\node.exe" '"$INSTDIR\Start-IcePackPilot.mjs"'
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
    SetOutPath "$LOCALAPPDATA\IcePackCompanionPilot"
    Delete "${SHORTCUT}"
    DeleteRegKey HKCU "${UNINSTALL_KEY}"
    RMDir /r "$INSTDIR"
    Goto failed
  cleanup:
    SetOutPath "$LOCALAPPDATA\IcePackCompanionPilot"
    RMDir /r "$0"
  failed:
    SetErrorLevel 1
    Abort "Setup could not install the pilot."
  done:
SectionEnd

Function un.onInit
  SetRegView 64
  SetShellVarContext current
  ${If} $INSTDIR != "${INSTALL_FOLDER}"
    MessageBox MB_ICONSTOP "Open the pilot uninstaller from Windows Installed apps."
    Abort
  ${EndIf}
FunctionEnd

Section "Uninstall"
  SetOutPath "$LOCALAPPDATA\IcePackCompanionPilot"
  Delete "$INSTDIR\runtime\node.exe"
  IfFileExists "$INSTDIR\runtime\node.exe" running
  ClearErrors
  RMDir /r "$INSTDIR"
  IfErrors running
  Delete "${SHORTCUT}"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  RMDir "$LOCALAPPDATA\IcePackCompanionPilot"
  Goto done
  running:
    SetErrorLevel 1
    Abort "Stop the pilot from its launcher window, then retry uninstall."
  done:
SectionEnd

; Custom NSIS script for Helios Launcher
; Prevents deletion of user data (Java, mods, instances) during updates
; electron-builder calls customRemoveFiles instead of "RMDir /r $INSTDIR"

!macro customRemoveFiles
  ; Delete all FILES in the install directory (exe, dll, pak, dat, bin, etc.)
  ; but DO NOT recursively delete subdirectories that may contain user data

  FindFirst $0 $1 "$INSTDIR\*.*"
  loop:
    StrCmp $1 "" done
    StrCmp $1 "." next
    StrCmp $1 ".." next

    ; Check if this is a directory
    IfFileExists "$INSTDIR\$1\*.*" checkDir deleteFile

    deleteFile:
      Delete "$INSTDIR\$1"
      Goto next

    checkDir:
      ; Only remove known Electron app directories, preserve everything else
      StrCmp $1 "resources" removeDir
      StrCmp $1 "locales" removeDir
      StrCmp $1 "swiftshader" removeDir
      ; Everything else (common, instances, java, etc.) is preserved
      Goto next

    removeDir:
      RMDir /r "$INSTDIR\$1"

    next:
      FindNext $0 $1
      Goto loop
  done:
  FindClose $0

  ; Only removes install dir if it's completely empty (user data = not empty = safe)
  RMDir "$INSTDIR"
!macroend

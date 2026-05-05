# -*- mode: python ; coding: utf-8 -*-
"""
build.spec — PyInstaller spec for TeleRadAgent.exe
Single-file, no-console (Windows Service friendly), ~20MB output.
"""

import sys
from pathlib import Path

block_cipher = None

a = Analysis(
    ["agent/__main__.py"],
    pathex=[str(Path(".").resolve())],
    binaries=[],
    datas=[
        ("sql/enable_cdc.sql", "sql"),
        ("config.yaml.example", "."),
    ],
    hiddenimports=[
        "apscheduler.schedulers.blocking",
        "apscheduler.executors.pool",
        "apscheduler.jobstores.memory",
        "pyodbc",
        "click",
        "httpx",
        "yaml",
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "numpy", "PIL"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="TeleRadAgent",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,        # True so NSSM can capture stdout/stderr to log files
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

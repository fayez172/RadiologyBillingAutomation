"""
__main__.py — PyInstaller entry point.
Allows running as: python -m agent  OR  TeleRadAgent.exe
"""

from agent.main import cli

if __name__ == "__main__":
    cli()

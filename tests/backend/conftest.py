import sys
from pathlib import Path

BACKEND_DIRECTORY = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND_DIRECTORY))

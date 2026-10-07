"""Run manual browser QA through the installed Codex Playwright CLI skill.
Start npm run dev first. Uses the isolated default Playwright CLI session.
"""
from pathlib import Path
import subprocess

wrapper = Path.home() / '.codex/skills/playwright/scripts/playwright_cli.sh'
root = Path(__file__).resolve().parent.parent
(root / 'output/playwright').mkdir(parents=True, exist_ok=True)
subprocess.run(['bash', str(wrapper), 'open', 'http://localhost:3000'], cwd=root, check=True)
source = (root / 'scripts/browser-qa.js').read_text().strip().removesuffix(';')
subprocess.run(['bash', str(wrapper), 'run-code', source], cwd=root, check=True)

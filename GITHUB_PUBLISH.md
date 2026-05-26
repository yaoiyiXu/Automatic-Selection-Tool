# Publish To GitHub

This folder is ready to publish, but this machine currently does not expose a working `git` command in the terminal.

After installing Git, run:

```bash
cd C:\Users\PC\Documents\自动选片程序\auto-photo-picker
git init
git add .
git commit -m "Add auto photo picker demo"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

The `.gitignore` file excludes local virtual environments, uploaded photos, exported selections, and API secrets.

## Skill

The Codex skill is included at:

```text
codex-skills\auto-photo-picker-demo
```

To install it on another device, copy that folder into the target device's Codex skills directory:

```text
%USERPROFILE%\.codex\skills\auto-photo-picker-demo
```

Then restart Codex.

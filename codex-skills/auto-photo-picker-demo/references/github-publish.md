# GitHub Publishing Notes

Before publishing, make sure the repository excludes:

```text
backend/venv/
backend/uploads/
backend/selected_exports/
backend/__pycache__/
*.pyc
.env
```

Recommended first commit:

```bash
git init
git add .
git commit -m "Add auto photo picker demo"
git branch -M main
git remote add origin <repo-url>
git push -u origin main
```

Do not commit API keys or uploaded client photos.

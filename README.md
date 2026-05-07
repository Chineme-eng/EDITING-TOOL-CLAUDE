# ⬡ editr — Your Free Personal Media Editor

A free, private, unlimited screenshot and video editor that runs entirely in your browser.
**Nothing ever leaves your device.**

## ✨ Features

### Annotation Tools
- ✏️ **Freehand Pen** — draw freely on images
- ▌ **Highlighter** — semi-transparent highlight over content
- ◻ **Eraser** — remove annotations by clicking them
- → **Arrows** — point things out with sharp, clean arrows
- ╱ **Lines** — straight lines with custom thickness
- ▭ **Rectangles** — outline boxes
- ○ **Circles / Ellipses** — circular outlines
- 💬 **Callout Bubbles** — speech bubble with custom text
- T **Text** — add labels, with bold/italic/background options
- ⬡ **Blur / Redact** — gaussian blur OR pixelate to hide sensitive info
- ① **Step Numbers** — auto-numbered circles for tutorials
- ★ **Emoji Stamps** — drop emoji anywhere

### Image Adjustments
- Brightness, Contrast, Saturation sliders
- Rotate (90° left/right)
- Flip Horizontal / Vertical
- **Crop** — draw to crop any region

### Selection & Layers
- Click any object to select it
- Move objects by dragging
- Bring Forward / Send Back
- Duplicate any object
- Delete with Delete key or trash button
- Unlimited **Undo / Redo** (Ctrl+Z / Ctrl+Y)

### Export
- Download as **PNG**, **JPG**, or **WebP**
- Files save directly to your laptop — no cloud, no accounts

### Video Support
- Load MP4, WebM, MOV files
- Scrub through timeline
- Annotate frames
- Play/pause controls

### Extras
- **Paste from clipboard** (Ctrl+V) — instantly load screenshots
- Drag & drop files onto the upload zone
- Works 100% offline after first load

---

## 🚀 Deploy to GitHub Pages (Free Hosting)

### Step 1 — Create a GitHub Repo
1. Go to [github.com](https://github.com) → click **New repository**
2. Name it `editr` (or anything you like)
3. Set it to **Public**
4. Click **Create repository**

### Step 2 — Upload the Files
Option A — GitHub web interface:
1. Click **uploading an existing file**
2. Drag and drop all files keeping the folder structure:
   ```
   index.html
   css/style.css
   js/editor.js
   ```
3. Click **Commit changes**

Option B — Git CLI:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/editr.git
git push -u origin main
```

### Step 3 — Enable GitHub Pages
1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select `main` branch, `/ (root)` folder
3. Click **Save**
4. Wait ~60 seconds, then visit: `https://YOUR_USERNAME.github.io/editr`

That's it! Your editor is live, free, forever. ✓

---

## 💻 Run Locally (No Internet Needed)
Just open `index.html` in any modern browser. No server needed.

---

## 🛠 Tech Stack
- Vanilla HTML5, CSS3, JavaScript (no frameworks, no dependencies)
- HTML5 Canvas API for rendering
- Web APIs: File, Blob, Clipboard, URL

## 📁 File Structure
```
editr/
├── index.html       # Main app
├── css/
│   └── style.css    # All styles
├── js/
│   └── editor.js    # All editor logic
└── README.md
```

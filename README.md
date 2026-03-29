# 🎯 Assessment Filler — Chrome Extension

> A Chrome extension that instantly auto-fills NFPE assessment forms with a single click, saving time by randomly selecting grades and future steps across all units in a cycle.

![Version](https://img.shields.io/badge/version-2.0.0-blueviolet?style=flat-square)
![Manifest](https://img.shields.io/badge/manifest-v3-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Chrome-yellow?style=flat-square)

---

## 📖 Overview

**Assessment Filler** is a Chrome extension built to automate the repetitive process of filling out NFPE (National Framework for Professional Excellence) assessment forms. Instead of manually selecting grades and future steps for every unit, this extension handles it all — intelligently, safely, and in seconds.

It iterates through every available unit in a selected cycle, fills in randomized grades (A+ or A) and future steps (from the first 2 options), submits each assessment, and waits for a confirmation before moving to the next — all without touching navigation or sidebar elements.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎯 **Smart Grade Picker** | Randomly selects **A+** or **A** for every assessment question |
| 📋 **Future Steps Automation** | Picks from the **first 2 options** only for each future step field |
| 🔒 **Safe Zone Awareness** | Sidebar, Cycle & Unit selectors are **never touched** |
| ✅ **Green Tick Confirmation** | Waits for visual confirmation before proceeding to the next unit |
| 🔄 **Full Cycle Iteration** | Automatically loops through **all units** in the selected cycle |
| ⚡ **One-Click Trigger** | Single click on the extension icon to start the entire process |
| 🔁 **Reset Capability** | Instantly resets all filled selections with the Reset button |

---

## 🏗️ Project Structure

```
random-picker-extension/
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Service worker — core automation logic
├── popup.html          # Extension popup UI
├── popup.css           # Popup styles
├── popup.js            # Popup interaction logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🚀 Installation (Load Unpacked)

Since this extension is not published on the Chrome Web Store, you can install it manually:

1. **Clone or Download** this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/assessment-filler.git
   ```

2. **Open Chrome** and navigate to:
   ```
   chrome://extensions/
   ```

3. **Enable Developer Mode** using the toggle in the top-right corner.

4. Click **"Load unpacked"** and select the project folder (`random-picker-extension/`).

5. The **Assessment Filler** icon will appear in your Chrome toolbar. 🎉

---

## 🛠️ How to Use

1. Navigate to your **NFPE Assessment page** in Chrome.
2. Select your desired **Cycle** and **Unit** from the page.
3. Click the **Assessment Filler** extension icon in the toolbar.
4. The popup will **scan the page** and show the number of questions detected.
5. Click **"Fill Assessment"** — the extension will:
   - Randomly fill all grade dropdowns with **A+** or **A**
   - Select a future step from the **first 2 available options**
   - **Submit** the assessment
   - Wait for the **green tick** confirmation
   - **Move to the next unit** and repeat
6. Use **"Reset All Selections"** at any time to clear filled values.

---

## ⚙️ Permissions

| Permission | Reason |
|---|---|
| `activeTab` | To interact with the currently open assessment page |
| `scripting` | To inject the auto-fill logic into the page |
| `host_permissions: <all_urls>` | To work across different NFPE portal URLs |

---

## 🧰 Tech Stack

- **JavaScript** — Core automation & popup logic
- **HTML/CSS** — Popup UI with Inter font & gradient design
- **Chrome Extension Manifest V3** — Service Worker architecture
- **Chrome Scripting API** — For DOM interaction on assessment pages

---

## 📌 Notes

- This extension is intended for **personal/internal use** with NFPE assessment platforms.
- It does **not** store, transmit, or collect any user data.
- Always ensure you are on the correct assessment page before triggering the fill.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">Made with ❤️ to automate the boring stuff.</p>

# ElevenLabs Voice Studio — Text-to-Speech Web App

A modern, responsive, and secure Text-to-Speech (TTS) web application built strictly with **pure HTML5, CSS3, and vanilla JavaScript (ES6+)**—with zero frameworks, zero external libraries, zero backend code, and zero build tools required.

Powered directly by the official [ElevenLabs API](https://elevenlabs.io).

---

## 🌟 Key Features

1. **Text Input & Live Counter**:
   - Resizable textarea supporting up to **2,500 characters**.
   - Real-time character counter showing current count and dynamic warning highlights as the limit is approached.

2. **Two-State API Key Security Management**:
   - **State A (Unconfigured)**:
     - Clear input field with live verification.
     - Performs a test request against `GET https://api.elevenlabs.io/v1/voices` using the `xi-api-key` header to verify your key before saving.
     - Displays inline error messaging if invalid (e.g., 401 Unauthorized, 429 Quota Exceeded, or network errors).
   - **State B (Locked Key Box)**:
     - The verified key is displayed visibly in a locked box (`pointer-events: none; user-select: none; -webkit-user-select: none; cursor: not-allowed;`).
     - Event listeners actively intercept and block `copy`, `cut`, `contextmenu` (right click), `selectstart`, `dragstart`, and keyboard interactions on the key display.
     - No show/hide toggle.
     - Includes a dedicated **"Remove Key"** button outside the locked box to wipe the key from `localStorage` and switch back to State A.
     - Keys are preserved in browser `localStorage` and automatically restored on page reloads.
     - **Zero hardcoded credentials**: The codebase contains no default or hardcoded keys.

3. **Dynamic Voice Dropdown**:
   - Populated directly from `GET https://api.elevenlabs.io/v1/voices`.
   - Voice names include accents and descriptive tags where available.
   - Automatically remembers your last selected voice in `localStorage`.

4. **Interactive Fine-Tuning Sliders**:
   - **Stability (0.00 – 1.00)**: Adjusts consistency vs. emotional expressiveness with live value readout.
   - **Similarity Boost (0.00 – 1.00)**: Fine-tunes audio fidelity to the original voice sample with live value readout.

5. **AI Model Selection**:
   - **Eleven Multilingual v2** (`eleven_multilingual_v2`): Default high-fidelity model supporting 29+ languages including English, Hindi, Spanish, French, German, Japanese, and more.
   - **Eleven Flash v2.5** (`eleven_flash_v2_5`): Optimized for ultra-low latency generation.

6. **Speech Synthesis & Media Player**:
   - Calls `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` with requested model and voice settings.
   - Streams audio response as an `audio/mpeg` Blob, rendered seamlessly into an accessible `<audio controls>` player using `URL.createObjectURL`.
   - Automatically revokes stale Object URLs to prevent browser memory leaks.

7. **MP3 Export**:
   - Dedicated **"Download MP3"** button providing instantaneous file download named with voice and timestamp (e.g. `elevenlabs_rachel_2026-10-09.mp3`).

8. **Session History (Last 5 Generations)**:
   - Tracks the last 5 speech clips in the current browsing session.
   - Shows text snippet preview, voice used, and generation time.
   - One-click **"Replay"** button instantly plays any past clip in the main player.
   - Discards oldest generations with automatic URL cleanup once the 5-item limit is reached.

9. **Robust Inline Error Handling & Accessibility**:
   - No obstructive `alert()` dialogs. Inline, human-friendly status banners and field alerts for:
     - Empty text submissions
     - Missing API keys
     - 401 Invalid credentials
     - 429 Quota or rate limits
     - Offline or connection errors
   - Accessible ARIA attributes (`role="alert"`, `aria-live="polite"`, semantic `<label>` associations).
   - High-contrast visible focus rings and WCAG-compliant dark theme styling.

---

## 🔑 How to Get an ElevenLabs API Key

To use this application, you will need a personal API key from ElevenLabs:

1. Visit [elevenlabs.io](https://elevenlabs.io) and sign up or log in.
2. Click on your **Profile icon** located in the bottom-left corner of the dashboard.
3. Select **Profile + API key** (or navigate to **Developers → API Keys**).
4. Click **"Create API Key"** (or click the menu next to an existing key and select **"Rotate key"**).
5. A modal dialog will appear revealing your **secret API key** starting with **`sk_`** (e.g., `sk_...`). Click **Copy** immediately.
   > **Note:** Do *not* copy the "Key ID" from the dashboard list. ElevenLabs requires the actual secret key (`sk_...`).
6. Paste your `sk_...` key into the **Voice Studio** input field and click **Save Key**.

---

## 🚀 How to Run the Website

Because this project is built entirely with standard web technologies, there are **no installation steps, npm packages, or build processes**.

### Option 1: Direct Browser Launch
1. Open the project folder (`c:\chatbot`).
2. Double-click `index.html` to open it in your default web browser (Chrome, Edge, Firefox, Safari).

### Option 2: Using Any Lightweight Local Server (Recommended)
Running through a local web server provides the best media and fetch compatibility:

- **Using Python 3**:
  ```bash
  python -m http.server 8000
  ```
  Open `http://localhost:8000` in your browser.

- **Using Node.js (`npx serve`)**:
  ```bash
  npx serve .
  ```

- **Using VS Code Live Server**:
  Right-click `index.html` in VS Code and choose **"Open with Live Server"**.

---

## 📁 File Structure

```
c:\chatbot/
├── index.html   # Semantic HTML5 layout, ARIA live regions, form controls, audio player
├── style.css    # Modern dark theme, CSS variables, glassmorphism, responsive queries
├── script.js    # Vanilla JS logic, ElevenLabs API fetch calls, key security, history
└── README.md    # Documentation and usage guide
```

---

## 🔒 Security & Privacy

- **Client-Side Only**: All API requests are made directly from your browser to `api.elevenlabs.io`. No intermediate servers or analytics trackers are used.
- **Local Storage**: Your API key is stored only within your own browser's `localStorage` and never transmitted anywhere other than the official ElevenLabs API.
- **Locked Display**: The locked box in State B disables selection, context menus, and copy actions to prevent accidental exposure or copying while in view.

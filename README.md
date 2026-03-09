# Wayward

A productivity app built around the Eisenhower Matrix. Two modes: **Do** for tasks, **Journal** for thoughts. No due dates, no overdue guilt — just clarity on what matters.

## Modes

- **Do** — Q1 (urgent & important) and Q2 (what matters). Q2 tasks have no deadlines; the app keeps them visible so you work on them when you're ready.
- **Journal** — Write entries throughout the day. Entries lock at midnight and can't be edited after.
- **Goals** — Up to 3 goals, locked for one year from creation.

## Installation

### Desktop (pre-built)

Download the latest release for your platform from the [Releases](../../releases) page:
- **Linux** — `.deb` (Debian/Ubuntu) or `.rpm` (Fedora/Arch)
- **macOS** — `.dmg`
- **Windows** — `.msi`

### Build from source

**Prerequisites:**
- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 18+
- Linux only: `webkit2gtk-4.1` — install via your package manager:
  ```bash
  # Arch
  sudo pacman -S webkit2gtk-4.1

  # Ubuntu/Debian
  sudo apt install libwebkit2gtk-4.1-dev
  ```

**Build:**
```bash
git clone https://github.com/SabienNguyen/wayward
cd wayward
npm install
npm run tauri build
```

The output binary and installers are in `src-tauri/target/release/bundle/`.

### Mobile

**Android** (requires [Android Studio](https://developer.android.com/studio) + NDK):
```bash
npm run tauri android init
npm run tauri android dev
```

**iOS** (macOS only, requires Xcode):
```bash
npm run tauri ios init
npm run tauri ios dev
```

## Development

```bash
npm install
npm run tauri dev        # Start with live reload
cd src-tauri && cargo test   # Run Rust tests (no window needed)
npm run check            # TypeScript type check
```

## Sync

Devices sync automatically over LAN — no account or internet required. Open the app on two devices on the same network and they'll find each other via mDNS and exchange changes directly.

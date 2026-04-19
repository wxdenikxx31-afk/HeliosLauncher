<p align="center"><img src="./app/assets/images/SealCircle.png" width="150px" height="150px" alt="unicraft"></p>

<h1 align="center">UniCraft Launcher</h1>

<p align="center">Join modded servers without worrying about installing Java, Forge, or other mods. We'll handle that for you.</p>

## Features

* 🔒 Full account management.
  * Add multiple accounts and easily switch between them.
  * Microsoft (OAuth 2.0) + Mojang (Yggdrasil) authentication fully supported.
  * Credentials are never stored and transmitted directly to Mojang.
* 📂 Efficient asset management.
  * Receive client updates as soon as we release them.
  * Files are validated before launch. Corrupt or incorrect files will be redownloaded.
* ☕ **Automatic Java validation.**
  * If you have an incompatible version of Java installed, we'll install the right one *for you*.
  * You do not need to have Java installed to run the launcher.
* 📰 News feed natively built into the launcher.
* ⚙️ Intuitive settings management, including a Java control panel.
* Supports all of our servers.
  * Switch between server configurations with ease.
  * View the player count of the selected server.
* Automatic updates. That's right, the launcher updates itself.
* View the status of Mojang's services.

## Downloads

You can download from [GitHub Releases](https://github.com/wxdenikxx31-afk/HeliosLauncher/releases)

**Supported Platforms**

| Platform | File |
| -------- | ---- |
| Windows x64 | `UniCraft-Launcher-setup-VERSION.exe` |
| macOS x64 | `UniCraft-Launcher-setup-VERSION-x64.dmg` |
| macOS arm64 | `UniCraft-Launcher-setup-VERSION-arm64.dmg` |
| Linux x64 | `UniCraft-Launcher-setup-VERSION.AppImage` |

## Console

To open the console, use the following keybind.

```console
ctrl + shift + i
```

Ensure that you have the console tab selected. Do not paste anything into the console unless you are 100% sure of what it will do. Pasting the wrong thing can expose sensitive information.

## Development

### Getting Started

**System Requirements**

* [Node.js][nodejs] v22

---

**Clone and Install Dependencies**

```console
> git clone https://github.com/wxdenikxx31-afk/HeliosLauncher.git
> cd HeliosLauncher
> npm install
```

---

**Launch Application**

```console
> npm start
```

---

**Build Installers**

To build for your current platform.

```console
> npm run dist
```

Build for a specific platform.

| Platform    | Command              |
| ----------- | -------------------- |
| Windows x64 | `npm run dist:win`   |
| macOS       | `npm run dist:mac`   |
| Linux x64   | `npm run dist:linux` |

---

### Note on Third-Party Usage

Based on [Helios Launcher](https://github.com/dscalzi/HeliosLauncher) by Daniel Scalzi.

For instructions on setting up Microsoft Authentication, see https://github.com/wxdenikxx31-afk/HeliosLauncher/blob/master/docs/MicrosoftAuth.md.

---

[nodejs]: https://nodejs.org/en/ 'Node.js'

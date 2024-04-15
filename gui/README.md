# ZTMesh developing with  Tauri2.0 + Vue 3 + Vite

This template should help get you started developing with Tauri2.0 + Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Project Setup

```sh
npm install
```
or
```sh
yarn install
```

### Download pipy (plaform=windows|linux|macos-x86|macos)
```sh
yarn download-pipy-{plaform}
```

### Mock a hub if needed
```sh
yarn hub
```

### Compile and Hot-Reload for Development
```sh
npm run tauri dev
```
or
```sh
yarn tauri dev
```

### Compile and Minify for Production APP

```sh
npm run tauri build
```
or
```sh
yarn tauri build
```

### About macOS "can’t be opened" Error
```sh
sudo xattr -rd com.apple.quarantine /Applications/ZTMesh.app
```
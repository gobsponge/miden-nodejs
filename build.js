const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const targetDir = path.resolve(__dirname);

if (!fs.existsSync(rustClientDir)) {
  console.log("Cloning Miden client repository...");
  execSync("git clone https://github.com/0xPolygonMiden/miden-client.git");
}

console.log("Building Rust client for WebAssembly...");
process.chdir(rustClientDir);

execSync("rustup target add wasm32-wasi");

execSync("cargo build --target wasm32-wasi --release -p miden-client-wasm");

const wasmSource = path.join(
  rustClientDir,
  "target/wasm32-wasi/release/miden_client.wasm",
);
const wasmDest = path.join(targetDir, "miden_client.wasm");

fs.copyFileSync(wasmSource, wasmDest);
console.log(`Copied WASM binary to ${wasmDest}`);

process.chdir(targetDir);
console.log("Build complete!");

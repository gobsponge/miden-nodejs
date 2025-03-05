const fs = require("fs");
const path = require("path");
const { WASI, init, WasmFs } = require("@wasmer/wasi");
const { WasmPackage, WasmInstance } = require("@wasmer/wasm");

class MidenClient {
  constructor(options = {}) {
    this.options = {
      wasmPath:
        options.wasmPath || path.resolve(__dirname, "miden_client.wasm"),
      ...options,
    };
    this.instance = null;
    this.wasi = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    await init();

    const wasmFs = new WasmFs();

    this.wasi = new WASI({
      args: [],
      env: {},
      bindings: {
        ...WASI.defaultBindings,
        fs: wasmFs.fs,
      },
    });

    const wasmBinary = fs.readFileSync(this.options.wasmPath);
    const wasmPackage = await WasmPackage.load(wasmBinary);
    this.instance = await WasmInstance.create(wasmPackage, { wasi: this.wasi });

    this.wasi.start(this.instance);

    this.initialized = true;
  }

  /**
   * Create a new Miden account
   * @param {Object} params - Account creation parameters
   * @returns {Promise<Object>} - The created account info
   */
  async createAccount(params = {}) {
    await this.ensureInitialized();

    const { create_account } = this.instance.exports;
    const inputPtr = this.allocateAndWriteToMemory(JSON.stringify(params));
    const resultPtr = create_account(inputPtr);
    const result = this.readFromMemory(resultPtr);

    return JSON.parse(result);
  }

  async executeTransaction(transaction) {
    await this.ensureInitialized();

    const { execute_transaction } = this.instance.exports;
    const inputPtr = this.allocateAndWriteToMemory(JSON.stringify(transaction));
    const resultPtr = execute_transaction(inputPtr);
    const result = this.readFromMemory(resultPtr);

    return JSON.parse(result);
  }

  async getAccountState(accountId) {
    await this.ensureInitialized();

    const { get_account_state } = this.instance.exports;
    const inputPtr = this.allocateAndWriteToMemory(accountId);
    const resultPtr = get_account_state(inputPtr);
    const result = this.readFromMemory(resultPtr);

    return JSON.parse(result);
  }

  async submitProof(proof) {
    await this.ensureInitialized();

    const { submit_proof } = this.instance.exports;
    const inputPtr = this.allocateAndWriteToMemory(JSON.stringify(proof));
    const resultPtr = submit_proof(inputPtr);
    const result = this.readFromMemory(resultPtr);

    return JSON.parse(result);
  }

  async deployContract(contract) {
    await this.ensureInitialized();

    const { deploy_contract } = this.instance.exports;
    const inputPtr = this.allocateAndWriteToMemory(JSON.stringify(contract));
    const resultPtr = deploy_contract(inputPtr);
    const result = this.readFromMemory(resultPtr);

    return JSON.parse(result);
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  allocateAndWriteToMemory(data) {
    const { alloc, write_to_buffer } = this.instance.exports;
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    const ptr = alloc(encodedData.length);

    const memory = this.instance.exports.memory;
    const buffer = new Uint8Array(memory.buffer);

    for (let i = 0; i < encodedData.length; i++) {
      buffer[ptr + i] = encodedData[i];
    }

    write_to_buffer(ptr, encodedData.length);
    return ptr;
  }

  readFromMemory(ptr) {
    const { memory } = this.instance.exports;
    const buffer = new Uint8Array(memory.buffer);
    let end = ptr;

    while (buffer[end] !== 0) {
      end += 1;
    }

    const decoder = new TextDecoder();
    return decoder.decode(buffer.slice(ptr, end));
  }

  destroy() {
    if (this.instance) {
      this.instance = null;
      this.wasi = null;
      this.initialized = false;
    }
  }
}

module.exports = MidenClient;

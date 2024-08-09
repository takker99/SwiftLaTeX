// @ts-self-types="npm:@types/emscripten@1"

declare let Module: EmscriptenModule;

declare namespace FS {
  const streams: FSStream[];
}

declare const wasmMemory: WebAssembly.Memory;
declare const HEAPU8: EmscriptenModule["HEAPU8"];
declare const _malloc: EmscriptenModule["_malloc"];
declare const _compileLaTeX: () => number;
declare const _compileFormat: () => number;
declare const _compileBibtex: () => number;
declare const _setMainEntry: (_0: number) => number;

/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="webworker"/>
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

type CompileEvent = FailedCompileEvent | SuccessCompileEvent;

interface FailedCompileEvent {
  result: "failed";
  status: number;
  log: string;
  cmd: "compile";
}

interface SuccessCompileEvent {
  result: "ok";
  status: number;
  log: string;
  pdf: ArrayBuffer;
  cmd: "compile";
}

type MkdirEvent = FailedMkdirEvent | SuccessMkdirEvent;

interface FailedMkdirEvent {
  result: "failed";
  cmd: "mkdir";
}

interface SuccessMkdirEvent {
  result: "ok";
  cmd: "mkdir";
}

type WriteFileEvent = FailedWriteFileEvent | SuccessWriteFileEvent;

interface FailedWriteFileEvent {
  result: "failed";
  cmd: "writefile";
}
interface SuccessWriteFileEvent {
  result: "ok";
  cmd: "writefile";
}

export interface MainModule {
  cleanDir: (dir: string) => void;
  compileLaTeX: () => Promise<CompileEvent>;
  compileFormat: () => CompileEvent;
  mkdir: (dirname: string) => MkdirEvent;
  writeFile: (
    filename: string,
    content: string | ArrayBufferView,
  ) => WriteFileEvent;
  setTexliveEndpoint: (endpoint: string) => void;
  setMainfile: (filename: string) => void;
}

type CompileEvent = FailedCompileEvent | SuccessCompileEvent;

interface FailedCompileEvent {
  result: "failed";
  status: number;
  cmd: "compile";
}

interface SuccessCompileEvent {
  result: "ok";
  status: number;
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

export default function MainModuleFactory(
  options?: unknown,
): Promise<MainModule>;

import createModule from "../build/release/xetex-wasm.mjs";

let module;
globalThis.addEventListener("message", async ({ data }) => {
  try {
    module ??= await createModule().then(
      (m) =>
        globalThis.postMessage({ type: "stdout", value: "module loaded." }) ||
        m,
    );
    const { compileLaTeX, setMainfile, writeFile, onProgress } = module;
    onProgress((value) => globalThis.postMessage({ type: "stdout", value }));
    const res = await fetch(data);
    writeFile("main.tex", await res.text());
    setMainfile("main.tex");
    globalThis.postMessage({ type: "result", value: compileLaTeX() });
  } catch (e) {
    console.error(e);
    globalThis.postMessage({ type: "error", value: e });
  }
});

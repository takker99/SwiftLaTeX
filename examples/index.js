// @deno-self-types="../xetex.d.ts"
const worker = new Worker("./worker.js", { type: "module" });

const logElm = document.getElementById("log");
worker.addEventListener(
  "message",
  (
    /** @type {MessageEvent<{type: "result"; value: CompileEvent}|{type: "error"; value:Error}|{type: "stdout"; value: string}>} */ {
      data,
    },
  ) => {
    if (data instanceof Error) {
      console.error(data);
      return;
    }
    switch (data.type) {
      case "result": {
        if (data.value.result === "failed") break;
        const blob = new Blob([new Uint8Array(data.value.pdf)], {
          type: "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = "main.xdv";
        a.href = url;
        a.textContent = "Download XDV";
        document.body.insertAdjacentElement("afterbegin", a);
        break;
      }
      case "error":
        console.error(data.value);
        break;
      case "stdout":
        logElm.textContent += data.value + "\n";
        break;
    }
  },
);
worker.postMessage("./test.tex");

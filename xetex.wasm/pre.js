// @ts-check

const TEXCACHEROOT = "/tex";
const WORKROOT = "/work";
let memlog = "";
/** @type{Uint8Array|undefined} */
let initmem;
let mainfile = "main.tex";
let texlive_endpoint = "https://texlive2.swiftlatex.com/";
Module.print = (a) => {
  memlog += a + "\n";
};

Module.printErr = (a) => {
  memlog += a + "\n";
  console.log(a);
};

/**
 * @param {ArrayLike<number>} content
 * @return {number}
 */
const _allocate = (content) => {
  const res = _malloc(content.length);
  HEAPU8.set(new Uint8Array(content), res);
  return res;
};

Module.preRun = [() => {
  FS.mkdir(TEXCACHEROOT);
  FS.mkdir(WORKROOT);
}];

const dumpHeapMemory = () => {
  const src = wasmMemory.buffer;
  const dst = new Uint8Array(src.byteLength);
  dst.set(new Uint8Array(src));
  // console.log("Dumping " + src.byteLength);
  return dst;
};

const restoreHeapMemory = () => {
  if (initmem) {
    const dst = new Uint8Array(wasmMemory.buffer);
    dst.set(initmem);
  }
};

const closeFSStreams = () => {
  for (const stream of FS.streams) {
    if (!stream || (stream.fd ?? 0) <= 2) {
      continue;
    }
    FS.close(stream);
  }
};

const prepareExecutionContext = () => {
  memlog = "";
  restoreHeapMemory();
  closeFSStreams();
  FS.chdir(WORKROOT);
};

Module.postRun = [() => {
  self.postMessage({ result: "ok" });
  initmem = dumpHeapMemory();
}];

/**
 * @param {string} dir
 */
const cleanDir = (dir) => {
  const l = FS.readdir(dir);
  for (let item of l) {
    if (item === "." || item === "..") {
      continue;
    }
    item = dir + "/" + item;
    let fsStat = undefined;
    try {
      fsStat = FS.stat(item);
    } catch (_) {
      console.error("Not able to fsstat " + item);
      continue;
    }
    if (FS.isDir(fsStat.mode)) {
      cleanDir(item);
    } else {
      try {
        FS.unlink(item);
      } catch (_) {
        console.error("Not able to unlink " + item);
      }
    }
  }

  if (dir !== WORKROOT) {
    try {
      FS.rmdir(dir);
    } catch (_) {
      console.error("Not able to top level " + dir);
    }
  }
};

Module.onAbort = () => {
  memlog += "Engine crashed";
  self.postMessage({
    result: "failed",
    status: -254,
    log: memlog,
    cmd: "compile",
  });
  return;
};

/**
 * @return {CompileEvent}
 */
const compileLaTeXRoutine = () => {
  prepareExecutionContext();
  const setMainFunction = cwrap("setMainEntry", "number", ["string"]);
  setMainFunction(mainfile);

  let status = _compileLaTeX();
  if (status === 0) {
    let pdfArrayBuffer = null;
    _compileBibtex();
    const pdfurl = WORKROOT + "/" +
      mainfile.substr(0, mainfile.length - 4) + ".xdv";
    try {
      pdfArrayBuffer = FS.readFile(pdfurl, {
        encoding: "binary",
      });
    } catch (_) {
      console.error("Fetch content failed. " + pdfurl);
      status = -253;
      return {
        result: "failed",
        status,
        log: memlog,
        cmd: "compile",
      };
    }
    return {
      result: "ok",
      status,
      log: memlog,
      pdf: pdfArrayBuffer.buffer,
      cmd: "compile",
    };
  }
  console.error(`Compilation failed, with status code ${status}`);
  return {
    result: "failed",
    status,
    log: memlog,
    cmd: "compile",
  };
};

/**
 * @return {CompileEvent}
 */
const compileFormatRoutine = () => {
  prepareExecutionContext();
  let status = _compileFormat();
  if (status === 0) {
    let pdfArrayBuffer = null;
    try {
      pdfArrayBuffer = FS.readFile(`${WORKROOT}/xelatex.fmt`, {
        encoding: "binary",
      });
    } catch (_) {
      console.error("Fetch content failed.");
      status = -253;
      return {
        result: "failed",
        status,
        log: memlog,
        cmd: "compile",
      };
    }
    return {
      result: "ok",
      status,
      log: memlog,
      pdf: pdfArrayBuffer.buffer,
      cmd: "compile",
    };
  }
  console.error(`Compilation format failed, with status code ${status}`);
  return {
    result: "failed",
    status,
    log: memlog,
    cmd: "compile",
  };
};

/**
 * @param {string} dirname
 * @return {MkdirEvent}
 */
const mkdirRoutine = (dirname) => {
  try {
    //console.log("removing " + item);
    FS.mkdir(WORKROOT + "/" + dirname);
    return {
      result: "ok",
      cmd: "mkdir",
    };
  } catch (_) {
    console.error("Not able to mkdir " + dirname);
    return {
      result: "failed",
      cmd: "mkdir",
    };
  }
};

/**
 * @param {string} filename
 * @param {string | ArrayBufferView} content
 * @return {WriteFileEvent}
 */
const writeFileRoutine = (filename, content) => {
  try {
    FS.writeFile(WORKROOT + "/" + filename, content);
    return {
      result: "ok",
      cmd: "writefile",
    };
  } catch (_) {
    console.error("Unable to write mem file");
    return {
      result: "failed",
      cmd: "writefile",
    };
  }
};

/**
 * @param {string} url
 */
const setTexliveEndpoint = (url) => {
  if (url) {
    if (!url.endsWith("/")) {
      url += "/";
    }
    texlive_endpoint = url;
  }
};

self.onmessage = (ev) => {
  const data = ev["data"];
  /** @type {unknown} */
  const cmd = data["cmd"];
  switch (cmd) {
    case "compilelatex":
    case "compileformat": {
      const event = cmd === "compilelatex"
        ? compileLaTeXRoutine()
        : compileFormatRoutine();
      if (event.result === "ok") {
        self.postMessage(event, [event.pdf]);
      }
      self.postMessage(event);
      break;
    }
    case "settexliveurl":
      setTexliveEndpoint(data["url"]);
      break;
    case "mkdir":
      self.postMessage(mkdirRoutine(data["url"]));
      break;
    case "writefile":
      self.postMessage(writeFileRoutine(data["url"], data["src"]));
      break;
    case "setmainfile":
      mainfile = data["url"];
      break;
    case "grace":
      console.error("Gracefully Close");
      self.close();
      break;
    case "flushcache":
      cleanDir(WORKROOT);
      break;
    default:
      console.error("Unknown command " + cmd);
      break;
  }
};

/** @type{Set<string>} */
const texlive404_cache = new Set();
/** @type{Map<string,string>} */
const texlive200_cache = new Map();

/**
 * @param {number} nameptr
 * @param {string} format
 * @param {any} _mustexist
 */
// deno-lint-ignore no-unused-vars
const kpse_find_file_impl = (nameptr, format, _mustexist) => {
  const reqname = UTF8ToString(nameptr);

  if (reqname.includes("/")) return 0;

  const cacheKey = `${format}/${reqname}`;

  if (texlive404_cache.has(cacheKey)) return 0;

  {
    const savepath = texlive200_cache.get(cacheKey);
    if (savepath) return _allocate(intArrayFromString(savepath));
  }

  const remote_url = `${texlive_endpoint}xetex/${cacheKey}`;
  const xhr = new XMLHttpRequest();
  xhr.open("GET", remote_url, false);
  xhr.timeout = 150000;
  xhr.responseType = "arraybuffer";
  console.log(`Start downloading texlive file ${remote_url}`);
  try {
    xhr.send();
  } catch (_) {
    console.log(`TexLive Download Failed ${remote_url}`);
    return 0;
  }

  if (xhr.status === 200) {
    const arraybuffer = xhr.response;
    const fileid = xhr.getResponseHeader("fileid");
    const savepath = TEXCACHEROOT + "/" + fileid;
    FS.writeFile(savepath, new Uint8Array(arraybuffer));
    texlive200_cache.set(cacheKey, savepath);
    return _allocate(intArrayFromString(savepath));
  } else if (xhr.status === 301) {
    console.log(`TexLive File not exists ${remote_url}`);
    texlive404_cache.add(cacheKey);
  }
  return 0;
};

/** @type{Record<string,string>} */
const font200_cache = {};
/** @type{Record<string,number>} */
const font404_cache = {};
/**
 * @param {number} fontnamePtr
 * @param {number} varStringPtr
 */
// deno-lint-ignore no-unused-vars
const fontconfig_search_font_impl = (fontnamePtr, varStringPtr) => {
  const fontname = UTF8ToString(fontnamePtr);
  let variant = UTF8ToString(varStringPtr);
  if (!variant) {
    variant = "OT";
  }
  variant = variant.replace(/\//g, "_");

  const cacheKey = variant + "/" + fontname;

  if (cacheKey in font200_cache) {
    const savepath = font200_cache[cacheKey];
    return _allocate(intArrayFromString(savepath));
  }

  if (cacheKey in font404_cache) {
    return 0;
  }

  const remote_url = texlive_endpoint + "fontconfig/" + cacheKey;
  const xhr = new XMLHttpRequest();
  xhr.open("GET", remote_url, false);
  xhr.timeout = 150000;
  xhr.responseType = "arraybuffer";
  console.log("Start downloading font file " + remote_url);
  try {
    xhr.send();
  } catch (_) {
    console.log("Font Download Failed " + remote_url);
    return 0;
  }
  if (xhr.status === 200) {
    const arraybuffer = xhr.response;
    const fontID = xhr.getResponseHeader("fontid");
    const savepath = TEXCACHEROOT + "/" + fontID;

    FS.writeFile(savepath, new Uint8Array(arraybuffer));
    font200_cache[cacheKey] = savepath;
    return _allocate(intArrayFromString(savepath));
  } else if (xhr.status === 301 || xhr.status === 404) {
    console.log("Font File not exists " + remote_url);
    font404_cache[cacheKey] = 1;
    return 0;
  }

  return 0;
};

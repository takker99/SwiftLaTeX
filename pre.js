// @ts-check
/// <reference types="./pre.d.ts" />

const TEXCACHEROOT = "/tex";
const WORKROOT = "/work";
/** @type{Uint8Array|undefined} */
let initmem;
let mainfile = "main.tex";
let texlive_endpoint = "https://texlive2.swiftlatex.com/";
/** @type {(msg: string) => void} */
let logger = () => {};

Module.onProgress = (callback) => logger = callback;
Module.print = (a) => {
  logger(a);
};

Module.printErr = (a) => {
  logger(a);
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
  // clear messages
  restoreHeapMemory();
  closeFSStreams();
  FS.chdir(WORKROOT);
};

Module.postRun = [() => {
  initmem = dumpHeapMemory();
}];

Module.cleanDir = (dir) => {
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
      Module.cleanDir(item);
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
  logger("Engine crashed");
  return;
};

Module.compileLaTeX = () => {
  prepareExecutionContext();
  ccall("setMainEntry", "number", ["string"], [mainfile]);

  let status = _compileLaTeX();
  if (status === 0) {
    let pdfArrayBuffer = null;
    _compileBibtex();
    const pdfurl = `${WORKROOT}/${mainfile.slice(0, mainfile.length - 4)}.xdv`;
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
        cmd: "compile",
      };
    }
    return {
      result: "ok",
      status,
      pdf: pdfArrayBuffer.buffer,
      cmd: "compile",
    };
  }
  console.error(`Compilation failed, with status code ${status}`);
  return {
    result: "failed",
    status,
    cmd: "compile",
  };
};

Module.compileFormat = () => {
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
        cmd: "compile",
      };
    }
    return {
      result: "ok",
      status,
      pdf: pdfArrayBuffer.buffer,
      cmd: "compile",
    };
  }
  console.error(`Compilation format failed, with status code ${status}`);
  return {
    result: "failed",
    status,
    cmd: "compile",
  };
};

Module.mkdir = (dirname) => {
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

Module.writeFile = (filename, content) => {
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

Module.setTexliveEndpoint = (url) => {
  if (url) {
    if (!url.endsWith("/")) {
      url += "/";
    }
    texlive_endpoint = url;
  }
};

Module.setMainfile = (filename) => {
  mainfile = filename;
};

/** @type{Set<string>} */
const texlive404_cache = new Set();
/** @type{Map<string,string>} */
const texlive200_cache = new Map();

/**
 * @param {number} nameptr
 * @param {string} format
 * @param {unknown} _mustexist
 * @return {number}
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
  try {
    xhr.send();
  } catch (_) {
    logger(`Failed to download ${remote_url}`);
    return 0;
  }

  if (xhr.status === 200) {
    logger(`Download ${remote_url}`);
    /** @type {ArrayBuffer} */
    const arraybuffer = xhr.response;
    const fileid = xhr.getResponseHeader("fileid") ?? "";
    const savepath = `${TEXCACHEROOT}/${fileid}`;
    FS.writeFile(savepath, new Uint8Array(arraybuffer));
    texlive200_cache.set(cacheKey, savepath);
    const charPtr = _allocate(intArrayFromString(savepath));
    return charPtr;
  } else if (xhr.status === 301) {
    logger(`File not exists ${remote_url}`);
    texlive404_cache.add(cacheKey);
  }
  return 0;
};

/** @type{Map<string,string>} */
const font200_cache = new Map();
/** @type{Set<string>} */
const font404_cache = new Set();
/**
 * @param {number} fontnamePtr
 * @param {number} varStringPtr
 */
// deno-lint-ignore no-unused-vars
const fontconfig_search_font_impl = (fontnamePtr, varStringPtr) => {
  const fontname = UTF8ToString(fontnamePtr);
  const variant = (UTF8ToString(varStringPtr) || "OT").replace(/\//g, "_");

  const cacheKey = `${variant}/${fontname}`;

  if (font404_cache.has(cacheKey)) return 0;

  {
    const savepath = font200_cache.get(cacheKey);
    if (savepath) return _allocate(intArrayFromString(savepath));
  }
  const remote_url = `${texlive_endpoint}fontconfig/${cacheKey}`;
  const xhr = new XMLHttpRequest();
  xhr.open("GET", remote_url, false);
  xhr.timeout = 150000;
  xhr.responseType = "arraybuffer";
  logger(`Start downloading font file ${remote_url}`);
  try {
    xhr.send();
  } catch (_) {
    logger(`Font Download Failed ${remote_url}`);
    return 0;
  }

  if (xhr.status === 200) {
    /** @type {ArrayBuffer} */
    const arraybuffer = xhr.response;
    const fontID = xhr.getResponseHeader("fontid") ?? "";
    const savepath = `${TEXCACHEROOT}/${fontID}`;
    FS.writeFile(savepath, new Uint8Array(arraybuffer));
    font200_cache.set(cacheKey, savepath);
    return _allocate(intArrayFromString(savepath));
  }
  if (xhr.status === 301 || xhr.status === 404) {
    logger(`Font File not exists ${remote_url}`);
    font404_cache.add(cacheKey);
  }
  return 0;
};

/// <reference lib="deno.ns"/>
// @deno-types=./xetex.d.ts
import createModule from "./swiftlatexxetex.js";
const { compileLaTeX, setMainfile, writeFile } = await createModule();

writeFile("main.tex", await Deno.readTextFile("test.tex"));
setMainfile("main.tex");
compileLaTeX().then(console.log).catch(console.error);

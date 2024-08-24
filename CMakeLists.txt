cmake_minimum_required(VERSION 3.30)

project(xetex)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_INSTALL_PREFIX "..")

if(EMSCRIPTEN)
  set(VCPKG_INCLUDE_DIR ${VCPKG_INSTALLED_DIR}/${VCPKG_TARGET_TRIPLET}/include)
  set(EM_CPP_FLAGS
      -Wno-parentheses-equality
      -Wno-pointer-sign
      --use-port=freetype
      --use-port=icu
      --use-port=libpng
      -fno-rtti
      -fno-exceptions)

  set(EM_LINK_FLAGS
      --use-port=freetype
      --use-port=icu
      --use-port=libpng
      --disable-nls
      --js-library=${CMAKE_CURRENT_SOURCE_DIR}/library.js
      --pre-js=${CMAKE_CURRENT_SOURCE_DIR}/pre.js
      # -sSTANDALONE_WASM=1 -sPURE_WASI=1 -sWASM_BIGINT=1
      --no-entry
      # -sFILESYSTEM=0
      -sAUTO_JS_LIBRARIES=0
      -sAUTO_NATIVE_LIBRARIES=0
      -sEXIT_RUNTIME=0
      -Wno-experimental
      # -sJSPI=1
      # -sJSPI_EXPORTS=compileBibtex,compileLaTeX,compileFormat
      # -sJSPI_IMPORTS=kpse_find_file_js,fontconfig_search_font_js
      # -sASYNCIFY
      # -sASYNCIFY_IMPORTS=kpse_find_file_js,fontconfig_search_font_js
      -sENVIRONMENT=web
      -sMODULARIZE=1
      -sEXPORT_ES6=1
      -sUSE_ES6_IMPORT_META=1
      -sINCOMING_MODULE_JS_API=preRun,postRun,onAbort,print,printErr,noExitRuntime,onProgress
      -sTEXTDECODER=2
      -sEXPORTED_FUNCTIONS=_compileBibtex,_compileLaTeX,_compileFormat,_setMainEntry,_malloc
      -sEXPORTED_RUNTIME_METHODS=ccall
      -sALLOW_MEMORY_GROWTH=1
      -sPOLYFILL=0)

  if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    # set(EM_CPP_FLAGS ${EM_CPP_FLAGS} )
    list(
      APPEND
      EM_LINK_FLAGS
      -sSAFE_HEAP=1
      # -sSAFE_HEAP_LOG=1 -sLIBRARY_DEBUG=1
      -sEXCEPTION_DEBUG=1
      -sMALLOC=emmalloc-memvalidate-verbose
      -sASSERTIONS=2
      -gsource-map
      "--source-map-base ./" # Debugging c++ only works in browser with
                             # "Experimental DWARF support turned on"
    )
  else()
    list(APPEND EM_LINK_FLAGS -Os)
    list(APPEND EM_CPP_FLAGS -Os)
  endif()

  # See: https://github.com/emscripten-core/emscripten/blob/main/src/settings.js
  string(REPLACE ";" " " CPP_FLAGS "${EM_CPP_FLAGS}")

  string(REPLACE ";" " " LINK_FLAGS "${EM_LINK_FLAGS}")

  include_directories(${VCPKG_INCLUDE_DIR} ${CMAKE_CURRENT_BINARY_DIR})

  add_library(
    xetex STATIC
    xetexdir/XeTeXOTMath.cpp
    xetexdir/XeTeXLayoutInterface.cpp
    xetexdir/XeTeXFontMgr.cpp
    xetexdir/XeTeXFontInst.cpp
    xetexdir/XeTeXFontMgr_FC.cpp
    xetexdir/hz.cpp
    xetexdir/pdfimage.cpp)
  target_link_libraries(
    xetex
    PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/xpdf/xpdf.a
            ${CMAKE_CURRENT_SOURCE_DIR}/graphite2/libgraphite2.a
            ${CMAKE_CURRENT_SOURCE_DIR}/harfbuzz/libharfbuzz.a)
  target_include_directories(
    xetex
    PRIVATE ./
            tex/
            xetexdir/
            harfbuzz/
            xpdf/
            xpdf/goo/
            xpdf/xpdf/)
  add_library(teckit STATIC teckit/teckit-Engine.cpp)
  target_include_directories(teckit PRIVATE ./ teckit/)

  add_executable(
    xetex-wasm
    tex/xetex0.c
    tex/xetexini.c
    tex/xetex-pool.c
    md5.c
    xmemory.c
    texfile.c
    kpseemu.c
    texmfmp.c
    main.c
    bibtex.c
    xetexdir/XeTeX_ext.c
    xetexdir/XeTeX_pic.c
    xetexdir/image/bmpimage.c
    xetexdir/image/jpegimage.c
    xetexdir/image/pngimage.c
    xetexdir/trans.c)
  target_include_directories(xetex-wasm PRIVATE ./ tex/ harfbuzz/)

  set(CMAKE_EXECUTABLE_SUFFIX ".mjs")

  target_link_libraries(xetex-wasm PRIVATE xetex teckit)

  foreach(target IN ITEMS xetex teckit xetex-wasm)
    target_compile_features(${target} PRIVATE cxx_std_23)
    target_compile_definitions(${target} PRIVATE WEBASSEMBLY_BUILD)
    set_target_properties(${target} PROPERTIES COMPILE_FLAGS "${CPP_FLAGS}")
    set_target_properties(${target} PROPERTIES LINK_FLAGS "${LINK_FLAGS}")
  endforeach()

endif()

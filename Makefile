PROJECT_NAME 	:= 	swiftlatexxetex.js
CC 				= 	emcc
CXX 			= 	em++
DEBUGFLAGS 		= 	-O3

CFLAGS 			= 	$(DEBUGFLAGS) -Wno-parentheses-equality -Wno-pointer-sign -DWEBASSEMBLY_BUILD \
					--use-port=freetype --use-port=icu --use-port=libpng -fno-rtti -fno-exceptions

LDFLAGS 		= 	$(DEBUGFLAGS) --js-library library.js \
          --use-port=freetype \
          --use-port=icu \
          --use-port=libpng \
					--pre-js pre.js \
					-sASYNCIFY \
					-sASYNCIFY_IMPORTS=kpse_find_file_js,fontconfig_search_font_js \
					-sENVIRONMENT=web \
					-sMODULARIZE=1 \
					-sEXPORT_ES6=1 \
					-sINCOMING_MODULE_JS_API=preRun,postRun,onAbort,print,printErr,noExitRuntime \
					-sWASM_BIGINT=1 \
					-sTEXTDECODER=2 \
					-sVERBOSE=1 \
					-sEXPORTED_FUNCTIONS=_compileBibtex,_compileLaTeX,_compileFormat,_main,_setMainEntry,_malloc,ccall   \
					-sEXIT_RUNTIME=0 \
					-sWASM=1 -sALLOW_MEMORY_GROWTH=1

LINKFLAG 		= 	$(CXX) -o $@ $(LDFLAGS)

BUILD_DIR 		= 	build

TEXSOURCES 		= 	tex/xetex0.c tex/xetexini.c tex/xetex-pool.c  \
					md5.c xmemory.c texfile.c kpseemu.c texmfmp.c main.c \
					bibtex.c xetexdir/XeTeX_ext.c xetexdir/XeTeX_pic.c xetexdir/image/bmpimage.c xetexdir/image/jpegimage.c \
					xetexdir/image/pngimage.c xetexdir/trans.c

XETEXSOURCES 	= 	xetexdir/XeTeXOTMath.cpp \
					xetexdir/XeTeXLayoutInterface.cpp \
					xetexdir/XeTeXFontMgr.cpp xetexdir/XeTeXFontInst.cpp \
					xetexdir/XeTeXFontMgr_FC.cpp xetexdir/hz.cpp \
					xetexdir/pdfimage.cpp

TECKITSOURCES 	= 	teckit/teckit-Engine.cpp

TEXOBJECTS 		= 	$(TEXSOURCES:%.c=$(BUILD_DIR)/%.o)
XETEXOBJECTS 	= 	$(XETEXSOURCES:%.cpp=$(BUILD_DIR)/%.o)
TECKITOBJECTS 	= 	$(TECKITSOURCES:%.cpp=$(BUILD_DIR)/%.o)

_default:
	@$(MAKE) all --no-print-directory -j

all: $(PROJECT_NAME)

$(PROJECT_NAME): $(TEXOBJECTS) $(XETEXOBJECTS) $(TECKITOBJECTS)
	@$(LINKFLAG) $(TEXOBJECTS) $(XETEXOBJECTS) $(TECKITOBJECTS) xpdf/xpdf.a graphite2/libgraphite2.a harfbuzz/libharfbuzz.a && \
	echo -e "\033[32m[DONE]\033[0m $(PROJECT_NAME)" || \
	echo -e "\033[31m[ERROR]\033[0m $(PROJECT_NAME)"

$(TEXOBJECTS): $(BUILD_DIR)/%.o: %.c
	@mkdir -p $(@D)
	@$(CC) -c $(CFLAGS) -I. -I tex/ -I harfbuzz/ $< -o $@ && \
	echo -e "\033[32m[OK]\033[0m $<" || \
	echo -e "\033[31m[ERROR]\033[0m $<"

$(XETEXOBJECTS): $(BUILD_DIR)/%.o: %.cpp
	@mkdir -p $(@D)
	@$(CXX) -c $(CFLAGS) -I. -I tex/ -I xetexdir/ -I harfbuzz/  -I xpdf/ -I xpdf/goo/ -I xpdf/xpdf/ $< -o $@ && \
	echo -e "\033[32m[OK]\033[0m $<" || \
	echo -e "\033[31m[ERROR]\033[0m $<"

$(TECKITOBJECTS): $(BUILD_DIR)/%.o: %.cpp
	@mkdir -p $(@D)
	@$(CXX) -c $(CFLAGS) -I. -I teckit/ $< -o $@ && \
	echo -e "\033[32m[OK]\033[0m $<" || \
	echo -e "\033[31m[ERROR]\033[0m $<"

clean:
	@rm -rf $(BUILD_DIR) && \
	echo -e "\033[32m[CLEANED]\033[0m $(BUILD_DIR)" || \
	echo -e "\033[31m[ERROR]\033[0m $(BUILD_DIR)"

fclean: clean
	@rm -f $(PROJECT_NAME) && \
	echo -e "\033[32m[CLEANED]\033[0m $(PROJECT_NAME)" || \
	echo -e "\033[31m[ERROR]\033[0m $(PROJECT_NAME)"

re: fclean _default

.PHONY: all clean fclean re
.SILENT:

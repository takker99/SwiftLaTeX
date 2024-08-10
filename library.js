mergeInto(LibraryManager.library, {
  kpse_find_file_js: (nameptr, format, mustexist) =>
    kpse_find_file_impl(nameptr, format, mustexist),
  fontconfig_search_font_js: (nameptr, varptr) =>
    fontconfig_search_font_impl(nameptr, varptr),
});

export default [
  {
    isExternal: false,
    name: "toggleEditor",
    externals: [
      "/pageEditor.js",
      "/twindSetup.js",
      "/globalUtilities.js",
      "/componentUtilities.js",
    ],
  },
  { isExternal: true, name: "pageEditor", externals: [] },
];

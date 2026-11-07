// Bundles the 3D hero into one minified file per renderer, so desktop browsers
// fetch a single file instead of about forty separate modules.
// Run after changing anything in reference-home/morph-pen:
//   npm i --no-save esbuild && node scripts/build-scene.mjs
import { build } from "esbuild";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pagesPrefix = "/aeva-chemicals/";

await build({
  absWorkingDir: root,
  entryPoints: {
    "scene-webgpu": "reference-home/morph-pen/react-scene.js",
    "scene-webgl": "reference-home/morph-pen/webgl-fallback-scene.js",
  },
  outdir: "reference-home/morph-pen/dist",
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  legalComments: "none",
  logLevel: "info",
  plugins: [{
    name: "pages-prefix",
    setup(pluginBuild) {
      // The sources import through the GitHub Pages path; map that back to the repo.
      pluginBuild.onResolve({ filter: /^\/aeva-chemicals\// }, ({ path: importPath }) => ({
        path: path.join(root, importPath.slice(pagesPrefix.length)),
      }));
    },
  }],
});

import * as THREE from "/reference-home/morph-pen/vendor/three/build/three.webgpu.js";
import { EXRLoader } from "/reference-home/morph-pen/vendor/three/examples/jsm/loaders/EXRLoader.js";
import { HDRLoader } from "/reference-home/morph-pen/vendor/three/examples/jsm/loaders/HDRLoader.js";

export function createEnvironmentController({ renderer, scene, generatedEnvironment, resources }) {
  let releaseActive = () => {};
  const abortController = new AbortController();
  resources.defer(() => abortController.abort());
  const exrLoader = new EXRLoader();
  const hdrLoader = new HDRLoader();

  const setEnvironmentTexture = (texture) => {
    if (resources.disposed) { texture.dispose(); return; }
    let pmrem;
    try {
      pmrem = new THREE.PMREMGenerator(renderer);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      const target = pmrem.fromEquirectangular(texture);
      const release = resources.defer(() => target.dispose());
      releaseActive();
      releaseActive = release;
      scene.environment = target.texture;
    } finally {
      try { texture.dispose(); }
      finally { pmrem?.dispose(); }
    }
  };

  const detectEnvironmentFormat = (url, hint = "") => {
    const target = `${hint} ${url}`.toLowerCase();
    if (target.includes(".exr") || target.includes("image/x-exr")) {
      return "exr";
    }
    return "hdr";
  };

  const buildParsedEnvironmentTexture = (texData, isHdr) => {
    const texture = new THREE.DataTexture(
      texData.data,
      texData.width,
      texData.height,
      texData.format ?? THREE.RGBAFormat,
      texData.type,
    );
    texture.colorSpace = texData.colorSpace ?? THREE.LinearSRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.flipY = isHdr;
    texture.needsUpdate = true;
    return texture;
  };

  const loadEnvironment = async (url, hint = "") => {
    resources.check();
    const format = detectEnvironmentFormat(url, hint);
    const isHdr = format === "hdr";
    const loader = isHdr ? hdrLoader : exrLoader;
    const response = await fetch(url, { cache: "no-store", signal: abortController.signal });
    resources.check();
    if (!response.ok) {
      throw new Error(`Environment request failed: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    resources.check();
    const texData = loader.parse(buffer);
    return buildParsedEnvironmentTexture(texData, isHdr);
  };

  const setFallbackEnvironment = () => {
    if (resources.disposed) return;
    releaseActive();
    scene.environment = generatedEnvironment;
  };

  return {
    loadEnvironment,
    cancelEnvironmentLoad: () => abortController.abort(),
    setEnvironmentTexture,
    setFallbackEnvironment,
  };
}

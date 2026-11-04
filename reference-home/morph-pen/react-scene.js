import { createResourceScope } from "./modules/resource-scope.js";
import { createSurfaceRaycast } from "./modules/surface-raycast.js";
import * as THREE from "/reference-home/morph-pen/vendor/three/build/three.webgpu.js";
import WebGPU from "/reference-home/morph-pen/vendor/three/examples/jsm/capabilities/WebGPU.js";
import {
  createBlobAnchorDefinitions,
  createBlobGeometryState,
} from "./modules/blob-geometry.js";
import { createBlobDeformer } from "./modules/blob-deformer.js";
import { createEnvironmentController } from "./modules/environment.js";
import {
  createStatusController,
  initializeEnvironmentStartup,
} from "./modules/environment-startup.js";
import { createPointerInput } from "./modules/pointer-input.js";
import { createRenderLoop } from "./modules/render-loop.js";
import { createCubeSplit } from "./modules/cube-split.js";
import {
  attachSceneEventBindings,
  createResizeController,
} from "./modules/scene-interactions.js";
import {
  applySceneTransforms,
  getMorphRenderState,
} from "./modules/scene-render-state.js";
import { getMusicReactiveDeformState } from "./modules/music-reactive-mapping.js";
import {
  createBlobMeshes,
  createRenderer,
  createSceneGraph,
  createSceneLighting,
  createSceneSurfaces,
  initializeRectAreaLightTextures,
} from "./modules/scene-setup.js";
import { createScrollPauseState } from "./modules/scroll-pause-state.js";
import { createMusicReactiveInput } from "./modules/music-reactive-input.js";
import { createSurfaceHoverDust } from "./modules/surface-hover-dust.js";
import { createSurfaceHoverGrid } from "./modules/surface-hover-grid.js";
import {
  ENVIRONMENT_URLS,
  SCENE_CONFIG,
  createEnvironmentMap,
  smoothstep,
} from "./modules/scene-core.js";

export async function initMorphScene({ mount, canvas, status, onError, signal, diagnostics, backdropColor }) {
  const resources = createResourceScope({ signal });
  const dispose = resources.dispose;
  try {
    resources.check();
    const baseRotation = {
      x: SCENE_CONFIG.baseTiltX,
      y: 0,
      z: 0,
    };
    const HERO_STOP_PROGRESS = 0.985;
    const PAUSE_WRAPPER_ENTRY_RATIO = 0.32;
    const statusController = createStatusController(status);

    diagnostics?.enter("renderer-setup");
    if (!WebGPU.isAvailable()) {
      throw new Error("WebGPU is unavailable.");
    }

    initializeRectAreaLightTextures();
    const renderer = await createRenderer({ canvas, resources, diagnostics });
    resources.check();
    diagnostics?.setRendererBackend(renderer.backend?.isWebGPUBackend ? "webgpu" : renderer.backend?.isWebGLBackend ? "webgl2" : "unknown");
    diagnostics?.enter("scene-layout");
    renderer.onDeviceLost = (info) => {
      if (!resources.disposed) onError?.(new Error(info.message || "WebGPU device lost."));
    };
    const { scene, camera, autoRotateGroup, dragGroup, world } = createSceneGraph();
    createSceneLighting({ scene });
    createSceneSurfaces({ scene, resources, backdropColor });

    // Startup must not depend on animation frames arriving (hidden tabs/GPU stalls).
    await new Promise((resolve) => {
      const finish = resources.defer(resolve);
      const timer = window.setTimeout(finish, 0);
      resources.defer(() => window.clearTimeout(timer));
    });
    resources.check();
    diagnostics?.enter("base-environment");
    const generatedEnvironment = createEnvironmentMap(renderer, resources);
    const { loadEnvironment, cancelEnvironmentLoad, setEnvironmentTexture, setFallbackEnvironment } =
      createEnvironmentController({
        resources,
        generatedEnvironment,
        renderer,
        scene,
      });
    diagnostics?.enter("scene-resources");
    const scrollPauseState = createScrollPauseState({
      heroStopProgress: HERO_STOP_PROGRESS,
      pauseWrapperEntryRatio: PAUSE_WRAPPER_ENTRY_RATIO,
    });
    const musicReactiveInput = createMusicReactiveInput(resources);
    const pointerInput = createPointerInput({ three: THREE, canvas });
    let responsiveSceneScale = 1;
    const {
      blobBaseGeometry,
      blobGeometry,
      innerGeometry,
      coatGeometry,
      glassMaterial,
      innerMaterial,
      coatMaterial,
      coreSurfaceTexture,
      shellMesh,
      innerMesh,
      coatMesh,
    } = createBlobMeshes({ world, resources });
    const cubeSplit = createCubeSplit({ resources, three: THREE, world, glassMaterial });
    const { vertexCount, baseDirections } = createBlobGeometryState(blobBaseGeometry);
    const anchorDefinitions = createBlobAnchorDefinitions();
    const getSurfaceHit = createSurfaceRaycast({ three: THREE, scene, camera, pointerInput, shellMesh });
    const surfaceHoverGrid = createSurfaceHoverGrid({ resources,
      getSurfaceHit,
      three: THREE,
      camera,
      pointerInput,
      scene,
      shellMesh,
    });
    const surfaceHoverDust = createSurfaceHoverDust({ resources,
      getSurfaceHit,
      three: THREE,
      camera,
      pointerInput,
      shellMesh,
    });

    const { dragRotation, pointer } = pointerInput;
    let autoRotationY = 0;
    let deformFrameCount = 0;
    let innerCoreScale = 1;
    let easedMusicImpact = 0;
    let easedMusicLimbImpact = 0;
    let coreVersionMapVisible = false;

    const NORMAL_UPDATE_INTERVALS = {
      shell: 1,
      inner: 2,
      coat: 3,
    };
    const deformBlob = createBlobDeformer({
      vertexCount,
      baseDirections,
      anchorDefinitions,
      pointer,
      getDeformFrameCount: () => deformFrameCount,
    });

    const { onResize } = createResizeController({
      mount,
      camera,
      renderer,
      pointerInput,
      onScaleChange: (nextScale) => {
        responsiveSceneScale = nextScale;
      },
    });

    const renderFrame = (dt, elapsed) => {
      deformFrameCount += 1;
      pointerInput.update(dt);

      const scrollProgress = scrollPauseState.getSceneScrollProgress();
      const { morphProgress, splitProgress, sharedBlobBumpScale, forceAllNormals } =
        getMorphRenderState(scrollProgress);
      const musicReactiveState = musicReactiveInput.getState();
      const musicReactive = getMusicReactiveDeformState({
        elapsed,
        musicReactiveState,
      });
      const impactEase = musicReactive.impact > easedMusicImpact ? 0.34 : 0.075;
      easedMusicImpact = THREE.MathUtils.lerp(
        easedMusicImpact,
        musicReactive.impact,
        1 - Math.pow(1 - impactEase, dt * 60),
      );
      const limbImpact = musicReactive.limbImpact ?? musicReactive.impact;
      const limbReleaseEase = THREE.MathUtils.lerp(0.045, 0.022, easedMusicLimbImpact);
      const limbImpactEase = limbImpact > easedMusicLimbImpact ? 0.22 : limbReleaseEase;
      const limbReturnDamping = THREE.MathUtils.clamp(
        (easedMusicLimbImpact - limbImpact) * 1.65,
        0,
        0.72,
      );
      easedMusicLimbImpact = THREE.MathUtils.lerp(
        easedMusicLimbImpact,
        limbImpact,
        1 - Math.pow(1 - limbImpactEase, dt * 60),
      );
      const easedCenterRoundness = Math.max(
        0,
        musicReactive.centerRoundness - (easedMusicImpact - musicReactive.impact) * 0.42,
      );
      const easedMusicReactive = {
        ...musicReactive,
        impact: easedMusicImpact,
        coreMassImpact: easedMusicImpact,
        limbImpact: easedMusicLimbImpact,
        centerRoundness: easedCenterRoundness,
      };
      const coreMassImpact = easedMusicReactive.coreMassImpact ?? easedMusicReactive.impact;
      const playingInnerCoreScale = musicReactiveState.isPlaying || musicReactiveState.isActive
        ? THREE.MathUtils.lerp(0.72, 0.54, coreMassImpact)
        : 1;
      const innerCoreScaleRestore = THREE.MathUtils.smoothstep(morphProgress, 0.12, 0.32);
      const innerCoreScaleTarget = THREE.MathUtils.lerp(
        playingInnerCoreScale,
        1,
        innerCoreScaleRestore,
      );
      innerCoreScale = THREE.MathUtils.lerp(
        innerCoreScale,
        innerCoreScaleTarget,
        1 - Math.pow(0.0025, dt),
      );
      const shellCenterRoundness = musicReactiveState.isPlaying || musicReactiveState.isActive
        ? Math.max(easedMusicReactive.centerRoundness, 0.58)
        : easedMusicReactive.centerRoundness;
      const coreSurfaceReaction = musicReactiveState.isPlaying || musicReactiveState.isActive
        ? THREE.MathUtils.lerp(0.08, 0.74, coreMassImpact)
        : 1;
      const coreLobeReaction = musicReactiveState.isPlaying || musicReactiveState.isActive
        ? THREE.MathUtils.lerp(0.08, 1, easedMusicReactive.limbImpact)
        : 1;
      const coreReturnCalm = 1 - limbReturnDamping;

      deformBlob(blobGeometry, elapsed, {
        baseRadius: 1.64,
        bumpScale: sharedBlobBumpScale,
        blobSpreadMultiplier: THREE.MathUtils.lerp(1, easedMusicReactive.blobSpreadMultiplier, 0.28),
        morphProgress,
        reactiveSurfaceBoost: easedMusicReactive.surfaceBoost * 0.32,
        reactivePointerBoost: easedMusicReactive.pointerBoost * 0.24,
        reactiveFlowPhase: easedMusicReactive.flowPhase * 0.42,
        reactiveFlowSpeed: THREE.MathUtils.lerp(1, easedMusicReactive.flowSpeed, 0.42),
        reactiveRippleShift: easedMusicReactive.rippleShift * 0.36,
        reactiveCenterRoundness: shellCenterRoundness,
        forceNormals: forceAllNormals,
        normalInterval: NORMAL_UPDATE_INTERVALS.shell,
      });
      deformBlob(innerGeometry, elapsed, {
        baseRadius: 1.64 * 0.6 * innerCoreScale,
        bumpScale: sharedBlobBumpScale * coreSurfaceReaction * THREE.MathUtils.lerp(1, 0.54, limbReturnDamping),
        blobSpreadMultiplier: easedMusicReactive.blobSpreadMultiplier,
        lobeStrengthMultiplier: coreLobeReaction,
        lobePulseAmount: THREE.MathUtils.lerp(0.28, 0.045, limbReturnDamping),
        morphProgress,
        reactiveSurfaceBoost: easedMusicReactive.surfaceBoost * coreSurfaceReaction * coreReturnCalm,
        reactivePointerBoost: easedMusicReactive.pointerBoost * 0.8 * coreReturnCalm,
        reactiveFlowPhase: easedMusicReactive.flowPhase * THREE.MathUtils.lerp(1.1, 0.54, limbReturnDamping),
        reactiveFlowSpeed: THREE.MathUtils.lerp(easedMusicReactive.flowSpeed, 1, limbReturnDamping * 0.62),
        reactiveRippleShift: easedMusicReactive.rippleShift * THREE.MathUtils.lerp(0.9, 0.28, limbReturnDamping),
        reactiveCenterRoundness: 0,
        sphericalDirectionBlend: musicReactiveState.isPlaying || musicReactiveState.isActive ? 0.68 : 0,
        maxRadius: 1.58,
        forceNormals: forceAllNormals,
        normalInterval: NORMAL_UPDATE_INTERVALS.inner,
      });
      if (coatMaterial.opacity > 0) {
        deformBlob(coatGeometry, elapsed, {
          baseRadius: 1.648,
          coatScale: 0.012,
          bumpScale: THREE.MathUtils.lerp(0.34, 0.04, morphProgress),
          blobSpreadMultiplier: easedMusicReactive.blobSpreadMultiplier,
          morphProgress,
          reactiveSurfaceBoost: easedMusicReactive.surfaceBoost * 0.55,
          reactivePointerBoost: easedMusicReactive.pointerBoost * 0.4,
          reactiveFlowPhase: easedMusicReactive.flowPhase * 0.9,
          reactiveFlowSpeed: easedMusicReactive.flowSpeed,
          reactiveRippleShift: easedMusicReactive.rippleShift * 1.2,
          reactiveCenterRoundness: easedMusicReactive.centerRoundness * 0.82,
          forceNormals: forceAllNormals,
          normalInterval: NORMAL_UPDATE_INTERVALS.coat,
        });
      }
      const cubeSplitProgress = cubeSplit.update(splitProgress);
      const mainCubeOpacity = 1 - smoothstep(0, 0.35, splitProgress);
      shellMesh.visible = cubeSplitProgress < 0.995;
      innerMesh.visible = true;
      coatMesh.visible = coatMaterial.opacity > 0 && cubeSplitProgress < 0.995;
      glassMaterial.opacity = mainCubeOpacity;
      innerMaterial.transparent = true;
      innerMaterial.opacity = 1;
      const showCoreVersion = morphProgress > 0.965;
      if (showCoreVersion !== coreVersionMapVisible) {
        coreVersionMapVisible = showCoreVersion;
        innerMaterial.map = showCoreVersion ? coreSurfaceTexture : null;
        innerMaterial.color.set(showCoreVersion ? "#ffffff" : "#0b6b4f");
        innerMaterial.needsUpdate = true;
      }
      coatMaterial.opacity = Math.min(coatMaterial.opacity, mainCubeOpacity);

      autoRotationY = applySceneTransforms({
        dt,
        scrollProgress,
        morphProgress,
        responsiveSceneScale,
        autoRotateGroup,
        dragGroup,
        world,
        camera,
        baseRotation,
        pointer,
        dragRotation,
        autoRotationY,
      });
      surfaceHoverGrid.update({
        frame: deformFrameCount,
        scrollProgress,
        morphProgress,
        musicReactive: easedMusicReactive,
        musicReactiveState,
      });
      surfaceHoverDust.update({
        frame: deformFrameCount,
        elapsed,
        scrollProgress,
      });

      renderer.render(scene, camera);
    };

    const shouldPauseScene = () => {
      if (resources.disposed) return true;
      if (document.visibilityState === "hidden") return true;
      return scrollPauseState.shouldPause();
    };
    const renderLoop = resources.own(createRenderLoop({
      onFrame: renderFrame,
      onResize,
      onError,
      onShouldPause: shouldPauseScene,
      onScrollStateChange: () => scrollPauseState.refresh(),
    }));
    attachSceneEventBindings({ resources,
      canvas,
      pointerInput,
      renderLoop,
      onError,
    });

    resources.check();
    onResize();
    scrollPauseState.refresh();
    diagnostics?.enter("first-render-submission");
    renderFrame(0, 0);
    diagnostics?.complete();
    resources.check();
    renderLoop.start();
    void initializeEnvironmentStartup({
      loadEnvironment,
      cancelEnvironmentLoad,
      diagnostics,
      setEnvironmentTexture,
      setFallbackEnvironment,
      startupEnvironmentUrl: ENVIRONMENT_URLS["studio-hdr"],
      startupEnvironmentHint: "studio-hdr",
      statusController,
      resources,
    });
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }

}

// Grid and dust inspect the same shell in the same frame. Share the exact hit.
export function createSurfaceRaycast({ three: THREE, scene, camera, pointerInput, shellMesh }) {
  const raycaster = new THREE.Raycaster();
  const intersections = [];
  let lastFrame;
  let hit;
  return (frame) => {
    if (frame !== undefined && frame === lastFrame) return hit;
    lastFrame = frame;
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(pointerInput.pointer, camera);
    intersections.length = 0;
    raycaster.intersectObject(shellMesh, false, intersections);
    hit = intersections[0];
    return hit;
  };
}

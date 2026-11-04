// Base directions and anchor definitions are immutable for a scene's lifetime.
// Recreate the deformer if either changes. Keep doubles here so caching does
// not round the original JavaScript Math.pow result before deformation.
export function createAnchorInfluences({ vertexCount, baseDirections, anchorDefinitions }) {
  const anchorCount = anchorDefinitions.length;
  const influences = new Float64Array(vertexCount * anchorCount);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const offset = vertex * 3;
    const dx = baseDirections[offset];
    const dy = baseDirections[offset + 1];
    const dz = baseDirections[offset + 2];
    for (let index = 0; index < anchorCount; index += 1) {
      const anchor = anchorDefinitions[index];
      const dot = Math.max(0, dx * anchor.dir.x + dy * anchor.dir.y + dz * anchor.dir.z);
      influences[vertex * anchorCount + index] = Math.pow(dot, anchor.tightness);
    }
  }
  return influences;
}

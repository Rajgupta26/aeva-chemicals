// Exact maximum-dot lookup, with bounding boxes to skip unrelated vertices.
// Ties keep the original vertex order, matching the previous exhaustive scan.
export function createDirectionIndex(directions) {
  const build = (indices) => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const index of indices) {
      const p = directions[index];
      min[0] = Math.min(min[0], p.x); max[0] = Math.max(max[0], p.x);
      min[1] = Math.min(min[1], p.y); max[1] = Math.max(max[1], p.y);
      min[2] = Math.min(min[2], p.z); max[2] = Math.max(max[2], p.z);
    }
    if (indices.length <= 16) return { min, max, indices };
    const extent = max.map((value, axis) => value - min[axis]);
    const axis = extent.indexOf(Math.max(...extent));
    const key = ['x', 'y', 'z'][axis];
    indices.sort((a, b) => directions[a][key] - directions[b][key] || a - b);
    const middle = Math.floor(indices.length / 2);
    return { min, max, left: build(indices.slice(0, middle)), right: build(indices.slice(middle)) };
  };
  const root = build(directions.map((_, index) => index));
  return (direction) => {
    let bestIndex = 0;
    let bestDot = -Infinity;
    const upperBound = (node) =>
      direction.x * (direction.x >= 0 ? node.max[0] : node.min[0]) +
      direction.y * (direction.y >= 0 ? node.max[1] : node.min[1]) +
      direction.z * (direction.z >= 0 ? node.max[2] : node.min[2]);
    const visit = (node) => {
      // Include a rounding margin so pruning never drops equal-distance seams.
      if (upperBound(node) < bestDot - 1e-12) return;
      if (node.indices) {
        for (const index of node.indices) {
          const p = directions[index];
          const dot = direction.x * p.x + direction.y * p.y + direction.z * p.z;
          if (dot > bestDot || (dot === bestDot && index < bestIndex)) {
            bestDot = dot;
            bestIndex = index;
          }
        }
        return;
      }
      if (upperBound(node.left) >= upperBound(node.right)) {
        visit(node.left); visit(node.right);
      } else {
        visit(node.right); visit(node.left);
      }
    };
    visit(root);
    return bestIndex;
  };
}

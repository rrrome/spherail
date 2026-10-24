# Third-party notices

Spherail's GPL-3.0-only license does not replace the following third-party terms.

- **Three.js 0.164.1** is used by the 3D renderer under the MIT License.
  Copyright © 2010–2024 three.js authors. The full license is included at
  [Web/vendor/three/LICENSE](Web/vendor/three/LICENSE).
  Source: <https://github.com/mrdoob/three.js/tree/r164>.
- **3D textures:** Kenney, ambientCG and Poly Haven materials are CC0.
  Source links and attribution are preserved in
  [Web/textures/prototype-3d/CREDITS.md](Web/textures/prototype-3d/CREDITS.md).
  Runtime WebP maps and the ball matcap are carried over with the reference renderer.
- **esbuild 0.28.2** is an MIT-licensed build tool. It is installed by npm
  for bundling and is not required by the distributed app.
  Source: <https://github.com/evanw/esbuild>.
- **Pillow 12.3.0** is installed in the project's Python environment for
  resource generation and is not required by the distributed app.
  Its license is distributed with the installed Python package.

The 3D renderer's geometry, materials, lighting, camera configuration and input
logic are ported from the reference implementation. Local adapters supply maps,
language settings and saved results without a server. Regression tests pin the
reference rendering code and verify the local preview transport.

# Procedural Tree Scene module

This directory vendors the relevant AniGraph final-project source so the portfolio's tree module can be rebuilt. The new `src/TreeEmbed` entry point reuses the original tree, wind-field, billboard-leaf, and falling-leaf classes. It does not initialize the water simulator or water renderer.

The static build is published at `../tree-scene/`. To rebuild locally, install this project's dependencies and run `npm run build`, then copy the generated `build/` contents to `../tree-scene/`.

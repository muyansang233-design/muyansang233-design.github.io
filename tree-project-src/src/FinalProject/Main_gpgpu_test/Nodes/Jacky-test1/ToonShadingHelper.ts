// OutlineHelper.ts
import * as THREE from "three";
import { AGraphicElement } from "anigraph"

export function addOutlineToGraphic(
    ge: AGraphicElement,
    color: number = 0x000000,
    thickness: number = 0.1
) {
    const mesh = ge.threejs as THREE.Mesh;
    const geom = mesh.geometry;

    if (!geom) {
        console.warn("addOutlineToGraphic: graphic has no geometry.");
        return;
    }

    const outlineMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.BackSide,
    });

    const outlineMesh = new THREE.Mesh(geom, outlineMat);

    const s = 1.0 + thickness;
    outlineMesh.scale.set(s, s, s);

    mesh.add(outlineMesh);
}

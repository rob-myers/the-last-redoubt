import { fillRing } from "../service/dom";
import { warn } from "../service/log";

/**
 * @param {CanvasRenderingContext2D} ctxt 
 * @param {Nav.Zone} navZone 
 */
 export function drawTriangulation(ctxt, navZone) {
	const { groups, vertices } = navZone;
	for (const [index, tris] of groups.entries()) {
		if (index > 0) {
			warn(`drawTriangulation: drawing extra navZone group ${index} with ${tris.length} tris`);
			// continue;
		}
		for (const { vertexIds } of tris) {
			ctxt.beginPath();
			fillRing(ctxt, vertexIds.map(i => vertices[i]), false);
			ctxt.stroke();
		}
	}
}

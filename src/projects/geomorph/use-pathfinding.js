import { floorGraphClass } from "../graph/floor-graph";
import { useQuery } from "react-query";

/**
 * @param {Geomorph.LayoutKey} zoneKey 
 * @param {Geomorph.GeomorphData | undefined} gm
 * @param {boolean} [disabled]
 */
export default function usePathfinding(zoneKey, gm, disabled) {
  return useQuery(zoneKeyToQueryKey(zoneKey), () => {
    console.info(`computing floorGraph: ${zoneKey}`);
    return {
      graph: floorGraphClass.fromZone(/** @type {Geomorph.GeomorphData} */ (gm))
    };
  }, {
    enabled: !!gm && !disabled,
    keepPreviousData: true,
    staleTime: Infinity,
  });
}

/** @param {Geomorph.LayoutKey} zoneKey */
export function zoneKeyToQueryKey(zoneKey) {
  return `pathfinding-${zoneKey}`;
}

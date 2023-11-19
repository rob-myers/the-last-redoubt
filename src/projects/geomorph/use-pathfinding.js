import { useQuery } from "@tanstack/react-query";
import { info } from "../service/log";
import { floorGraphClass } from "../graph/floor-graph";

/**
 * @param {Geomorph.GeomorphKey} zoneKey 
 * @param {Geomorph.GeomorphData | undefined} gm
 * @param {boolean} [disabled]
 */
export default function usePathfinding(zoneKey, gm, disabled) {
  return useQuery({
    queryKey: [zoneKeyToQueryKey(zoneKey)],
    queryFn() {
      info(`computing floorGraph: ${zoneKey}`);
      return {
        graph: floorGraphClass.fromZone(/** @type {Geomorph.GeomorphData} */ (gm))
      };
    },
    enabled: !!gm && !disabled,
    // keepPreviousData: true,
    staleTime: Infinity,
  });
}

/** @param {Geomorph.GeomorphKey} zoneKey */
export function zoneKeyToQueryKey(zoneKey) {
  return `pathfinding-${zoneKey}`;
}

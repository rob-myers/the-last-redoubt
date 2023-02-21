import React from "react";
import { assertDefined } from "../service/generic";
import usePathfinding from "./use-pathfinding";

/**
 * @param {Graph.GmGraph} g
 * @param {boolean} [disabled]
 * @returns {Graph.FloorGraph[]}
 */
export default function useGeomorphsNav(g, disabled) {

  const [gmKeys, setGmKeys] = React.useState(() => g.gms.map(x => x.key));

  React.useMemo(() => {
    // Append unseen keys to layoutKeys i.e. monotonically increases
    const unseenKeys = g.gms.map(x => x.key).filter(x => !gmKeys.includes(x));
    if (unseenKeys.length) {
      setGmKeys([...gmKeys, ...unseenKeys]);
    }
  }, [g]);

  /* eslint-disable react-hooks/rules-of-hooks */
  const queries = gmKeys.map(key => {
    // Choose zoneKey to be geomorph key e.g. g-101--multipurpose
    return usePathfinding(key, g.gmData[key], disabled)
  });
  const ready = (
    g.gms.every(x => gmKeys.includes(x.key)) 
    && queries.every(x => x.data)
  );

  return React.useMemo(() => {
    if (ready) {
      const floorGraphs = g.gms.map(gm => {
        const queryIndex = gmKeys.findIndex(y => y === gm.key);
        const { graph } = assertDefined(queries[queryIndex].data)
        return graph;
      });
      return floorGraphs;
    } else {
      return [];
    }
  }, [ready]);

}

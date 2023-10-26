import React from "react";
import { assertDefined } from "../service/generic";
import { gmGraphClass } from "../graph/gm-graph";
import { gmRoomGraphClass } from "../graph/gm-room-graph";
import { geomorphDataToInstance } from "../service/geomorph";
import useGeomorphData from "./use-geomorph-data";

/**
 * @param {Geomorph.UseGeomorphsDefItem[]} defs 
 */
export default function useGeomorphs(defs, disabled = false) {

  const [gmKeys, setLayoutKeys] = React.useState(() => defs.map(x => x.gmKey));

  React.useMemo(() => {
    // Append unseen keys to layoutKeys i.e. monotonically increases
    const unseenKeys = defs.map(x => x.gmKey).filter(x => !gmKeys.includes(x));
    if (unseenKeys.length) {
      setLayoutKeys([...gmKeys, ...unseenKeys]);
    }
  }, [defs]);

  /* eslint-disable react-hooks/rules-of-hooks */
  const queries = gmKeys.map(layoutKey => useGeomorphData(layoutKey, disabled));
  const ready = (
    defs.every(x => gmKeys.includes(x.gmKey)) 
    && queries.every(x => x)
  );

  return React.useMemo(() => {
    if (ready) {
      const items = defs.map((def, gmId) => {
        const queryIndex = gmKeys.findIndex(y => y === def.gmKey);
        const data = assertDefined(queries[queryIndex])
        const transform = def.transform || [1, 0, 0, 1, 0, 0];
        return geomorphDataToInstance(data, gmId, transform);
      });
      /**
       * 🚧 fix throw on refetch a geomorph's json (?)
       */
      const gmGraph = gmGraphClass.fromGms(items);
      const gmRoomGraph = gmRoomGraphClass.fromGmGraph(gmGraph);
      return { gmGraph, gmRoomGraph };
    } else {
      return { gmGraph: new gmGraphClass([]), gmRoomGraph: new gmRoomGraphClass() };
    }
  }, [ready, ...queries.map(x => x)]);
}

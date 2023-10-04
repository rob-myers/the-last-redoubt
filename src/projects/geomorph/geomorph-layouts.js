/**
 * Hull symbol must be first.
 * @type {Record<Geomorph.GeomorphKey, Geomorph.LayoutDef>}
 */
const layoutDefs = {
  'g-101--multipurpose': {
    key: 'g-101--multipurpose',
    id: 101,
    items: [
      { symbol: '101--hull' },

      { items: [
        { symbol: 'fuel--010--2x4' },
        { symbol: 'fuel--010--2x4', x: 2 * 60 },
        { symbol: 'fuel--010--2x4' },
        { symbol: 'fuel--010--2x4', x: 2 * 60 },
      ]},
      { symbol: 'iris-valves--005--1x1', x: 14 * 60 },
      
      { y: 2 * 60, items: [
        { symbol: 'machinery--158--1.8x3.6', x: 12, y: 12, a: 270, },
        { symbol: 'stateroom--020--2x3', x: 12 + 2 * 60,  a: 90, flip: 'y' },
        { symbol: 'fresher--020--2x2', a: 90, flip: 'y' },
        { symbol: 'lounge--009--2x3', flip: 'xy' },
        { symbol: 'machinery--155--1.8x3.6', x: 2 * 60 + 12, y: 8, a: 270 },
      ]},

      { symbol: 'iris-valves--005--1x1', a: 270, y: 300 },
      { y: 4 * 60, x: 6 * 60, items: [
        { symbol: 'stateroom--018--2x3' },
        { symbol: 'stateroom--019--2x3', x: 4 * 60, flip: 'xy' },
      ]},

      { y: 6 * 60, items: [
        { symbol: 'empty-room--013--2x3', a: 90 },
        { symbol: 'medical--008--2x3', x: 1 * 60, a: 270, flip: 'y', doors: ['w'] },
        { symbol: 'stateroom--020--2x3', y: 1 * 60, a: 90, flip: 'xy' },
        { symbol: 'stateroom--020--2x3', x: 2 * 60, y: 1 * 60, a: 90, flip: 'x' },
        { symbol: 'fresher--025--2x3', a: 270, },
        { symbol: 'office--023--2x3', x: 1 * 60, a: 90, flip: 'x' },
      ]},

      { y: 8 * 60, items: [
        { symbol: 'empty-room--039--3x4', doors: ['e'], walls: [] },
        { symbol: 'office--061--3x4', x: 14 * 60 },
      ]},
      { symbol: 'lifeboat--small-craft', y: 8 * 60 + 12 },
      
      { y: 11 * 60, items: [
        { symbol: 'empty-room--013--2x3', y: 1 * 60, a: 270, flip: 'y', walls: ['n'] },
        { symbol: 'medical--007--2x3', x: 1 * 60, a: 90, doors: ['w'] },
        { symbol: 'office--026--2x3', a: 90 },
        { symbol: 'office--026--2x3', x: 2 * 60, a: 90, flip: 'y' },
        { symbol: 'fresher--025--2x3', a: 90, flip: 'y' },
        { symbol: 'office--023--2x3', x: 1 * 60, y: 1 * 60, a: 90 },
      ]},

      { y: 13 * 60, items: [
        { symbol: 'office--020--2x3', x: 6 * 60 },
        { symbol: 'office--020--2x3', x: 4 * 60, flip: 'y' },
      ]},
      { symbol: 'iris-valves--005--1x1', y: 14 * 60, x: 19 * 60, a: 90 },

      { y: 16 * 60, items: [
        { symbol: 'machinery--156--1.8x3.6', a: 270, y: -6 },
        { symbol: 'office--025--2x3', x: 2 * 60, a: 90, flip: 'y', doors: ['w'] },
        { symbol: 'machinery--091--1.6x1.8', x: 12 },
        { symbol: 'office--025--2x3', x: 12, a: 90, doors: ['w'] },
        { symbol: 'machinery--357--2.2x4', x: 2 * 60 },
      ]},

      { y: 18 * 60, items: [
        { symbol: 'fuel--010--2x4' },
        { symbol: 'fuel--010--2x4', x: 2 * 60 },
        { symbol: 'fuel--010--2x4' },
        { symbol: 'fuel--010--2x4', x: 2 * 60 },
      ]},
      { symbol: 'iris-valves--005--1x1', x: 5 * 60, y: 19 * 60, flip: 'y' },
    ],
  },

  'g-102--research-deck': {
    key: 'g-102--research-deck',
    id: 102,
    items: [
      { symbol: '102--hull' },
      { symbol: 'empty-room--060--4x4', flip: 'x' },
      { symbol: 'machinery--158--1.8x3.6', x: 12, y: 12 },
      { symbol: 'machinery--065--1.8x1.8', x: 4 * 60 - 6, y: 4 * 60 - 6 },
      { symbol: 'console--018--1x1', x: 3 * 60, flip: 'y' },
      { symbol: 'iris-valves--005--1x1', y: 5 * 60, a: 270 },

      { x: 6 * 60, items: [
        { symbol: 'lab--018--4x4', flip: 'x' },
        { symbol: 'lab--018--4x4', flip: 'xy' },
        { symbol: 'ships-locker--020--2x2', y: 2 * 60 },
        { symbol: 'ships-locker--007--1x2', flip: 'x', pause: true },
        { symbol: 'ships-locker--003--1x1', y: 1 * 60, a: 90,  pause: true },
        { symbol: 'ships-locker--003--1x1', a: 90 },
        { symbol: 'empty-room--019--2x4', x: 1 * 60, flip: 'y' },
      ]},
      { symbol: 'iris-valves--005--1x1', x: 14 * 60 },
      
      { y: 6 * 60, items: [
        { symbol: 'engineering--047--4x7', a: 90 },
        { symbol: 'office--004--2x2', a: 270, flip: 'x', doors: ['w'], pause: true },
        { symbol: 'stateroom--012--2x2', a: 90, flip: 'x' },
        { symbol: 'office--004--2x2', a: 270, flip: 'x', doors: ['w'], pause: true },
        { symbol: 'stateroom--012--2x2', a: 90, flip: 'x' },
        { symbol: 'lab--012--3x4', a: 270 },
        { symbol: 'lounge--017--2x4', x: 2 * 60, pause: true },
        { symbol: 'fresher--036--2x4', flip: 'x', doors: ['w'] },
      ]},

      { y: 10 * 60, items: [
        { symbol: 'misc-stellar-cartography--020--10x10', flip: 'y' },
        { symbol: 'lab--023--4x4', a: 90, pause: true },
        { symbol: 'engineering--045--4x6', a: 270 },
        { symbol: 'lab--023--4x4', x: 2 * 60, a: 90, flip: 'y', pause: true  },
        { symbol: 'lab--030--1x3', y: -1 * 60, pause: true },
        { symbol: 'office--074--4x4', y: 2 * 60, flip: 'y' },
      ]},
      { symbol: 'iris-valves--005--1x1', x: 19 * 60, y: 14 * 60, a: 90 },
    ],
  },

  'g-103--cargo-bay': {
    key: 'g-103--cargo-bay',
    id: 103,
    items: [
      { symbol: '103--hull' },

      { items: [
        // { symbol: 'empty-room--020--2x4', doors: [], walls: [] },
        { symbol: 'empty-room--039--3x4', x: 1 * 60, flip: 'y' },
        { symbol: 'cargo--003--2x4', x: 2 * 60 },
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--010--2x4', x: 2 * 60, doors: [], walls: [] },
        { symbol: 'office--055--2x4', },
      ]},

      { y: 6 * 60, x: 1 * 60, items: [
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', x: 2 * 60 },
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', },
      ]},
      { y: 10 * 60, x: 1 * 60, items: [
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', x: 2 * 60 },
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', },
        { symbol: 'cargo--003--2x4', },
      ]},

      { y: 16 * 60, items: [
        { symbol: 'cargo--002--2x2', pause: true },
        { symbol: 'cargo--002--2x2', },
        { symbol: 'cargo--002--2x2', pause: true},
        { symbol: 'cargo--002--2x2', },

        { symbol: 'empty-room--074--4x8', x: 2 * 60 },

        { symbol: 'cargo--002--2x2', x: 2 * 60, pause: true },
        { symbol: 'cargo--002--2x2', },
        { symbol: 'cargo--002--2x2', pause: true},
        { symbol: 'cargo--002--2x2', },
      ]},

    ],
  },

  'g-301--bridge': {
    key: 'g-301--bridge',
    id: 301,
    items: [
      { symbol: '301--hull' },
      // { symbol: 'weaponry--013--1x2', x: 3 * 60, y: -1 * 60, flip: 'y' },
      // { symbol: 'weaponry--013--1x2', x: 14 * 60, y: -1 * 60 },

      { symbol: 'extra--table--001--1x0.16', x: 2 * 60, y: 5 * 60 + 48 },
      { symbol: 'extra--table--004--0.33x0.16', x: 3 * 60 + 36, y: 4 * 60 + 6 },
      { y: 6 * 60, x: 5 * 60 + 48, items: [
        { symbol: 'extra--table--004--0.33x0.16', a: 90, pause: true },
        { symbol: 'extra--table--004--0.33x0.16', y: 6, a: 90, pause: true },
        { symbol: 'extra--table--001--1x0.16', a: 90, y: 12, pause: true },
        { symbol: 'extra--table--001--1x0.16', a: 90, y: 6 },
      ]},

      { items: [
        { symbol: 'stateroom--036--2x4' },
        { symbol: 'office--001--2x2', y: 2 * 60, flip: 'y', doors: ['s'] },
        { symbol: 'console--031--1x1.2', y: 1 * 60, x: 1 * 60, flip: 'y' },
        { symbol: 'bridge--042--8x9', y: 1 * 60, },
        { symbol: 'console--031--1x1.2', y: 1 * 60, x: 0 },
        { symbol: 'office--001--2x2', y: 2 * 60, x: 1 * 60, doors: ['s'] },
        { symbol: 'stateroom--036--2x4', flip: 'y' },
      ]},

      { y: 6 * 60, items: [
        { symbol: 'stateroom--014--2x2', flip: 'x', pause: true },
        { symbol: 'stateroom--036--2x4', a: 270 },
        { symbol: 'stateroom--014--2x2', x: -2 * 60, flip: 'x' },
        { symbol: 'misc-stellar-cartography--023--4x4', x: 12 * 60, flip: 'y' },
      ]},

      { symbol: 'iris-valves--005--1x1', y: 5 * 60, a: 270 },
      { symbol: 'iris-valves--005--1x1', y: 4 * 60, x: 19 * 60, a: 90 },
      { symbol: 'iris-valves--005--1x1', y: 9 * 60, x: 5 * 60, a: 180 },
      { symbol: 'iris-valves--005--1x1', y: 9 * 60, x: 15 * 60, a: 180 },
    ],
  },
  'g-302--xboat-repair-bay': {
    key: 'g-302--xboat-repair-bay',
    id: 302,
    items: [
      { symbol: '302--hull' },
      { symbol: 'office--006--2x2', y: 2 * 60, a: 90, doors: ['e', 'w'] },
      { symbol: 'sensors--003--1x1.4', transform: [...getAngleMatrix(45), 90 + 6, -60] },

      { y: 7 * 60, x: 4 * 60, items: [
        { symbol: 'lounge--015--2x4', flip: 'xy' },
        { symbol: 'ships-locker--011--1x2', a: 90, },
        { symbol: 'empty-room--006--2x2', x: -1 * 60, a: 90, doors: ['e'] },
        { symbol: 'shop--028--0.8x1.6', a: 90 },
        { symbol: 'shop--027--0.4x1.6', x: 2 * 60 + 12, y: 1 * 60 + 24, flip: 'x' },
      ]},
      { symbol: 'window--007--0x2.4', y: 7 * 60 - 8, x: 4 * 60, },
    ],
  },
  "g-303--passenger-deck": {
    key: 'g-303--passenger-deck',
    id: 303,
    items: [
      { symbol: '303--hull' },

      { items: [
        { symbol: 'medical-bed--006--1.6x3.6', y: 12 },
        { symbol: 'low-berth--003--1x1', x: 24 + 1 * 60, a: 90, pause: true },
        { symbol: 'console--022--1x2', flip: 'y' },
        { symbol: 'stateroom--035--2x3' },
        { symbol: 'stateroom--035--2x3' },
        { symbol: 'stateroom--035--2x3' },
        { symbol: 'stateroom--035--2x3', flip: 'y' },
        { symbol: 'stateroom--100--3x4', a: 90, flip: 'x' },
        { symbol: 'galley-and-mess-halls--006--2x4', flip: 'y', pause: true },
        { symbol: 'table--009--0.8x0.8', pause: true },
        { symbol: 'table--009--0.8x0.8', y: 1 * 60 },
      ]},

      { x: 1 * 60 + 30, y: -6, items: [
        { symbol: 'window--001--0x1' },
        { symbol: 'window--001--0x1', x: 2 * 60 },
        { symbol: 'window--001--0x1', x: 1 * 60 },
        { symbol: 'window--001--0x1', x: 1 * 60 },
        { symbol: 'window--001--0x1', x: 1 * 60 },
      ]},
      // { symbol: 'window--001--0x1', transform: [1, 0, 0, 1, 870, -6] },

      { symbol: 'iris-valves--005--1x1', x: 19 * 60, y: 4 * 60, a: 90 },
      { symbol: 'iris-valves--005--1x1', y: 9 * 60, x: 5 * 60, flip: 'y' },

      { x: 3 * 60, y: 4 * 60, items: [
        { symbol: 'fresher--002--0.4x0.6', flip: 'x' },
        { symbol: 'gaming-tables--001--1x2', x: 4 * 60, },
        { symbol: 'couch-and-chairs--006--0.4x2', x: 1 * 60 + 12, flip: 'y' },
        { symbol: 'couch-and-chairs--006--0.4x2', x: 24, a: 90 },
      ]},

      { symbol: 'machinery--077--1.6x1.8', y: 6 * 60 + 16, x: 1 * 60 - 6, a: 90 },
      { symbol: 'machinery--077--1.6x1.8', y: 7 * 60 + 16, x: 2 * 60 + 6, flip: 'y' },
      { symbol: 'console--018--1x1', y: 8 * 60, x: 1 * 60, flip: 'y' },

      { x: 6 * 60, y: 6 * 60, items: [
        { symbol: 'stateroom--036--2x4', flip: 'x' },
        { symbol: 'stateroom--036--2x4', flip: 'x' },
        { symbol: 'stateroom--036--2x4', flip: 'xy' },
        { symbol: 'stateroom--036--2x4', flip: 'xy' },
        { symbol: 'office--089--4x4', x: 2 * 60, flip: 'y' },
      ]},

    ],
  },
};

export default layoutDefs;

/**
 * @param {number} degrees 
 * @returns {[number, number, number, number]}
 */
function getAngleMatrix(degrees) {
  const rads = degrees * (Math.PI / 180);
  return [
    Math.cos(rads), // a
    Math.sin(rads), // b
    -Math.sin(rads),// c
    Math.cos(rads), // d
  ];
}

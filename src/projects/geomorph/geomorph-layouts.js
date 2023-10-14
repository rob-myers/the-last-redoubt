/**
 * Hull symbol must be first.
 * @type {Record<Geomorph.GeomorphKey, Geomorph.LayoutDef>}
 */
const layoutDefs = {
  'g-101--multipurpose': {
    key: 'g-101--multipurpose',
    id: 101,
    items: [
      { id: '101--hull' },

      { cs: [
        { id: 'fuel--010--2x4' },
        { id: 'fuel--010--2x4', x: 2 * 60 },
        { id: 'fuel--010--2x4' },
        { id: 'fuel--010--2x4', x: 2 * 60 },
      ]},
      { id: 'iris-valves--005--1x1', x: 14 * 60 },
      
      { y: 2 * 60, cs: [
        { id: 'machinery--158--1.8x3.6', x: 12, y: 12, a: 270, },
        { id: 'stateroom--020--2x3', x: 12 + 2 * 60,  a: 90, flip: 'y' },
        { id: 'fresher--020--2x2', a: 90, flip: 'y' },
        { id: 'lounge--009--2x3', flip: 'xy' },
        { id: 'machinery--155--1.8x3.6', x: 2 * 60 + 12, y: 8, a: 270 },
      ]},

      { id: 'iris-valves--005--1x1', a: 270, y: 300 },
      { y: 4 * 60, x: 6 * 60, cs: [
        { id: 'stateroom--018--2x3' },
        { id: 'stateroom--019--2x3', x: 4 * 60, flip: 'xy' },
      ]},

      { y: 6 * 60, cs: [
        { id: 'empty-room--013--2x3', a: 90 },
        { id: 'medical--008--2x3', x: 1 * 60, a: 270, flip: 'y', doors: ['w'] },
        { id: 'stateroom--020--2x3', y: 1 * 60, a: 90, flip: 'xy' },
        { id: 'stateroom--020--2x3', x: 2 * 60, y: 1 * 60, a: 90, flip: 'x' },
        { id: 'fresher--025--2x3', a: 270, },
        { id: 'office--023--2x3', x: 1 * 60, a: 90, flip: 'x' },
      ]},

      { y: 8 * 60, cs: [
        { id: 'empty-room--039--3x4', doors: ['e'], walls: ['e'] },
        { id: 'office--061--3x4', x: 14 * 60 },
      ]},
      { id: 'lifeboat--small-craft', y: 8 * 60 + 12 },
      
      { y: 11 * 60, cs: [
        { id: 'empty-room--013--2x3', y: 1 * 60, a: 270, flip: 'y', walls: ['n'] },
        { id: 'medical--007--2x3', x: 1 * 60, a: 90, doors: ['w'] },
        { id: 'office--026--2x3', a: 90 },
        { id: 'office--026--2x3', x: 2 * 60, a: 90, flip: 'y' },
        { id: 'fresher--025--2x3', a: 90, flip: 'y' },
        { id: 'office--023--2x3', x: 1 * 60, y: 1 * 60, a: 90 },
      ]},

      { y: 13 * 60, cs: [
        { id: 'office--020--2x3', x: 6 * 60 },
        { id: 'office--020--2x3', x: 4 * 60, flip: 'y' },
      ]},
      { id: 'iris-valves--005--1x1', y: 14 * 60, x: 19 * 60, a: 90 },

      { y: 16 * 60, cs: [
        { id: 'machinery--156--1.8x3.6', a: 270, y: -6 },
        { id: 'office--025--2x3', x: 2 * 60, a: 90, flip: 'y', doors: ['w'] },
        { id: 'machinery--091--1.6x1.8', x: 12 },
        { id: 'office--025--2x3', x: 12, a: 90, doors: ['w'] },
        { id: 'machinery--357--2.2x4', x: 2 * 60 },
      ]},

      { y: 18 * 60, cs: [
        { id: 'fuel--010--2x4' },
        { id: 'fuel--010--2x4', x: 2 * 60 },
        { id: 'fuel--010--2x4' },
        { id: 'fuel--010--2x4', x: 2 * 60 },
      ]},
      { id: 'iris-valves--005--1x1', x: 5 * 60, y: 19 * 60, flip: 'y' },
    ],
  },

  'g-102--research-deck': {
    key: 'g-102--research-deck',
    id: 102,
    items: [
      { id: '102--hull' },
      { id: 'empty-room--060--4x4', flip: 'x' },
      { id: 'machinery--158--1.8x3.6', x: 12, y: 12 },
      { id: 'machinery--065--1.8x1.8', x: 4 * 60 - 6, y: 4 * 60 - 6 },
      { id: 'console--018--1x1', x: 3 * 60, flip: 'y' },
      { id: 'iris-valves--005--1x1', y: 5 * 60, a: 270 },

      { x: 6 * 60, cs: [
        { id: 'lab--018--4x4', flip: 'x' },
        { id: 'lab--018--4x4', flip: 'xy' },
        { id: 'ships-locker--020--2x2', y: 2 * 60 },
        { id: 'ships-locker--007--1x2', flip: 'x', next: 'down' },
        { id: 'ships-locker--003--1x1', y: 1 * 60, a: 90,  next: 'down' },
        { id: 'ships-locker--003--1x1', a: 90 },
        { id: 'empty-room--019--2x4', x: 1 * 60, flip: 'y' },
      ]},
      { id: 'iris-valves--005--1x1', x: 14 * 60 },
      
      { y: 6 * 60, cs: [
        { id: 'engineering--047--4x7', a: 90 },
        { id: 'office--004--2x2', a: 270, flip: 'x', doors: ['w'], next: 'down' },
        { id: 'stateroom--012--2x2', a: 90, flip: 'x' },
        { id: 'office--004--2x2', a: 270, flip: 'x', doors: ['w'], next: 'down' },
        { id: 'stateroom--012--2x2', a: 90, flip: 'x' },
        { id: 'lab--012--3x4', a: 270 },
        { id: 'lounge--017--2x4', x: 2 * 60, next: 'down' },
        { id: 'fresher--036--2x4', flip: 'x', doors: ['w'] },
      ]},

      { y: 10 * 60, cs: [
        { id: 'misc-stellar-cartography--020--10x10', flip: 'y' },
        { id: 'lab--023--4x4', a: 90, next: 'down' },
        { id: 'engineering--045--4x6', a: 270 },
        { id: 'lab--023--4x4', x: 2 * 60, a: 90, flip: 'y', next: 'down'  },
        { id: 'lab--030--1x3', y: -1 * 60, next: 'down' },
        { id: 'office--074--4x4', y: 2 * 60, flip: 'y' },
      ]},
      { id: 'iris-valves--005--1x1', x: 19 * 60, y: 14 * 60, a: 90 },
    ],
  },

  'g-103--cargo-bay': {
    key: 'g-103--cargo-bay',
    id: 103,
    items: [
      { id: '103--hull' },

      { cs: [
        // { symbol: 'empty-room--020--2x4', doors: [], walls: [] },
        { id: 'empty-room--039--3x4', x: 1 * 60, flip: 'y' },
        { id: 'cargo--003--2x4', x: 2 * 60 },
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', },
        { id: 'cargo--010--2x4', x: 2 * 60, doors: [], walls: [] },
        { id: 'office--055--2x4', },
      ]},

      { y: 6 * 60, x: 1 * 60, cs: [
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', x: 2 * 60 },
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', },
      ]},
      { y: 10 * 60, x: 1 * 60, cs: [
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', x: 2 * 60 },
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', },
        { id: 'cargo--003--2x4', },
      ]},

      { y: 16 * 60, cs: [
        { id: 'cargo--002--2x2', next: 'down' },
        { id: 'cargo--002--2x2', },
        { id: 'cargo--002--2x2', next: 'down'},
        { id: 'cargo--002--2x2', },

        { id: 'empty-room--074--4x8', x: 2 * 60 },

        { id: 'cargo--002--2x2', x: 2 * 60, next: 'down' },
        { id: 'cargo--002--2x2', },
        { id: 'cargo--002--2x2', next: 'down'},
        { id: 'cargo--002--2x2', },
      ]},

    ],
  },

  'g-301--bridge': {
    key: 'g-301--bridge',
    id: 301,
    items: [
      { id: '301--hull' },
      // { id: 'weaponry--013--1x2', x: 3 * 60, y: -1 * 60, flip: 'y' },
      // { id: 'weaponry--013--1x2', x: 14 * 60, y: -1 * 60 },

      { id: 'stateroom--036--2x4' },
      { at: '👉', id: 'office--001--2x2', y: 2 * 60, flip: 'y', doors: ['s'] },
      { at: '👉', id: 'console--031--1x1.2', x: 1 * 60, y: -1 * 60, flip: 'y' },
      { at: '👉', id: 'bridge--042--8x9' },
      { at: '👉', id: 'console--031--1x1.2'},
      { at: '👉', id: 'office--001--2x2', x: 1 * 60, y: 1 * 60, doors: ['s'] },
      { at: '👉', id: 'stateroom--036--2x4', y: -2 * 60, flip: 'y' },

      { id: 'stateroom--014--2x2', y: 6 * 60, flip: 'x' },
      { at: '👉', id: 'stateroom--014--2x2', flip: 'x' },
      { at: '⏪👇', id: 'stateroom--036--2x4', a: 270 },

      { id: 'misc-stellar-cartography--023--4x4', x: 16 * 60,  y: 6 * 60, flip: 'y' },
    ],
  },
  'g-302--xboat-repair-bay': {
    key: 'g-302--xboat-repair-bay',
    id: 302,
    items: [
      { id: '302--hull' },
      { id: 'office--006--2x2', y: 2 * 60, a: 90, doors: ['e', 'w'] },
      { id: 'sensors--003--1x1.4', transform: [...getAngleMatrix(45), 90 + 6, -60] },

      { id: 'lounge--015--2x4', x: 4 * 60, y: 7 * 60, flip: 'xy' },
      { at: '👉', id: 'ships-locker--011--1x2', a: 90, },
      { at: '👉', id: 'empty-room--006--2x2', x: -1 * 60, a: 90, doors: ['e'] },
      { at: '👉', id: 'shop--028--0.8x1.6', a: 90 },
      { at: '👉', id: 'shop--027--0.4x1.6', x: 2 * 60 + 12, y: 1 * 60 + 24, flip: 'x' },

      { id: 'window--007--0x2.4', y: 7 * 60 - 8, x: 4 * 60, },
      
      { id: 'empty-room--020--2x4', x: 18 * 60, flip: 'xy' },
    ],
  },
  "g-303--passenger-deck": {
    key: 'g-303--passenger-deck',
    id: 303,
    items: [
      { id: '303--hull' },

      { id: 'medical-bed--006--1.6x3.6', y: 12 },
      { at: '👉', id: 'low-berth--003--1x1', x: 24 + 1 * 60, y: -12, a: 90 },
      { at: '👇', id: 'console--022--1x2', flip: 'y' },
      { at: '⏪👉', id: 'stateroom--035--2x3' },
      { at: '👉', id: 'stateroom--035--2x3' },
      { at: '👉', id: 'stateroom--035--2x3' },
      { at: '👉', id: 'stateroom--035--2x3', flip: 'y' },
      { at: '👉', id: 'stateroom--100--3x4', a: 90, flip: 'x' },
      { at: '👉', id: 'galley-and-mess-halls--006--2x4', flip: 'y' },
      { at: '👇', id: 'table--009--0.8x0.8' },
      { at: '👇', id: 'table--009--0.8x0.8', y: 1 * 60 },

      { x: 1 * 60 + 30, y: -6, cs: [
        { id: 'window--001--0x1' },
        { id: 'window--001--0x1', x: 2 * 60 },
        { id: 'window--001--0x1', x: 1 * 60 },
        { id: 'window--001--0x1', x: 1 * 60 },
        { id: 'window--001--0x1', x: 1 * 60 },
      ]},
      // { symbol: 'window--001--0x1', transform: [1, 0, 0, 1, 870, -6] },

      { id: 'iris-valves--005--1x1', x: 19 * 60, y: 4 * 60, a: 90 },
      { id: 'iris-valves--005--1x1', y: 9 * 60, x: 5 * 60, flip: 'y' },

      { x: 3 * 60, y: 4 * 60, cs: [
        { id: 'fresher--002--0.4x0.6', flip: 'x' },
        { id: 'gaming-tables--001--1x2', x: 4 * 60, },
        { id: 'couch-and-chairs--006--0.4x2', x: 1 * 60 + 12, flip: 'y' },
        { id: 'couch-and-chairs--006--0.4x2', x: 24, a: 90 },
      ]},

      { id: 'machinery--077--1.6x1.8', y: 6 * 60 + 16, x: 1 * 60 - 6, a: 90 },
      { id: 'machinery--077--1.6x1.8', y: 7 * 60 + 16, x: 2 * 60 + 6, flip: 'y' },
      { id: 'console--018--1x1', y: 8 * 60, x: 1 * 60, flip: 'y' },

      { x: 6 * 60, y: 6 * 60, cs: [
        { id: 'stateroom--036--2x4', flip: 'x' },
        { id: 'stateroom--036--2x4', flip: 'x' },
        { id: 'stateroom--036--2x4', flip: 'xy' },
        { id: 'stateroom--036--2x4', flip: 'xy' },
        { id: 'office--089--4x4', x: 2 * 60, flip: 'y' },
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

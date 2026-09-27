/* Shared, synthetic sample content for every Linejam polish prototype.
   Harmless lines written for review; word counts follow the real rule 1,2,3,4,5,4,3,2,1.
   "You" are Juniper (the host) unless a state says otherwise. */
(function () {
  const WORD_COUNTS = [1, 2, 3, 4, 5, 4, 3, 2, 1];

  const players = [
    { id: 'juniper', name: 'Juniper', avatar: 'orbit', host: true },
    { id: 'wren', name: 'Wren', avatar: 'pebble' },
    { id: 'basil', name: 'Basil', avatar: 'ziggy' },
    { id: 'marguerite', name: 'Marguerite Okonkwo-Castellanos', avatar: 'moss' },
  ];
  /* Joins after the game starts: watches this game, plays the next. */
  const lateJoiner = { id: 'pim', name: 'Pim', avatar: 'plum', spectator: true };

  const byId = Object.fromEntries([...players, lateJoiner].map((p) => [p.id, p]));

  const poems = [
    {
      number: 1,
      reader: 'marguerite',
      lines: [
        ['Lanterns', 'juniper'],
        ['hum softly', 'wren'],
        ['moths applaud politely', 'basil'],
        ['the kettle keeps secrets', 'marguerite'],
        ['and nobody asked the moon', 'juniper'],
        ['while the soup cooled', 'wren'],
        ['under the porch', 'basil'],
        ['still humming', 'marguerite'],
        ['Again', 'juniper'],
      ],
    },
    {
      number: 2,
      reader: 'basil',
      lines: [
        ['Morning', 'wren'],
        ['burnt toast', 'basil'],
        ['a borrowed bicycle', 'marguerite'],
        ['the tide forgot us', 'juniper'],
        ['we danced until the fridge', 'wren'],
        ['folded into paper boats', 'basil'],
        ["a stranger's coat", 'marguerite'],
        ['tiny thunder', 'juniper'],
        ['Tomorrow', 'wren'],
      ],
    },
    {
      number: 3,
      reader: 'wren',
      lines: [
        ['Salt', 'basil'],
        ['under stairs', 'marguerite'],
        ["grandmother's blue umbrella", 'juniper'],
        ['someone left the gate', 'wren'],
        ['all the pigeons wore hats', 'basil'],
        ['and nobody minded much', 'marguerite'],
        ['pockets full of', 'juniper'],
        ['warm bread', 'wren'],
        ['Yes', 'basil'],
      ],
    },
    {
      number: 4,
      reader: 'juniper',
      lines: [
        ['Thunder', 'marguerite'],
        ["somebody's aunt", 'juniper'],
        ['counting the spoons', 'wren'],
        ['a dog named Tuesday', 'basil'],
        ['the radio laughed like snow', 'marguerite'],
        ['then the lights agreed', 'juniper'],
        ['we said goodbye', 'wren'],
        ['almost home', 'basil'],
        ['Onward', 'marguerite'],
      ],
    },
  ];

  /* Juniper's assignment per round: which poem, and the line they received. */
  const assignments = WORD_COUNTS.map((target, roundIndex) => {
    const poem = poems.find((p) => p.lines[roundIndex][1] === 'juniper');
    return {
      round: roundIndex + 1,
      target,
      poem: poem.number,
      previousLine: roundIndex === 0 ? null : poem.lines[roundIndex - 1][0],
      yourLine: poem.lines[roundIndex][0],
    };
  });

  window.LJ = window.LJ || {};
  window.LJ.room = {
    code: '9AUK',
    codeDisplay: '9A UK',
    joinUrl: 'https://linejam.app/join?code=9AUK',
    capacity: 8,
    WORD_COUNTS,
    players,
    lateJoiner,
    byId,
    poems,
    assignments,
    you: 'juniper',
  };
})();

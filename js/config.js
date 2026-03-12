// wplog — Rules Configuration
// USAWP only for now. Structure supports future NFHS/NCAA additions.

const RULES = {
  USAWP: {
    name: "USA Water Polo",
    periods: 4,
    overtime: false,
    shootout: true,
    events: [
      { name: "Goal",              code: "G" },
      { name: "Exclusion",         code: "E" },
      { name: "E-Game",            code: "E-Game", autoFoulOut: 1 },
      { name: "Penalty",           code: "P" },
      { name: "Penalty-Exclusion", code: "P-E" },
      { name: "Timeout",           code: "TO",   noPlayer: true },
      { name: "Timeout 30",        code: "TO30", noPlayer: true },
      { name: "Yellow Card",       code: "YC" },
      { name: "Red Card",          code: "RC" },
      { name: "Misconduct",        code: "MC",   autoFoulOut: 1 },
      { name: "Brutality",         code: "BR",   autoFoulOut: 1 },
    ],
    foulOutLimit: 3,
  },
};

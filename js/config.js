// wplog — Rules Configuration
// USAWP only for now. Structure supports future NFHS/NCAA additions.
//
// Each event has:
//   name       — display name
//   code       — internal code stored in the log
//   color      — CSS color class: "green", "amber", "orange", "blue", "yellow", "red"
//   align      — (optional) sheet Code column alignment: "left", "right", "center" (default: "center")
//   noPlayer   — (optional) true if event has no player (e.g. timeout)
//   autoFoulOut — (optional) 1 = immediate ejection, 2 = after 2nd occurrence
//
// Events are listed in order of typical game frequency (most frequent first).

const RULES = {
  USAWP: {
    name: "USA Water Polo",
    periods: 4,
    periodLength: 8,       // quarter length in minutes (3-9)
    otPeriodLength: null,   // no OT by default; 3 min when enabled
    overtime: false,
    shootout: true,
    events: [
      { name: "Goal", code: "G", color: "green", align: "left" },
      { name: "Exclusion", code: "E", color: "amber", align: "right", isPersonalFoul: true },
      { name: "Penalty", code: "P", color: "amber", align: "right", isPersonalFoul: true },
      { name: "Timeout", code: "TO", color: "blue", noPlayer: true, align: "center" },
      { name: "Penalty-Exclusion", code: "P-E", color: "amber", align: "right", isPersonalFoul: true },
      { name: "Timeout 30", code: "TO30", color: "blue", align: "center", noPlayer: true },
      { name: "Yellow Card", code: "YC", color: "yellow", align: "center" },
      { name: "Misconduct", code: "MC", color: "red", align: "right", autoFoulOut: 1 },
      { name: "Brutality", code: "BR", color: "red", align: "right", autoFoulOut: 1 },
      { name: "Red Card", code: "RC", color: "red", align: "center" },
      { name: "Game Exclusion", code: "E-Game", color: "red", align: "right", autoFoulOut: 1 },

    ],
    foulOutLimit: 3,
    timeouts: { full: 2, to30: 0 },
  },
};

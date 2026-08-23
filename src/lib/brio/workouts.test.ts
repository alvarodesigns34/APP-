import { describe, expect, it } from "vitest";
import { defaultState, emptyDay } from "./persist";
import { recentSports, searchSports } from "./workouts";
import type { PersistedState, WorkoutEntry } from "./types";

function withWorkouts(days: Record<string, string[]>): PersistedState {
  const s = defaultState();
  for (const [date, types] of Object.entries(days)) {
    const day = emptyDay();
    day.workouts = types.map(
      (type, i): WorkoutEntry => ({ id: `${date}-${i}`, type, min: 45, intensity: "media", kcal: 300 }),
    );
    s.days[date] = day;
  }
  return s;
}

describe("recentSports", () => {
  it("is empty until something is logged", () => {
    expect(recentSports(defaultState())).toEqual([]);
  });

  it("lists distinct sports newest first", () => {
    const s = withWorkouts({
      "2026-08-20": ["padel"],
      "2026-08-21": ["natacion"],
      "2026-08-22": ["carrera"],
    });
    expect(recentSports(s).map((a) => a.id)).toEqual(["carrera", "natacion", "padel"]);
  });

  it("keeps only the most recent entry of a repeated sport", () => {
    const s = withWorkouts({
      "2026-08-18": ["carrera"],
      "2026-08-19": ["padel"],
      "2026-08-20": ["carrera"],
      "2026-08-21": ["yoga"],
    });
    expect(recentSports(s).map((a) => a.id)).toEqual(["yoga", "carrera", "padel"]);
  });

  it("caps the row at the requested limit", () => {
    const s = withWorkouts({
      "2026-08-17": ["boxeo"],
      "2026-08-18": ["tenis"],
      "2026-08-19": ["remo"],
      "2026-08-20": ["ciclismo"],
      "2026-08-21": ["yoga"],
    });
    expect(recentSports(s, 4).map((a) => a.id)).toEqual(["yoga", "ciclismo", "remo", "tenis"]);
    expect(recentSports(s, 2).map((a) => a.id)).toEqual(["yoga", "ciclismo"]);
  });

  it("drops sports that are no longer in the catalog", () => {
    // activityOf() falls back to the first sport for an unknown id, so a stale
    // type would render a chip labelled "Fuerza" that logs something else.
    const s = withWorkouts({ "2026-08-21": ["deporte-que-ya-no-existe"], "2026-08-22": ["padel"] });
    expect(recentSports(s).map((a) => a.id)).toEqual(["padel"]);
  });

  it("orders two sessions on the same day by the newest entry", () => {
    const s = withWorkouts({ "2026-08-22": ["padel", "carrera"] });
    // allSessions sorts same-day entries by descending id, and ids grow over
    // time, so the last one logged leads.
    expect(recentSports(s).map((a) => a.id)).toEqual(["carrera", "padel"]);
  });
});

describe("searchSports", () => {
  it("returns the whole list for an empty or blank query", () => {
    expect(searchSports("").length).toBeGreaterThan(40);
    expect(searchSports("   ").length).toBe(searchSports("").length);
  });

  it("ignores accents and case in both directions", () => {
    expect(searchSports("padel").map((a) => a.id)).toEqual(["padel"]);
    expect(searchSports("PÁDEL").map((a) => a.id)).toEqual(["padel"]);
    expect(searchSports("natacion").map((a) => a.id)).toEqual(["natacion"]);
  });

  it("matches anywhere in the name", () => {
    expect(searchSports("marcia").map((a) => a.id)).toEqual(["marciales"]);
    expect(searchSports("indoor").map((a) => a.id)).toEqual(["spinning"]);
  });

  it("puts prefix matches before mid-word ones", () => {
    // "Marcha con mochila" starts with it, "Artes marciales" only contains it.
    expect(searchSports("mar").map((a) => a.id)).toEqual(["rucking", "marciales"]);
    // Catalog order otherwise survives: the three "Es…" sports keep it.
    expect(searchSports("es").map((a) => a.id).slice(0, 3)).toEqual(["escaleras", "escalada", "esqui"]);
  });

  it("returns nothing for a sport the catalog does not have", () => {
    expect(searchSports("quidditch")).toEqual([]);
  });

  it("filters the list it is given, not just the catalog", () => {
    const list = [
      { id: "a", n: "Ajedrez", met: 1.5, ico: "", g: "mente" },
      { id: "b", n: "Baile", met: 6.5, ico: "", g: "mente" },
    ];
    expect(searchSports("bail", list).map((a) => a.id)).toEqual(["b"]);
  });
});

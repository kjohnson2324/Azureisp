import countries from '../../../content/countries/dist/countries.json';
import sample from '../../../content/samples/mission.vanishing-tower.json';
import { Clue, ContentEnvelope, Country, Mission } from '../schemas';

const clueIndex = new Map(countries.flatMap((c) => c.clues.map((k) => [k.id, Clue.parse(k)] as const)));

describe('sample mission', () => {
  it('envelope is tagged with grade band and standards', () => {
    const env = ContentEnvelope.parse(sample.mission);
    expect(env.grade_bands.length).toBeGreaterThan(0);
    expect(env.standard_ids.length).toBeGreaterThan(0);
  });

  it('has 3-5 stops and a valid trail', () => {
    const mission = Mission.parse(sample.mission.data);
    expect(mission.stops.length).toBeGreaterThanOrEqual(3);
    expect(mission.stops.length).toBeLessThanOrEqual(5);
  });

  it('every referenced clue exists in the seeded countries', () => {
    for (const stop of Mission.parse(sample.mission.data).stops) {
      for (const id of stop.clueIds) expect(clueIndex.has(id)).toBe(true);
    }
  });

  it('rejects a trail whose choices skip the next stop', () => {
    const broken = structuredClone(sample.mission.data);
    broken.stops[0]!.choices = ['MX', 'IN'];
    expect(Mission.safeParse(broken).success).toBe(false);
  });
});

describe('seeded countries', () => {
  it('contains exactly 195 valid countries', () => {
    expect(countries).toHaveLength(195);
    for (const c of countries) expect(Country.safeParse(c).success).toBe(true);
  });

  it('has 975 uniquely identified clues', () => {
    expect(clueIndex.size).toBe(975);
  });

  it('never names the country inside its own clues', () => {
    for (const c of countries) {
      for (const k of c.clues) {
        expect(k.text.en.toLowerCase()).not.toContain(c.name.en.toLowerCase());
        expect(k.text.es.toLowerCase()).not.toContain(c.name.es.toLowerCase());
      }
    }
  });

  it('keeps Spanish clues free of gendered nouns for the thief', () => {
    for (const c of countries) for (const k of c.clues) expect(k.text.es).not.toMatch(/ladr[oó]n|ladrona/i);
  });

  it('offers at least one easy clue per country for K-2', () => {
    for (const c of countries) expect(c.clues.some((k) => k.difficulty === 1)).toBe(true);
  });
});

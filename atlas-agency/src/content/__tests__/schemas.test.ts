import sample from '../../../content/samples/mission.vanishing-tower.json';
import { Clue, ContentEnvelope, Mission } from '../schemas';

describe('content contract', () => {
  it('sample mission envelope is tagged with grade band and standards', () => {
    const env = ContentEnvelope.parse(sample.mission);
    expect(env.grade_bands.length).toBeGreaterThan(0);
    expect(env.standard_ids.length).toBeGreaterThan(0);
  });

  it('sample mission has 3-5 stops and a valid trail', () => {
    const mission = Mission.parse(sample.mission.data);
    expect(mission.stops.length).toBeGreaterThanOrEqual(3);
    expect(mission.stops.length).toBeLessThanOrEqual(5);
  });

  it('every referenced clue exists and is bilingual', () => {
    const clues = new Map(sample.clues.map((c) => [c.id, Clue.parse(c)]));
    for (const stop of Mission.parse(sample.mission.data).stops) {
      for (const id of stop.clueIds) expect(clues.get(id)).toBeDefined();
    }
  });

  it('rejects a trail whose choices skip the next stop', () => {
    const broken = structuredClone(sample.mission.data);
    broken.stops[0]!.choices = ['MX', 'IN'];
    expect(Mission.safeParse(broken).success).toBe(false);
  });
});

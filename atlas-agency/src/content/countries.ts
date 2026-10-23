// Country content on the device. A full snapshot ships inside the app so the
// map works offline from first launch; newer published versions synced from
// Supabase (or installed with a region pack) override the bundled copy.
import bundled from '../../content/countries/dist/countries.json';
import { Country } from './schemas';

export type Locale = 'en' | 'es';

export interface VersionedCountry {
  version: number;
  data: Country;
}

export class CountryRepository {
  private readonly items = new Map<string, VersionedCountry>();

  constructor(snapshot: readonly Country[] = bundled as Country[], snapshotVersion = 1) {
    for (const c of snapshot) this.items.set(c.iso2, { version: snapshotVersion, data: c });
  }

  /** Apply newer versions (e.g. from the content cache). Older or invalid ones are ignored. */
  apply(updates: readonly VersionedCountry[]): number {
    let applied = 0;
    for (const u of updates) {
      const parsed = Country.safeParse(u.data);
      if (!parsed.success) continue;
      const current = this.items.get(parsed.data.iso2);
      if (current && current.version >= u.version) continue;
      this.items.set(parsed.data.iso2, { version: u.version, data: parsed.data });
      applied++;
    }
    return applied;
  }

  get(iso2: string): Country | undefined {
    return this.items.get(iso2)?.data;
  }

  version(iso2: string): number | undefined {
    return this.items.get(iso2)?.version;
  }

  all(): Country[] {
    return [...this.items.values()].map((v) => v.data);
  }
}

/** Accent- and case-insensitive key for search and sorting. */
export const searchKey = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export const pick = <T extends { en: string; es: string }>(text: T, locale: Locale) => text[locale];

let shared: CountryRepository | undefined;
/** App-wide repository: bundled snapshot plus any newer versions applied by sync or region packs. */
export const countryRepository = () => (shared ??= new CountryRepository());

"""Reduce Natural Earth 10m GeoJSON (public domain) to the fields the content build needs.

Usage: python3 -I scripts/extract-natural-earth.py <dir-with-geojson> content/natural-earth/ne-extract.json
Inputs: ne_10m_admin_0_countries.geojson, ne_10m_populated_places_simple.geojson
"""
import json
import sys

RANK = {'Sovereign country': 0, 'Country': 1, 'Sovereignty': 2, 'Disputed': 3, 'Indeterminate': 4, 'Dependency': 5}

src, dest = sys.argv[1], sys.argv[2]
countries = {}
for f in json.load(open(f'{src}/ne_10m_admin_0_countries.geojson'))['features']:
    p = f['properties']
    a2 = p.get('ISO_A2_EH') or p.get('ISO_A2')
    if not a2 or a2 == '-99':
        continue
    row = dict(iso3=p.get('ISO_A3_EH'), name=p['NAME'], region=p['REGION_UN'], subregion=p['SUBREGION'],
               label=[round(p['LABEL_X'], 3), round(p['LABEL_Y'], 3)], type=p['TYPE'])
    prev = countries.get(a2)
    if prev is None or RANK.get(row['type'], 9) < RANK.get(prev['type'], 9):
        countries[a2] = row

capitals = {}
for f in json.load(open(f'{src}/ne_10m_populated_places_simple.geojson'))['features']:
    p = f['properties']
    if p['featurecla'].startswith('Admin-0 capital'):
        capitals.setdefault(p['iso_a2'], []).append(
            dict(name=p['name'], cls=p['featurecla'], coord=[round(p['longitude'], 3), round(p['latitude'], 3)]))

json.dump(dict(source='Natural Earth 10m (public domain)', countries=countries, capitals=capitals),
          open(dest, 'w'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
print(len(countries), 'countries,', len(capitals), 'with capitals')

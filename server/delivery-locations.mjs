import { readFileSync } from 'node:fs';
// Source: nuhil/bangladesh-geocode (MIT). Names are administrative areas,
// not Pathao delivery IDs. Pathao IDs must come from its own authenticated API.
const read = name => JSON.parse(readFileSync(new URL('./locations/' + name + '.json', import.meta.url), 'utf8')).find(x => x.type === 'table').data;
const districts = read('districts'), upazilas = read('upazilas');
export function administrativeLocations(districtId) {
  const rows = districtId ? upazilas.filter(x => x.district_id === districtId) : districts;
  return rows.map(x => ({ id: x.id, name: x.name })).sort((a,b) => a.name.localeCompare(b.name));
}


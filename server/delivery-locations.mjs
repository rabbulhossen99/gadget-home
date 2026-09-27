import { readFileSync } from 'node:fs';
// Source: nuhil/bangladesh-geocode (MIT). Names are administrative areas,
// not Pathao delivery IDs. Pathao IDs must come from its own authenticated API.
const read = name => JSON.parse(readFileSync(new URL('./locations/' + name + '.json', import.meta.url), 'utf8')).find(x => x.type === 'table').data;
const districts = read('districts'), upazilas = read('upazilas');
const cityThanas = ['Mirpur','Mohammadpur','Dhanmondi','Gulshan','Banani','Uttara','Motijheel','Tejgaon','Pallabi','Kafrul','Badda','Rampura','Khilgaon','Jatrabari','Lalbagh','Wari','Kotwali','Shahbagh','Ramna'];
const dhakaSuburban = ['Savar','Dhamrai','Dohar','Keraniganj','Nawabganj'];
export function administrativeLocations(districtId, locationType = '') {
  if (!districtId) return districts.map(x => ({ id: x.id, name: x.name, locationType: 'district' })).sort((a,b) => a.name.localeCompare(b.name));
  const district = districts.find(x => x.id === districtId);
  if (district?.name === 'Dhaka' && locationType === 'city') return cityThanas.map((name, i) => ({ id: `city-${i + 1}`, name, locationType: 'city' }));
  if (district?.name === 'Dhaka' && locationType === 'suburban') return dhakaSuburban.map(name => { const x = upazilas.find(u => u.district_id === districtId && u.name === name); return { id: x?.id || `suburban-${name}`, name, locationType: 'suburban' }; });
  const rows = upazilas.filter(x => x.district_id === districtId);
  return rows.map(x => ({ id: x.id, name: x.name })).sort((a,b) => a.name.localeCompare(b.name));
}


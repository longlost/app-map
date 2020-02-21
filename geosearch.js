
/**
	*
	*		`geosearch`
	*
	*
	*			Address lookup. 
	* 		Returns a list of suggestions along 
	* 		with corresponding geolocations in lat/lng.
	*
	*
	* 		MUST use a paid provider or self hosted instance
	* 		for any moderate to heavy traffic. 
	*
	* 		Free version is heavily limited!
	* 		No more than 1 hit per second and repeat
	* 		identical queries will get banned.
	*
	*
	**/


const getParamString = params => 
	Object.
  	entries(params).
  	map(([key, val]) =>
    	`${encodeURIComponent(key)}=${encodeURIComponent(val)}`).
  	join('&');


const endpoint = (query, params = {}) => {

  const paramString = getParamString({
    ...params,
    format: 'json',
    q: 			 query,
  });

  return `https://nominatim.openstreetmap.org/search?${paramString}`;
};


const translateOsmType = type => {
  if (type === 'node') 		 { return 'N'; }
  if (type === 'way') 		 { return 'W'; }
  if (type === 'relation') { return 'R'; }
  return ''; // Unknown.
};


const endpointReverse = (lat, lng, params = {}) => {

  const paramString = getParamString({
    ...params,
    format: 'json',
    lat,
    lon: lng
  });

  return `https://nominatim.openstreetmap.org/reverse?${paramString}`;
};


const endpointReverseRaw = (raw, params = {}) => {

  const paramString = getParamString({
    ...params,
    format: 'json',
    // eslint-disable-next-line camelcase
    osm_id: raw.osm_id,
    // eslint-disable-next-line camelcase
    osm_type: translateOsmType(raw.osm_type),
  });

  return `https://nominatim.openstreetmap.org/reverse?${paramString}`;
};


const parse = r => ({
	lng: 	 parseFloat(r.lon),
  lat: 	 parseFloat(r.lat),
  label: r.display_name,
  bounds: {
    s: parseFloat(r.boundingbox[0]),
    n: parseFloat(r.boundingbox[1]), 
    w: parseFloat(r.boundingbox[2]),
    e: parseFloat(r.boundingbox[3])
  },
  raw: r
});


// Search by name and address.
// 'query' is a search input string.
// 'params' is an object containing
// OpenStreetMap api url search params.
// String, Object (optional) --> Array (Collection)
const search = async (query, params) => {

  const url = endpoint(query, params);

  const response = await fetch(url);
  const results  = await response.json();

  return results.map(parse);
};


// 'params' is an object containing
// OpenStreetMap api url search params.
// String, Object (optional) --> Object
const reverse = async (lat, lng, params) => {

  const url = endpointReverse(lat, lng, params);

  const response = await fetch(url);
  const result 	 = await response.json();

  return parse(result);
};


// 'params' is an object containing
// OpenStreetMap api url search params.
// String, Object (optional) --> Object
const reverseRaw = async (data, params) => {

  const url = endpointReverseRaw(data.raw, params);

  const response = await fetch(url);
  const result 	 = await response.json();

  return parse(result);
};


export {reverse, reverseRaw, search};

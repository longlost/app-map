
/**
  * `map-overlay`
  * 
  *
  * @customElement
  * @polymer
  * @demo demo/index.html
  *
  *
  **/

import {
  AppElement, 
  html
} from '@longlost/app-element/app-element.js';

import {
  enableScrolling,
  getComputedStyle,
  wait,
  warn
} from '@longlost/utils/utils.js';

import {
  search, 
  reverse
} from './geosearch.js';

import services   from '@longlost/services/services.js';
import htmlString from './map-overlay.html';
import '@longlost/app-icons/app-icons.js';
import '@longlost/app-inputs/search-input.js';
import '@longlost/app-overlays/app-header-overlay.js';
import '@longlost/app-spinner/app-spinner.js';
import '@polymer/paper-fab/paper-fab.js';
import '@polymer/paper-icon-button/paper-icon-button.js';
import './map-icons.js';
import './app-map.js';

// Normalize text search prop to be space and case insensitive.
// Remove all '\', '/', spaces and commas, 
// take the first 30 characters,
// then lowercase the remaining string.
const normalize = str => 
  str.replace(/\\*\/*\s*\,*/g, '').slice(0, 40).toLowerCase();


const hexToRGBA = (hex, alpha = 1) => {

  const toHexidecimal = (a, b) => `0x${a}${b}`;

  const toCss = (r, g, b) => 
    `rgba(${Number(r)}, ${Number(g)}, ${Number(b)}, ${Number(alpha)})`;

  // 3 digits
  if (hex.length === 4) {
    const r = toHexidecimal(hex[1], hex[1]);
    const g = toHexidecimal(hex[2], hex[2]);
    const b = toHexidecimal(hex[3], hex[3]);

    return toCss(r, g, b);
  } 
  // 6 digits
  else if (hex.length === 7) {
    const r = toHexidecimal(hex[1], hex[2]);
    const g = toHexidecimal(hex[3], hex[4]);
    const b = toHexidecimal(hex[5], hex[6]);

    return toCss(r, g, b);
  }
};


const cacheResult = result => {
  const normalized = normalize(result.label);

  return services.set({
    coll: 'geolocations',
    doc:   normalized,
    data:  {...result, queryKey: normalized}
  });
};


// Cache all successful searches for future use.
const geoSearch = async query => {

  const results = await search(query);

  if (results.length > 0) {

    const saves = results.map(cacheResult);   

    await Promise.all(saves);
  }

  return results;
};


// Cache all successful searches for future use.
const reverseGeoSearch = async (lat, lng) => {

  const result = await reverse(lat, lng);

  if (result) {
    await cacheResult(result);
  }

  return result;
};


class MapOverlay extends AppElement {
  static get is() { return 'map-overlay'; }

  static get template() {
    return html([htmlString]);
  }


  static get properties() {
    return {

      // Altitude in meters. Optional.
      alt: Number,

      darkMode: Boolean,

      /*
        If there is only the single, automatic
        marker present (ie. no 'locations') then
        make that marker draggable.

        Consider setting the marker css size vars to 40px
        or higher for proper a11y touch surfaces.

        If using 'locations', then set 'draggable' prop
        in the 'options' of each location.

        Use the 'markers-changed' event to get 
        the generated marker and access its api.        
        For example, each marker fires a 'move' event
        any time its position changes programmically or
        due to human interaction.
      */
      draggable: Boolean,

      // Float Or Object - {degrees, minutes, seconds, direction}
      lat: Number, 

      // Float Or Object - {degrees, minutes, seconds, direction}
      lng: Number, 

      // Collection of {lat, lng, options (L.marker options), text} objects.
      // Each item in the array creates a marker on the map.
      locations: Array,

      // Show the scale bar on the lower left corner.
      scale: Boolean,

      // Animate changes to map position when true.
      smooth: Boolean,

      zoom: {
        type: Number,
        value: 12
      },

      // First Leaflet marker element from array 
      // of markers. Only one marker in the 
      // array unless 'locations' is set.
      _marker: Object,

      // User selected from search suggestions,
      // or single reverse-geosearch result.
      _result: Object,

      _results: Array,

      // Search state that helps avoid being banned
      // from the nominatim api by preventing hitting
      // the database while a previous request is in flight.
      _searching: Boolean,

      // Tri-state value that allows Firebase entries to
      // be favored over hitting the geosearch api
      // whenever possible to avoid being banned.
      _searchState: {
        type: String,
        value: 'done' // Or 'cached' or 'searching'.
      },

      // Search input value.
      _searchVal: String,

      _suggestions: {
        type: Array,
        computed: '__computeSuggestions(_results)'
      }

    };
  }


  static get observers() {
    return [
      '__resultChanged(_result)'
    ];
  }


  connectedCallback() {
    super.connectedCallback();

    const hex = getComputedStyle(this, '--header-background-color');

    this.updateStyles({
      '--gradient-start': hexToRGBA(hex, 0.1),
      '--gradient-end':   hexToRGBA(hex, 0.5)
    });
  }


  __computeSuggestions(results) {
    if (!Array.isArray(results)) { return; }

    return results.map(result => result.label);
  }


  async __resultChanged(result) {
    if (!result) { return; }

    const {lat, lng, label} = result;

    this.lat = lat;
    this.lng = lng;
    this._searchVal = label;

    // WARNING:
    //    Popup 'x' button will not work when devtools is open!!
    if (this._marker) {
      this._marker.bindPopup(`<p>${label}</p>`).openPopup();
      this._marker.setLatLng({lat, lng});
    }

    this.fire('selected-changed', {selected: result});
  }


  async __search({query, type, spinner}) {
    try {

      // Wait for geocaching results to come back
      // if a search is in flight.
      if (this._searching) { return; }

      if (spinner) {
        await this.$.spinner.show('Searching.');
      }
      else {
        await this.debounce('map-overlay-autocomplete-debounce', 200);
      }

      if (type === 'reverse') {

        const {lat, lng} = query;

        const cached = await services.query({
          coll:      'geolocations',
          limit:      1,
          query: [{
            field:     'lat', 
            operator:  '==',
            comparator: lat
          }, {
            field:     'lng', 
            operator:  '==',
            comparator: lng
          }]
        });

        if (cached.length > 0) {
          this._result = cached[0];
        }
        else {

          // Give a more generous debounce for nominatim api hits.
          await this.debounce('map-overlay-reverse-search-debounce', 500);

          this._searching = true;

          const result = await reverseGeoSearch(lat, lng);

          this._searching = false;

          if (result) {
            this._result = result;
          }
        }
      }
      else {   

        const cached = await services.textStartsWithSearch({
          coll:      'geolocations', 
          direction: 'asc', 
          limit:      10, 
          prop:      'queryKey', 
          text:       normalize(query)
        });

        if (cached.length === 0) {

          // Give a more generous debounce for nominatim api hits.
          await this.debounce('map-overlay-search-debounce', 500);

          this._searching = true;

          const results = await geoSearch(query);

          this._searching = false;

          if (results) {
            this._results = results;
          }
        }
        else {
          this._results = cached;
        }
      }

    }
    catch (error) {
      if (error === 'debounced') { return; }

      console.error(error);

      await warn(`Uh Oh! That search didn't work.`);

      this._searching = false;
    }
    finally {
      await this.$.spinner.hide();
    }
  }


  __suggestionSelected(event) {
    if (!Array.isArray(this._results) || this._results.length === 0) {
      return;
    }

    this._result = this._results[event.detail.index];
  }


  __overlayReset() {
    enableScrolling(true);
  }


  __markerMoveendHandler(marker, event) {

    // Set currently "focused" marker.
    this._marker = marker;

    // Use lat, lng to lookup address.
    this.__search({
      query:   event.target._latlng, 
      type:   'reverse', 
      spinner: true
    });
  }


  __markersChanged(event) {
    const markers = event.detail.value;

    // Cleanup old listeners on preexisting markers first.
    // Add new listeners to all markers, both new and old.
    markers.forEach(marker => {
      marker.removeEventListener('moveend', this.__markerMoveendHandler.bind(this, marker));
      marker.addEventListener(   'moveend', this.__markerMoveendHandler.bind(this, marker));
    });
  }


  __zoomChanged(event) {
    this.zoom = event.detail.value;
  }


  async __locationBtnClicked() {
    try {
      await this.clicked();

      await this.$.spinner.show('Locating your position.');
      
      // Don't allow cached positions or fast 
      // devices hide the spinner too fast.
      const [gps] = await Promise.all([
        this.$.map.getDeviceLocation(), 
        wait(800)
      ]);

      // Use lat, lng to lookup address.
      this.__search({
        query:   gps.latlng, 
        type:   'reverse', 
        spinner: true
      });
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);

      await warn('Could not locate your position.');

      this.$.spinner.hide();
    }
  }


  __searchHandler(event) {
    this.__search({
      query:   event.detail.value.trim(), 
      type:   'search', 
      spinner: true
    });
  }


  __searchValChanged(event) {
    const {value} = event.detail;

    if (this._result && this._result.label === value) { return; }

    const trimmed = value.trim();

    if (trimmed.length < 2) { return; }

    this.__search({
      query:   trimmed, 
      type:   'search', 
      spinner: false
    });
  }


  async __pinDropBtnClicked() {
    try {
      await this.clicked();

      this.$.map.addMarker();
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }


  async __zoomInFabClicked() {
    try {
      await this.clicked();

      this.zoom = this.zoom === 18 ? this.zoom : this.zoom + 1;
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }


  async __zoomOutFabClicked() {
    try {
      await this.clicked();

      this.zoom = this.zoom === 0 ? this.zoom : this.zoom - 1;
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }


  async open() {

    // Safari fix.
    enableScrolling(false);

    await this.$.overlay.open();

    // Ensure map measures itself after 
    // content is display block.
    this.$.map.resize();
  }

}

window.customElements.define(MapOverlay.is, MapOverlay);

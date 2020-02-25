
/**
  * `app-map`
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
}             from '@longlost/app-element/app-element.js';
import {
  htmlLiteral
}             from '@polymer/polymer/lib/utils/html-tag.js';
import {
  listen,
  unlisten
}             from '@longlost/utils/utils.js';
// Disable webpack config 'style-loader' so 
// these styles are not put in the document head.
import styles from '!css-loader!leaflet/dist/leaflet.css';
import L      from 'leaflet';
import 'leaflet.tilelayer.colorfilter';
import '@polymer/iron-icon/iron-icon.js';
import './map-icons.js';


const ATTRIBUTION       = '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>';
const TILE_PROVIDER_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'; // OpenStreetMap tiles.


const dmsToDecimal = ({degrees, minutes, seconds, direction}) => {   
  const decimal = Number(degrees) + Number(minutes) / 60 + Number(seconds) / (60 * 60);
  const dir     = direction.toUpperCase();

  if (dir == 'S' || dir == 'W') {
    return decimal * -1;
  } 

  // Don't do anything for N or E
  return decimal;
};


class AppMap extends AppElement {
  static get is() { return 'app-map'; }

  static get template() {

    return html`
      <style>
      
        :host {
          display:  block;
          position: relative;
          overflow: hidden;
          height:   100%;
          --added-marker-color: var(--app-accent-color);
          --marker-color:       var(--app-dark-color);
          --marker-size:        32px;
        }

        .marker-icon {
          position: absolute;
          top:     -200%;
          z-index: -1;
          height:   var(--marker-size);
          width:    var(--marker-size);
        }

        .div-icon .marker-icon {
          position: static;
          top:      0px;
          z-index:  0;
          color:    var(--marker-color);
        }

        .added-marker-icon .marker-icon {
          color:   var(--added-marker-color);
          z-index: 1;
        }

        #map {
          height: 100%;
          width:  100%;
          background-color: inherit;
        }

        ${this.stylePartial}

      </style>


      <iron-icon id="markerIcon" 
                 class="marker-icon" 
                 icon="map-icons:place">
      </iron-icon>

      <div id="map"></div>
    `;
  }


  static get stylePartial() {
    return htmlLiteral([styles.toString()]);
  }


  static get properties() {
    return {

      // Altitude in meters. Optional.
      alt: Number,

      darkMode: {
        type: Boolean,
        value: false
      },

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
        Use 'moveend' for human interaction only.
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

      // L.divIcon iconAnchor array.
      // Adjusts where the icon is placed.
      _iconAnchor: Array,

      // markerIcon ref.
      _iconEl: Object,

      _lat: {
        type: Number,
        value: 0,
        computed: '__computePosDecimal(lat)'
      },

      _locations: Array,

      _lng: {
        type: Number,
        value: 0,
        computed: '__computePosDecimal(lng)'
      },

      _map: Object,

      _markers: {
        type: Array,
        computed: '__computeMarkers(_locations.*, draggable, _map, _iconEl, _iconAnchor)',
        observer: '__markersChanged'
      },

      _tileLayer: Object,

      _zoomListenerKey: Object

    };
  }


  static get observers() {
    return [
      '__altLatLngChanged(alt, _lat, _lng, _map)',
      '__darkModeChanged(darkMode, _tileLayer)',
      '__locationsChanged(locations)',
      '__mapChanged(_map)',
      '__scaleChanged(scale, _map)',
      '__zoomChanged(zoom, _map)'
    ];
  }


  connectedCallback() {
    super.connectedCallback(); 

    this.__leaflet();
  }


  disconnectedCallback() {
    super.disconnectedCallback();

    if (this._zoomListenerKey) {
      unlisten(this._zoomListenerKey);
    }
  }


  __computePosDecimal(input) {

    if (input === undefined || input === null) { return 0; }

    if (typeof input === 'number') {
      return input;
    }

    if (typeof input === 'object' && 'degrees' in input) {
      return dmsToDecimal(input);
    }

    throw new TypeError(`
      lat and lng must be a decimal number 
      or an object with these properties:

        {
          degrees,
          minutes,
          seconds,
          direction
        }

        Where direction is one of 'N', 'S', 'E' or 'W', and is case insensitive.
        The other values must be int or float.
    `);
  }


  __computeMarkers(polymerObj, draggable, map, iconEl, iconAnchor) {
    if (!polymerObj || !map || !iconEl || !iconAnchor) { return; }

    const {base: locations} = polymerObj;

    if (!Array.isArray(locations)) { return; }

    const getPos = location => {

      const {lat, lng} = location;

      if (typeof lat === 'number' && typeof lng === 'number') {
        return location;
      }

      return {
        lat: dmsToDecimal(lat),
        lng: dmsToDecimal(lng)
      };
    };

    return locations.map(loc => 
             L.marker(getPos(loc), {
                 icon: L.divIcon({
                   className: loc.className ? `div-icon ${loc.className}` : 'div-icon',
                   html:      iconEl.cloneNode(true),
                   iconAnchor // Place tip of pin at marker lat/lng center.
                 }), 
                 draggable, 
                 ...loc.options
               }). // See L.marker options.
               bindPopup(loc.text).
               openPopup().
               addTo(map));
  }

  
  __locationsChanged(locations) {
    this.set('_locations', locations);
  }


  __markersChanged(newMarkers, oldMarkers) {

    // Clean up.
    if (Array.isArray(oldMarkers)) {
      oldMarkers.forEach(marker => {
        marker.remove();
      });
    }

    /*
      Make markers available to consumer.

      Each marker has an api for listening to events,
      setting state/properties, reading state/properties.

      For instance, listen to a markers 'move' event to
      receive latlng updates when a marker's position
      is changed programmically or due to user interaction.

      See L.markers in Leaflet documentation for more info.
    */
    if (Array.isArray(newMarkers)) {
      this.fire('markers-changed', {value: newMarkers});
    }
  }


  __altLatLngChanged(alt, lat, lng, map) {
    if (
      typeof lat !== 'number' || 
      typeof lng !== 'number' ||
      !map
    ) { return; }

    map.setView({alt, lat, lng}, this.zoom, {animate: this.smooth});

    if (!this.locations) {
      this.set('_locations', [{lat, lng}]);
    }
  }


  __darkModeChanged(dark, tileLayer) {
    if (!tileLayer) { return; }

    if (dark) {
      tileLayer.updateFilter([
        'hue:180deg',
        'invert:100%'
      ]);
    }
    else {
      tileLayer.updateFilter([]);
    }
  }


  __mapChanged(map) {
    if (!map) { return; }

    this._zoomListenerKey = listen(map, 'zoomend', this.__zoomendHandler.bind(this));
  }

  // Show the scale bar on the lower left corner.
  __scaleChanged(bool, map) {

    if (bool && map) {      
      L.control.scale().addTo(map);
    }
  }


  __zoomChanged(zoom, map) {
    if (typeof zoom !== 'number' || !map) { return; }

    map.setZoom(zoom, {animate: this.smooth});
  }


  __zoomendHandler(event) {
    this.fire('zoom-changed', {value: this._map.getZoom()});
  }

  // Dynamically center the bottom middle of 
  // the icon to the actual marker location.
  __setIconAnchor() {

    const {height, width} = this._iconEl.getBoundingClientRect();

    this._iconAnchor = [width / 2, height];
  }

  // Initialize Leaflet.
  __leaflet() {
    
    this._map = L.map(this.$.map, {zoomControl: false});

    // Add the OpenStreetMap tiles.
    this._tileLayer = L.tileLayer.colorFilter(TILE_PROVIDER_URL, {
      attribution: ATTRIBUTION,
      filter:      [],
      maxZoom:     19
    }).addTo(this._map);
    
    // This ref is cloned for each marker.
    this._iconEl = this.$.markerIcon;

    this.__setIconAnchor();
  }


  addMarker(options = {}) {

    if (!this._map || !this._iconAnchor) {
      throw new Error('Map not ready.');
    }

    this.push('_locations', {
      ...this._map.getCenter(), 
      className: 'added-marker-icon',  
      ...options
    });
  }

  // void -> Promise -> (gps <Object>, error <Object>).
  getDeviceLocation() {

    if (!this._map) {
      throw new Error('Map not ready yet.');
    }

    this._map.locate({enableHighAccuracy: true});

    let foundKey; 
    let errorKey; 

    return new Promise((resolve, reject) => {

      const handler = event => {

        // Only listen once, so cleanup listeners.
        unlisten(foundKey);
        unlisten(errorKey);

        if (event.code && event.message) {
          reject(event);
        }

        // Pull out unnecessary properties to clean up the api.
        const {sourceTarget, target, ...rest} = event;
        const {lat, lng}                      = rest.latlng;

        this.lat = lat;
        this.lng = lng;

        resolve(rest);
      };

      foundKey = listen(this._map, 'locationfound', handler);
      errorKey = listen(this._map, 'locationerror', handler);     
    });   
  }


  resize() {
    if (this._map) {
      this.__setIconAnchor();
      this._map.invalidateSize();
    }
  }

}

window.customElements.define(AppMap.is, AppMap);

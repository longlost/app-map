
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
          display: block;
          height:  100%;
          --marker-color: var(--app-dark-color);
          --marker-size:  32px;
        }

        #map {
          height: 100%;
          width:  100%;
          background-color: inherit;
        }

        .marker-icon {
          height: var(--marker-size);
          width:  var(--marker-size);
          color:  var(--marker-color);
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

      _icon: Object,

      _lat: {
        type: Number,
        value: 0,
        computed: '__computePosDecimal(lat)'
      },

      _lng: {
        type: Number,
        value: 0,
        computed: '__computePosDecimal(lng)'
      },

      _map: Object,

      _markers: {
        type: Array,
        computed: '__computeMarkers(locations, draggable, _map, _icon)',
        observer: '__markersChanged'
      },

      _tileLayer: Object

    };
  }


  static get observers() {
    return [
      '__altLatLngChanged(alt, _lat, _lng, locations, zoom, _map, _markers)',
      '__darkModeChanged(darkMode, _tileLayer)',
      '__scaleChanged(scale, _map)'
    ];
  }


  connectedCallback() {
    super.connectedCallback(); 

    this.__leaflet();
  }


  __computePosDecimal(input) {
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


  __computeMarkers(locations, draggable, map, icon) {
    if (!map || !icon) { return; }

    if (Array.isArray(locations)) {

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
               L.marker(getPos(loc), {icon, ...loc.options}). // See L.marker options.
                 bindPopup(loc.text).
                 openPopup().
                 addTo(map));
    }
      
    return [L.marker({lat: 0, lng: 0}, {draggable, icon}).addTo(map)];
  }


  __markersChanged(newMarkers, oldMarkers) {
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


  __altLatLngChanged(alt, lat, lng, locations, zoom, map, markers) {
    if (
      typeof lat !== 'number' || 
      typeof lng !== 'number' ||
      !map
    ) { return; }

    if (!Array.isArray(locations) && Array.isArray(markers)) {
      markers.forEach(marker => {
        marker.setLatLng({lat, lng});
      });
    }

    map.setView({alt, lat, lng}, zoom, {animate: this.smooth});
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

  // Show the scale bar on the lower left corner.
  __scaleChanged(bool, map) {

    if (bool && map) {      
      L.control.scale().addTo(map);
    }
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
    
    // Dynamically center the bottom middle of 
    // the icon to the actual marker location.
    const {height, width} = this.$.markerIcon.getBoundingClientRect();

    this._icon = L.divIcon({
      className:  '', // Any setting here overwrites the default container div styles.
      html:       this.$.markerIcon,
      iconAnchor: [width / 2, height] // Place tip of pin at marker lat/lng center.
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

}

window.customElements.define(AppMap.is, AppMap);

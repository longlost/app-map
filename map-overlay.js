
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
}                 from '@longlost/app-element/app-element.js';
import {
	enableScrolling,
	listen,
	unlisten,
	wait,
	warn
} 								from '@longlost/utils/utils.js';
import htmlString from './map-overlay.html';
import '@longlost/app-header-overlay/app-header-overlay.js';
import '@longlost/app-icons/app-icons.js';
import '@longlost/app-spinner/app-spinner.js';
import '@polymer/paper-icon-button/paper-icon-button.js';
import './map-icons.js';


class MapOverlay extends AppElement {
  static get is() { return 'map-overlay'; }

  static get template() {
    return html([htmlString]);
  }


  static get properties() {
    return {

      // Altitude in meters. Optional.
      alt: Number,

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
      }

    };
  }


  __overlayReset() {
  	enableScrolling(true);
  }


  __markersChanged(event) {
    const [marker] = event.detail.value;

    listen(marker, 'move', event => {
      console.log('marker moved: ', event);
    });

  }


  async __searchBtnClicked() {
    try {
      await this.clicked();
      
      // this.$.search.open();

    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
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

      console.log(gps);

    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
      await warn('Could not locate your position.');
    }
    finally {
    	this.$.spinner.hide();
    }
  }


  async open() {

  	// Safari fix.
  	enableScrolling(false);

  	await this.$.overlay.open();

  	// Ensure map measures itself after 
  	// content is display block.
  	return import('./app-map.js');
  }

}

window.customElements.define(MapOverlay.is, MapOverlay);

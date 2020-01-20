
/**
	*
	*		To use these across web components, 
	*		import this file in js and use 
	* 	<iron-icon icon="leaflet-map-icons:place"></iron-icon>.
	*
	*		
	*
 	*/

import '@polymer/iron-iconset-svg/iron-iconset-svg.js';
import htmlString from './map-icons.html';

const mapIcons 		 = document.createElement('div');
mapIcons.innerHTML = htmlString;
mapIcons.setAttribute('style', 'display: none;');
document.head.appendChild(mapIcons);

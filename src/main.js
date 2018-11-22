// TODO: https://blog.mapbox.com/global-elevation-data-6689f1d0ba65
// TODO: https://www.mapbox.com/mapbox-gl-js/example/style-ocean-depth-data/
//https://blog.mapbox.com/how-to-extrude-vector-terrain-with-hypsometric-tints-e0fdee097c6

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { LocalizationControl,
         RulerControl,
         ZoomControl,
         CompassControl } from 'mapbox-gl-controls';

import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

import Gun from 'gun/gun';
import 'gun/lib/then';


function serializeFeature(feature) {
    const geometry = feature.geometry;
    const geometryData = {type: geometry.type};
    const coordinates = geometry.coordinates;
    switch(geometry.type) {
        case 'Point':
            geometryData.coordinates = {x: coordinates[0],
                                        y: coordinates[1]};
            break;

        case 'LineString':
            const coordinatesData = {};
            coordinates.forEach((vertex, index) => {
                coordinatesData[index.toString()] = {x: vertex[0],
                                                     y: vertex[1]};
            });
            geometryData.coordinates = coordinatesData;
            break;

        default:
            throw new Error('Unknown feature.');
    }
    return { id: feature.id,
             properties: feature.properties,
             geometry: geometryData };
}

async function deserializeFeature(data, dataCtx) {
    const geometryCtx = dataCtx.get('geometry');
    const geometryData = await geometryCtx.then();

    const coordinatesCtx = geometryCtx.get('coordinates');
    const coordinatesData = await coordinatesCtx.then();

    const geometry = {type: geometryData.type};
    switch(geometryData.type) {
        case 'Point':
            geometry.coordinates = [coordinatesData.x,
                                    coordinatesData.y];
            break;

        case 'LineString':
            const coordinates = [];
            for(let index = 0;; index++) {
                const key = index.toString();
                if(!(key in coordinatesData))
                    break;
                const vertex = await coordinatesCtx.get(key).then();
                coordinates.push([vertex.x, vertex.y]);
            }
            geometry.coordinates = coordinates;
            break;

        default:
            throw new Error('Unknown feature.');
    }
    return { type: 'Feature',
             id: data.id,
             properties: data.properties || {},
             geometry: geometry };
}

function setupDrawingTools(map, gun) {
    const draw = new MapboxDraw();
    map.addControl(draw, 'bottom-right');

    const featureSetCtx = gun.get('map-features');

    featureSetCtx.map().on(function(featureData, featureId) {
        console.log('map feature changed', featureId);

        if(draw.get(featureId) !== undefined)
            draw.delete([featureId]);

        if(featureData !== null) {
            const featureCtx = featureSetCtx.get(featureId);
            deserializeFeature(featureData, featureCtx).then(feature => {
                draw.add(feature);
            });
        }
    });

    map.on('draw.create', function(e) {
        console.log('draw.create', e.features);
        e.features.forEach(feature => {
            const featureData = serializeFeature(feature);
            console.log('serialized feature:', feature, featureData);
            featureSetCtx.get(feature.id).put(featureData);
        });
    });

    map.on('draw.delete', function(e) {
        console.log('draw.delete', e.features);
        e.features.forEach(feature => {
            featureSetCtx.get(feature.id).put(null);
        });
    });

    map.on('draw.combine', function(e) {
        console.log('draw.combine', e.deletedFeatures, e.createdFeatures);
    });

    map.on('draw.uncombine', function(e) {
        console.log('draw.uncombine', e.deletedFeatures, e.createdFeatures);
    });

    map.on('draw.update', function(e) {
        console.log('draw.update', e.action, e.features);
        e.features.forEach(feature => {
            const featureData = serializeFeature(feature);
            featureSetCtx.get(feature.id).put(featureData);
        });
    });

    //map.on('draw.selectionchange', function(e) {});
}

function setupGeocoder(map) {
    const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken
    });
    map.addControl(geocoder, 'top-left');


    const updateGeocoderProximity = function() {
        // proximity is designed for local scale, if the user is looking at the whole world,
        // it doesn't make sense to factor in the arbitrary centre of the map
        if (map.getZoom() > 9) {
            var center = map.getCenter().wrap(); // ensures the longitude falls within -180 to 180 as the Geocoding API doesn't accept values outside this range
            geocoder.setProximity({ longitude: center.lng, latitude: center.lat });
        } else {
            geocoder.setProximity(null);
        }
    }

    // Bias results nearby the map's current view:
    map.on('load', updateGeocoderProximity); // set proximity on map load
    map.on('moveend', updateGeocoderProximity); // and then update proximity each time the map moves
}

function findFirstSymbolLayer(map) {
    var layers = map.getStyle().layers;
    // Find the index of the first symbol layer in the map style
    var firstSymbolId;
    for (var i = 0; i < layers.length; i++) {
        if (layers[i].type === 'symbol') {
            firstSymbolId = layers[i].id;
            break;
        }
    }
}

function setup3dBuildings(map) {
    // The 'building' layer in the mapbox-streets vector source contains building-height
    // data from OpenStreetMap.
    map.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
            'fill-extrusion-color': '#aaa',

            // use an 'interpolate' expression to add a smooth transition effect to the
            // buildings as the user zooms in
            'fill-extrusion-height': [
                "interpolate", ["linear"], ["zoom"],
                15, 0,
                15.05, ["get", "height"]
            ],
            'fill-extrusion-base': [
                "interpolate", ["linear"], ["zoom"],
                15, 0,
                15.05, ["get", "min_height"]
            ],
            'fill-extrusion-opacity': .6
        }
    }, findFirstSymbolLayer(map));
}

function setupHillshading(map) {
    //map.addSource('dem', {
    //    "type": "raster-dem",
    //    "url": "mapbox://mapbox.terrain-rgb"
    //});

    //map.addLayer({
    //    "id": "hillshading",
    //    "source": "dem",
    //    "type": "hillshade"
    //// insert below waterway-river-canal-shadow;
    //// where hillshading sits in the Mapbox Outdoors style
    //}, 'waterway-river-canal-shadow');
}

mapboxgl.accessToken = 'pk.eyJ1IjoiaGVucnk0ayIsImEiOiJjam4zZDJhNHIyZDliM2txbGZocGFjd2M4In0.mVr4w3tXvQinEUBi9gx4UQ';
const map = new mapboxgl.Map({
    container: 'map',
    minZoom: 0,
    maxZoom: 24,
    //style: 'mapbox://styles/mapbox/light-v9',
    //style: 'mapbox://styles/mapbox/satellite-v9',
    style: 'file:///home/henry/Projects/degenesis-web-map/map-style/style.json',
    hash: true, // position is synced with URL
    renderWorldCopies: false, // don't render multiple worlds when zoomed out
    //center: [-74.0066, 40.7135],
    //zoom: 15.5,
    //pitch: 45,
    //bearing: -17.6,
});

map.addControl(new LocalizationControl());
map.addControl(new mapboxgl.ScaleControl());
map.addControl(new RulerControl(), 'top-right');
map.addControl(new ZoomControl(), 'top-right');
map.addControl(new CompassControl(), 'top-right'); // visible after map rotation
setupGeocoder(map);

map.on('load', function() {
    //setup3dBuildings(map);

    const gun = Gun('http://localhost:8080/gun');
    setupDrawingTools(map, gun);
});

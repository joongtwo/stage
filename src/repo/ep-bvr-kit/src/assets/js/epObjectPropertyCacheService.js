// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epObjectPropertyCacheService
 *
 * Storing properties in a cache
 */
import eventBus from 'js/eventBus';


let propertiesCache = {};
const NOT_FOUND = -1;

/**
 * Will add new properties or update existing ones.In case the value already exists it will be replaced.
 * @param {string} key - the property entry key
 * @param {object[]} properties - the properties to be cached with the key
 */
export function setProperties( key, properties ) {
    if( !propertiesCache[ key ] ) {
        propertiesCache[ key ] = properties;
    } else {
        Object.assign( propertiesCache[ key ], properties );
    }
}
/**
 * Will add a new property or update existing one. Keeping existing values as an array, push new values to it.
 * Triggers cache update event.
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 * @param {object[]} propertyValue - the values to be cached with the key and propertyKey
 *
 */
export function updateProperty( key, propertyKey, propertyValue ) {
    if( !propertiesCache[ key ] ) {
        propertiesCache[ key ] = {};
    }

    if( propertiesCache[ key ][ propertyKey ] ) {
        const cachePropertyKeyIsArray = Array.isArray( propertiesCache[ key ][ propertyKey ] );
        const propertyValueIsArray = Array.isArray( propertyValue );
        // if property isn't store as array and need to add additional values, need to change value into array
        if( !cachePropertyKeyIsArray ) {
            propertiesCache[ key ][ propertyKey ] = [ propertiesCache[ key ][ propertyKey ] ];
        }
        if( !propertyValueIsArray ) {
            propertyValue = [ propertyValue ];
        }
        propertyValue.forEach( value => addValueToArray( key, propertyKey, value ) );
    } else {
        propertiesCache[ key ][ propertyKey ] = propertyValue;
    }

    eventBus.publish( 'epObjectPropertyCache.' + propertyKey + 'Updated' );
}

/**
 * Will add a new SINGLE property or update existing one. In case the value already exists it will be replaced. Triggers cache update event.
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 * @param {object[]} propertyValue - the values to be cached with the key and propertyKey
 *
 */
export function setProperty( key, propertyKey, propertyValue ) {
    if( !propertiesCache[ key ] ) {
        propertiesCache[ key ] = {};
    }

    propertiesCache[ key ][ propertyKey ] = propertyValue;
    eventBus.publish( 'epObjectPropertyCache.' + propertyKey + 'Updated' );
}
/**
 *  Will remove a property value. In case the value not exists it will be ignored.
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 * @param {object[]} propertyValue - the values to be cached with the key and propertyKey
 *
 */
export function removeProperty( key, propertyKey, propertyValue ) {
    if( !propertiesCache[ key ] || !propertiesCache[ key ][ propertyKey ] || !propertiesCache[ key ][ propertyKey ] ) {
        return;
    }

    const propertyValueIsArray = Array.isArray( propertyValue );
    if( propertyValueIsArray ) {
        propertyValue.forEach( value => removeValueFromArray( key, propertyKey, value ) );
    } else {
        removeValueFromArray( key, propertyKey, propertyValue );
    }
}

function removeValueFromArray( key, propertyKey, propertyValue ) {
    const index = propertiesCache[ key ][ propertyKey ].findIndex( value => value === propertyValue );
    if( index > NOT_FOUND ) {
        propertiesCache[ key ][ propertyKey ].splice( index, 1 );
    }
}

function addValueToArray( key, propertyKey, propertyValue ) {
    !propertiesCache[ key ][ propertyKey ].includes( propertyValue ) && propertiesCache[ key ][ propertyKey ].push( propertyValue );
}

/**
 *
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 *
 */
export function getProperty( key, propertyKey ) {
    if( propertiesCache[ key ] && propertiesCache[ key ][ propertyKey ] ) {
        return propertiesCache[ key ][ propertyKey ];
    }
    return '';
}

/**
 * @param {string} key - the property entry key
 */
export function clearCache( key ) {
    if( key ) {
        delete propertiesCache[ key ];
    } else {
        propertiesCache = {};
    }
}

/**
 *  Deletes entry of propertykey from cache.
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 */
export function clearPropertyKeyCache( key, propertyKey ) {
    if( key && propertyKey && propertiesCache[ key ] && propertiesCache[ key ][ propertyKey ] ) {
        delete propertiesCache[ key ][ propertyKey ];
        eventBus.publish( 'epObjectPropertyCache.' + propertyKey + 'Updated' );
    }
}

export default {
    setProperties,
    updateProperty,
    removeProperty,
    getProperty,
    clearCache,
    clearPropertyKeyCache,
    setProperty
};

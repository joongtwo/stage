// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


/**
 * The ngp relation service
 *
 * @module js/services/mfeHostingRequestsCache
 */


const cache = new Object();

/**
  *
  * @param {String} requestKey - key in wite list for caching soa response
  * @param {object} jsonData - request data input
  * @param {Object} soaResponse - the response of the request
  */
export function setResponse( requestKey, jsonData, response ) {
    const jsonBodyAsString = JSON.stringify( jsonData.body );
    const code = hashCode( jsonBodyAsString );
    if ( !cache[requestKey] ) {
        cache[requestKey] = new Object();
    }
    cache[requestKey][code]  = response;
}
/**
 *
 * @param {String} requestKey - key in wite list for caching soa response
 * @param {object} jsonData - request data input
 */
export function getResponse( requestKey, jsonData ) {
    const jsonBodyAsString = JSON.stringify( jsonData.body );
    const code = hashCode( jsonBodyAsString );
    if ( cache[requestKey] ) {
        return cache[requestKey][code];
    }
    return null;
}

/**
 *
 * @param {String} requestKey - key in wite list for caching soa response
 */
export function clearResponse( requestKey ) {
    delete cache[requestKey];
}
/**
 *
 * @param {String} serviceName - soa service name
 * @param {String} operationName - soa operation name
 */
export function createKeyForSoaCache( serviceName, operationName ) {
    return `${serviceName}/${operationName}`;
}

/**
 * calculate the hash for a given string
 * @param {String} str
 */
function hashCode( str ) {
    let hash = 0;
    for ( let i = 0; i < str.length; i++ ) {
        let character = str.charCodeAt( i );
        hash = ( hash << 5 ) - hash + character;
        hash &= hash; // Convert to 32bit integer
    }
    return hash;
}

export default {
    setResponse,
    getResponse,
    createKeyForSoaCache,
    clearResponse
};

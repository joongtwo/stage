// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for Open BOP in another Configuration
 *
 * @module js/epViewOtherConfigurationService
 */

import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';

/**
  *
  * @param {string} loadedObjUid - BOMLine uid
  * @returns{object} new configuration
  */
function viewOtherConfiguration( loadedObjUid ) {
    const objectToLoad = {};

    const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( 'CloneCC', loadedObjUid );
    return epLoadService.loadObject( loadTypeInputs, false ).then(
        function( response ) {
            if( response.loadedObjectsMap.loadedObject ) {
                objectToLoad.uid = response.loadedObjectsMap.loadedObject[ 0 ].uid;
            }
            if( response.loadedObjectsMap.ebomPCI ) {
                objectToLoad.ebomPCI = response.loadedObjectsMap.ebomPCI[0].uid;
            }
            if( response.loadedObjectsMap.mbomPCI ) {
                objectToLoad.mbomPCI = response.loadedObjectsMap.mbomPCI[0].uid;
            }
            if( response.loadedObjectsMap.processPCI ) {
                objectToLoad.processPCI = response.loadedObjectsMap.processPCI[ 0 ].uid;
            }
            if( response.loadedObjectsMap.productPCI ) {
                objectToLoad.productPCI = response.loadedObjectsMap.productPCI[0].uid;
            }
            if( response.loadedObjectsMap.plantPCI ) {
                objectToLoad.plantPCI = response.loadedObjectsMap.plantPCI[0].uid;
            }
            return objectToLoad;
        }
    );
}

export default {
    viewOtherConfiguration
};


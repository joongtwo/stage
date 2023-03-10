// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/epReviseHelper
 */
import _ from 'lodash';
import localeService from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import epSaveService from 'js/epSaveService';
import saveInputWriterService from 'js/saveInputWriterService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import mfgNotificationUtils from 'js/mfgNotificationUtils';

let resource = null;

export function displayConfirmationMessage( result, resourceBundle ) {
    resource = localeService.getLoadedText( resourceBundle );

    return mfgNotificationUtils.displayConfirmationMessage( getErrorMessage( result ), resource.confirmButton, resource.cancelButton );
}

export function getErrorMessage( result ) {
    return resource.reviseMessage.format( getReleasedObjects( result ) );
}

export function getReleasedObjects( result ) {
    let modelObjects = result.ServiceData.modelObjects;
    let releasedObjectList = [];
    for( let index in result.saveResults ) {
        let modelObject = modelObjects[ result.saveResults[ index ].clientID ];
        if( modelObject ) {
            releasedObjectList.push( '\"' + modelObject.props[ epBvrConstants.BL_REV_OBJECT_NAME ].uiValues[ 0 ] + '\"' );
        }
    }
    return releasedObjectList.join( '<br>' );
}

/**
 * Check for auto revise
 *
 * @param {Object} vmo the viewModelObject to check for auto revise
 */
export const checkAutoRevise = _.debounce( function( vmo ) {
    const saveInputWriter = saveInputWriterService.get();
    const obj = cdm.getObject( vmo.uid );
    saveInputWriter.addReviseInput( obj );
    epSaveService.saveChanges( saveInputWriter, true, [ obj ] );
}, 2000, { leading: true, trailing: false } );

export default {
    displayConfirmationMessage,
    getErrorMessage,
    getReleasedObjects,
    checkAutoRevise
};

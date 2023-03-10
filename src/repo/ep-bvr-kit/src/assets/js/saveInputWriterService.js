// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/saveInputWriterService
 */

import _ from 'lodash';
import epReloadService from 'js/epReloadService';
import SaveInput from 'js/saveInputService';


/**
 * @param { Object } saveInput save input
 * @param {Boolean} asyncMode boolean value true or false for calling savedata3 in background mode
 * @returns { Object } saveInput
 */
function convertToSaveInput( saveInput, asyncMode ) {
    let saveInputData = {
        saveInput: {
            sections: _.values( saveInput.sections ),
            relatedObjects: saveInput.relatedObjects
        }
    };
    if( asyncMode ) {
        saveInputData.saveInput.parameters = saveInput.parameters;
    }
    return saveInputData;
}

/**
 * @param { Object } saveInputObject save input object
 * @param {Boolean} asyncMode boolean value true or false for calling savedata3 in background mode
 * @returns { Object } saveInput
 */
export function getSaveInput( saveInputObject, asyncMode ) {
    if( epReloadService.hasReloadInputs() ) {
        let reloadInputJSON = epReloadService.getReloadInputJSON();
        saveInputObject.addReloadSection( reloadInputJSON );
    }
    return convertToSaveInput( saveInputObject, asyncMode );
}

/**
 * returns new SaveInput instance
 * @returns {Object} SaveInput
 */
export function get() {
    return new SaveInput();
}

/**
 * @param { Object } sectionName save section name
 */
export function resetDataEntrySection( sectionName ) {
    if( SaveInput.sections && SaveInput.sections[ sectionName ].dataEntries ) {
        SaveInput.sections[ sectionName ].dataEntries = [];
    }
}

export default {
    getSaveInput,
    get,
    resetDataEntrySection
};

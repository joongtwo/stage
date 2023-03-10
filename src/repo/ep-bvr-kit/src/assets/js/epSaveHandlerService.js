// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epSaveHandlerService
 */
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';


/**
 * Save edits
 *
 * @param {Object} dataSource the dataSource
 *
 * @returns {Promise} save promise
 */
function saveEdits( dataSource ) {
    const modifiedProperties = dataSource.getAllModifiedPropertiesWithVMO();
    const saveInputWriter = saveInputWriterService.get();
    const relatedObjects = [];
    modifiedProperties.forEach( ( modifiedProperty ) => {
        // need to check if it is not already there
        relatedObjects.push( modifiedProperty.viewModelObject );
        modifiedProperty.viewModelProps.forEach( ( viewModelProp ) => {
            saveInputWriter.addModifiedProperty( modifiedProperty.viewModelObject.uid, viewModelProp.propertyName, [ viewModelProp.dbValue.toString() ] );
        } );
    } );

    return epSaveService.saveChanges( saveInputWriter, false, relatedObjects );
}

/**
 * Return true if there are changes
 *
 * @param {Object} dataSource the dataSource
 *
 * @return {Boolean} true if there are changes
 */
function isDirty( dataSource ) {
    return dataSource.getAllModifiedProperties().length !== 0;
}

let saveHandler = {
    saveEdits,
    isDirty
};

/**
 * Returns the save handler
 *
 * @return {Object} the save handler
 */
export function getSaveHandler() {
    return saveHandler;
}

export default {
    getSaveHandler
};

// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import { constants as mfeVisConstants } from 'js/constants/mfeVisConstants';
import _ from 'lodash';

/**
 * @module js/mfeSyncUtils
 */

'use strict';

/**
 * Set the "toSelectObjects" to the given data provider
 *
 * @param {Object} dataProvider data provider
 * @param {Array} objectsToSelect objects to select
 * @param {Boolean} unselectIfEmpty unselect if empty
 * @returns {Object} loaded object to select
 */
export function setSelection( dataProvider, objectsToSelect, unselectIfEmpty = false ) {
    if( !dataProvider.viewModelCollection ) {
        return;
    }
    if( !Array.isArray( objectsToSelect ) ) {
        objectsToSelect = [ objectsToSelect ];
    }
    let uidList;
    const obj = objectsToSelect[ 0 ];
    if( obj && obj.uid ) {
        uidList = objectsToSelect.map( object => object.uid );
    } else{
        uidList = objectsToSelect;
    }
    const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;

    // TODO need to find a more performent way to do this.
    const loadedObjectToToSelect = loadedObjects.filter( loadedObj => uidList.indexOf( loadedObj.uid ) > -1 );
    if( loadedObjectToToSelect.length === 0 && unselectIfEmpty ) {
        dataProvider.selectionModel.selectNone();
        return;
    }
    dataProvider.selectionModel.setSelection( loadedObjectToToSelect );
    return loadedObjectToToSelect;
    // TODO add scroll and focus on selection
}

/**
 * Set the "objectsToSelect" to the given selectionModel
 *
 * @param {Object} selectionModel selectionModel
 * @param {Array} objectsToSelect objects to select
 */
export function setSelectionInSelectionModel( selectionModel, objectsToSelect ) {
    if( !Array.isArray( objectsToSelect ) ) {
        objectsToSelect = [ objectsToSelect ];
    }
    objectsToSelect[ 0 ] && selectionModel.setSelection( objectsToSelect );
}

/**
 * Set the input Object
 *
 * @param {Object} data data
 * @param {Object} value selected object
 */
export function setInputObject( data, value ) {
    data.inputObject = value;
}

/**
 * Returns the selection object in Visibility data format
 *
 * @param {Object} vmo - the selected object
 *
 * @returns {Object} object in Visibility format
 */
export function convertToVisibilityData( vmo ) {
    let visibilityData = {
        uid: 'unknown',
        show: false
    };
    if( vmo && vmo.props ) {
        visibilityData.uid = vmo.uid;
        visibilityData.show = vmo.props[ mfeVisConstants.GRAPHICS_VISIBILITY_PROP_NAME ].value === mfeVisConstants.LOADING;
    }
    return visibilityData;
}

/**
 * Get single input object
 * @param {Object} inputObject the ViewModel data
 * @param {Object} newInput the new Input
 * @return {Object} object
 */
function handleNewInputForSingleObject( inputObject, newInput ) {
    if( newInput === '' ) {
        // unmount case - framework is sending empty string
        // we don't want to set this new input in the input object
        // we return and the next actions in the view model can continue using old input.
        return {
            inputObject: inputObject,
            isInputObjectUpdated: false
        };
    }
    let input = newInput;
    if ( Array.isArray( newInput ) ) {
        if ( newInput.length === 1 ) {
            input = newInput[0];
        }else{
            input = null;
        }
    }

    if( inputObject && input && input.uid === inputObject.uid ) {
        return {
            inputObject: inputObject,
            isInputObjectUpdated: false
        };
    }
    return {
        inputObject: input,
        isInputObjectUpdated: true
    };
}

/**
 *
 * @param {Object} syncedObject the sync object
 * @param {Object} newInput the new Input
 * @returns {Object} object
 */
function saveSingleObjectOnlyOrNull( syncedObject, newInput ) {
    if( newInput === '' || newInput === undefined ) {
        // unmount case - framework is sending empty string
        // we don't want to set this new input in the input object
        // we return and the next actions in the view model can continue using old input.
        return  {
            syncObject:syncedObject,
            isSingleSyncObjectUpdated: false
        };
    }
    // workaround beacuse converter action cannot pass the full object
    if( newInput.syncObjectValue ) {
        newInput = newInput.syncObjectValue;
    }
    let input = 'null';
    if( Array.isArray( newInput ) ) {
        if ( newInput.length === 1 ) {
            input = newInput[ 0 ];
        }else{
            return {
                syncObject: syncedObject,
                isSingleSyncObjectUpdated: false
            };
        }
    } else if( newInput && newInput.uid ) {
        input = newInput;
    } else if( typeof newInput === 'string' ) {
        input = newInput;
    }
    //reference check
    if( syncedObject === input ) {
        return {
            syncObject: syncedObject,
            isSingleSyncObjectUpdated: false,
            isSameObjectUpdate: true

        };
    }
    //special check for objects with uids
    if( input && syncedObject && input.hasOwnProperty( 'uid' ) && input.uid === syncedObject.uid ) {
        return {
            syncObject:syncedObject,
            isSingleSyncObjectUpdated: false,
            isSameObjectUpdate:true
        };
    }
    return {
        syncObject: input,
        isSingleSyncObjectUpdated: true
    };
}

/**
 *
 * @param {Array} multipleSyncObjects the sync objects
 * @param {Object[]} newInput the new Input
 * @returns {Object} ovject
 */
function saveMultipleObjects( multipleSyncObjects, newInput ) {
    if( newInput === '' || newInput === undefined ) {
        // unmount case - framework is sending empty string
        // we don't want to set this new input in the input object
        // we return and the next actions in the view model can continue using old input.
        return {
            multipleSyncObjects: multipleSyncObjects,
            isMultipleSyncObjectsUpdated: false
        };
    }
    // workaround beacuse converter action cannot pass the full object
    if( newInput.syncObjectValue ) {
        newInput = newInput.syncObjectValue;
    }

    if( !Array.isArray( newInput ) ) {
        newInput = [ newInput ];
    }
    const currentInputObjectsWhichAreNotInNewInput = multipleSyncObjects.length > 0 && multipleSyncObjects.filter( ( current ) => newInput.indexOf( current ) === -1 );
    const deltaFromPreviousInput = currentInputObjectsWhichAreNotInNewInput.length > 0 || multipleSyncObjects.length !== newInput.length;
    if( deltaFromPreviousInput ) {
        return {
            multipleSyncObjects: newInput,
            isMultipleSyncObjectsUpdated: true
        };
    }
    return {
        multipleSyncObjects: multipleSyncObjects,
        isMultipleSyncObjectsUpdated: false
    };
}

export default {
    setSelection,
    setSelectionInSelectionModel,
    setInputObject,
    convertToVisibilityData,
    handleNewInputForSingleObject,
    saveSingleObjectOnlyOrNull,
    saveMultipleObjects
};


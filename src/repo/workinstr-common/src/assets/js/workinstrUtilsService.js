// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


/**
 * @module js/workinstrUtilsService
 */

import messagingSvc from 'js/messagingService';
import AwStateService from 'js/awStateService';
import appCtxSvc from 'js/appCtxService';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import eventBus from 'js/eventBus';


/**
 * Parses the configuration preference. The values in the preference are in the following form <Relation or Property
 * Name>:optional comma separated type names Or <Panel Name>: comma separated tab names
 *
 * @param {String} preferenceValues the preference values
 * @return {StringArray} the parsed map
 */
export function parsePreferenceValues( preferenceValues ) {
    if( preferenceValues && preferenceValues.length > 0 ) {
        let parsedMap = [];
        preferenceValues.forEach( ( currPreference ) => {
            let tokens = currPreference.split( ':' );
            if( tokens.length === 1 ) {
                // Only relation name
                // Make sure there are no , in the relation name
                if( tokens[ 0 ].split( ',' ).length > 1 ) {
                    messagingSvc.showError( 'Invalid prefernce value' );
                }
                parsedMap.push( {
                    relationName: tokens[ 0 ].trim(),
                    types: []
                } );
            } else if( tokens.length === 2 ) {
                // There are types
                let typesList = tokens[ 1 ].split( ',' );
                for( let currentType in typesList ) {
                    typesList[ currentType ] = typesList[ currentType ].trim();
                }

                parsedMap.push( {
                    relationName: tokens[ 0 ].trim(),
                    types: typesList
                } );
            } else {
                messagingSvc.showError( 'Invalid preference value' );
            }
        } );

        return parsedMap;
    }
    return null;
}

/**
 * Add a relation and its types to all relations to load list
 *
 * @param {StringArray} allRelationsToLoad the list of all relations to load
 * @param {String} relationName the new relation to add to the all relations to load list
 * @param {StringArray} relationTypes the new relation types to add to the all relations to load list
 */
export function addRelationToAllRelationsToLoad( allRelationsToLoad, relationName, relationTypes ) {
    // If the list is empty, it means some data provider wants to load all related types for given relation.
    // in that case we should not add any specific filter types.
    if( relationTypes.length === 0 ) {
        allRelationsToLoad[ relationName ] = [];
    } else {
        let existingRelationTypes = allRelationsToLoad[ relationName ];
        if( existingRelationTypes && existingRelationTypes.length === 0 ) {
            return;
        }

        if( !existingRelationTypes ) {
            allRelationsToLoad[ relationName ] = [];
            existingRelationTypes = allRelationsToLoad[ relationName ];
        }

        relationTypes.forEach( ( relationType ) => {
            if( !existingRelationTypes.includes( relationType ) ) {
                existingRelationTypes.push( relationType );
            }
        } );
    }
}

/**
 * Add array values to array list
 *
 * @param {Array} theArrayList the existing array list
 * @param {Array} valuesToAdd the new values to add to the existing list
 *
 * @return {Array} the updated array with the new values
 */
export let addArrayValuesToArrayList = function( theArrayList, valuesToAdd ) {
    if( !theArrayList ) {
        return valuesToAdd;
    }
    valuesToAdd.forEach( function( element ) {
        theArrayList.push( element );
    } );
    return theArrayList;
};

/**
 * Navigates to the object with the given uid
 *
 * @param {string} objUid - the object uid to go to
 */
export let navigateToObject = function( objUid ) {
    if( objUid ) {
        AwStateService.instance.params.uid = objUid;
        AwStateService.instance.go( '.', AwStateService.instance.params );
        eventBus.publish( 'awPopup.close' );
    }
};

/**
 * Remove a value from array list
 *
 * @param {Array} theArrayList the existing array list
 * @param {Array} valueToRemove the value to remove from the existing list
 *
 * @return {Array} the updated array without the removed value
 */
export let removeArrayValueFromArrayList = function( theArrayList, valueToRemove ) {
    theArrayList = theArrayList.filter( function( item ) {
        return item !== valueToRemove;
    } );
    return theArrayList;
};

/**
 * Set the tools & info markup context dataset in case there is more than one PDF displayed on different viewers
 *
 * @param {Object} commandCtx the command context
 *
 * @return {Object} the updated commandCtx
 */
export function setMarkupContext( commandCtx ) {
    let element = commandCtx.tabModel.viewerData.viewerRef.current.querySelector( '.aw-pdf-viewer' );
    let frame;
    let type = 'aw-pdf-viewer';
    if( element ) {
        frame = element.querySelector( 'iframe#pdfViewerIFrame' );
    } else { // captured img
        element = commandCtx.tabModel.viewerData.viewerRef.current.querySelector( '.aw-imageviewer-viewer' );
        type = 'aw-image-viewer';
    }

    let selectedDataset = commandCtx.tabModel.viewerData.datasetData;
    let ctx = {
        vmo: selectedDataset,
        commands: {},
        type: type,
        commandCtx: commandCtx,
        element: element
    };

    if ( frame && frame.contentWindow ) {
        ctx.pdfFrame = frame.contentWindow;
    }

    appCtxSvc.registerCtx( 'viewerContext', ctx );
    return mfeViewModelUtils.mergeValueInViewModel( commandCtx, ctx );
}

export default {
    parsePreferenceValues,
    addRelationToAllRelationsToLoad,
    addArrayValuesToArrayList,
    navigateToObject,
    removeArrayValueFromArrayList,
    setMarkupContext
};

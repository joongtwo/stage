// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Documents Service for EasyPlan.
 *
 * @module js/epDocumentsService
 */

import mfeSyncUtils from 'js/mfeSyncUtils';
import cdm from 'soa/kernel/clientDataModel';
import mfeTableService from 'js/mfeTableService';
import mfeVMOLifeCycleSvc from 'js/services/mfeViewModelObjectLifeCycleService';
import { constants as epSaveConstants } from 'js/epSaveConstants';

const WEB_LINK_TYPE = 'Web Link';

/**
 * Add the new Document Item before the Web Links to the Documents data provider
 * as documents should be grouped by type and document items should appear before web links
 *
 * @param {StringArray} objUidToAddList - Array of objects UID we want to Add to documents data provider
 * @param {Object} dataProvider - data provider which need to be updated
 */
function addDocumentItemToDataProvider( objUidToAddList, dataProvider ) {
    if( objUidToAddList && objUidToAddList.length > 0 ) {
        const viewModelCollection = dataProvider.getViewModelCollection();
        const loadedVMObjects = viewModelCollection.loadedVMObjects;

        const newList = loadedVMObjects.filter( obj => obj.type !== WEB_LINK_TYPE );
        objUidToAddList.forEach( ( objectUid ) => {
            newList.push( mfeVMOLifeCycleSvc.createViewModelObjectFromUid( objectUid ) );
        } );
        newList.push( ...loadedVMObjects.filter( obj => obj.type === WEB_LINK_TYPE ) );

        dataProvider.update( newList, newList.length );

        // Select the newly added document item
        const addedModelObjs = objUidToAddList.map( objUid => cdm.getObject( objUid ) );
        mfeSyncUtils.setSelection( dataProvider, addedModelObjs );
    }
}

/**
 * Handle the events which were returned from the save soa server call
 *
 * @param {Object} saveEvents - the save events as json object
 * @param {String} relationNames - the relation type names
 * @param {Object} dataProvider - the table data provider
 * @param {String} inputObjectUid - selected tab scopeObject Uid
 */
export function handleDocumentsAddRemoveSaveEvents( saveEvents, relationNames, dataProvider, inputObjectUid ) {
    const actionsDone = [];
    if( !Array.isArray( relationNames ) ) {
        relationNames = [ relationNames ];
    }
    let ootbRelationNames = [ 'mbc0AssignedDocuments', 'Mfg0sub_elements', 'Mbc0EPDocument', 'mbc0AttachedForm' ];
    relationNames.push( ...ootbRelationNames );

     // Iterate over unique relation names as duplicates will add documents multiple times in table
     const uniqueSetofRelationNames = new Set( relationNames );
     uniqueSetofRelationNames.forEach( ( relationName ) => {
        const relevantEvents = saveEvents[ relationName ];
        if( relevantEvents && relevantEvents.eventObjectUid === inputObjectUid ) {
            // confirm tab scope object and save event object is same, or else no need to update tab content
            const relatedEvents = relevantEvents.relatedEvents;
            const objUidToDeleteList = relatedEvents[ epSaveConstants.DELETE ];
            const objUidToRemoveList = relatedEvents[ epSaveConstants.REMOVED_FROM_RELATION ];
            const objUidToAddList = relatedEvents[ epSaveConstants.ADDED_TO_RELATION ];
            if( objUidToRemoveList && objUidToRemoveList.length > 0 ) {
                mfeTableService.removeFromDataProvider( objUidToRemoveList, dataProvider );
                dataProvider.selectNone();
            }
            if( objUidToDeleteList && objUidToDeleteList.length > 0 ) {
                mfeTableService.removeFromDataProvider( objUidToDeleteList, dataProvider );
                dataProvider.selectNone();
            }
            addDocumentItemToDataProvider( objUidToAddList, dataProvider );
        }
    } );

    return actionsDone;
}

const exports = {
    handleDocumentsAddRemoveSaveEvents
};

export default exports;

// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for Planning / twin / sync creation
 *
 * @module js/syncOperationService
 */
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import msgSvc from 'js/messagingService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import _ from 'lodash';

/**
 * Create sync for the Plant /Plant BOP with associated plant BOP or Plant
 *
 * @param {ModelObject} objToSync - the object to sync
 * @param {boolean} isRemoveObsoleteLine - flag to remove async lines
 */
export const createSync = function( objToSync, isRemoveObsoleteLine ) {
    const epPageContext = appCtxService.getCtx( 'epPageContext' );
    const collaborationContext = epPageContext.collaborationContext;
    let objectsToSyncUids = [];
    let objectsToSync = [];

    if( !Array.isArray( objToSync ) ) {
        objectsToSync.push( objToSync );
    } else{
        objectsToSync = objToSync;
    }

    if ( isRemoveObsoleteLine === undefined ) {
        isRemoveObsoleteLine = 'false';
    }
    _.each( objectsToSync, function( selectedNode ) {
        if( selectedNode.uid ) {
            objectsToSyncUids.push( selectedNode.uid );
        }
    } );
    if( collaborationContext ) {
        let pageContextModelObject = {
            Object: collaborationContext.uid,
            syncFrom: objectsToSyncUids,
            isRemoveObsoleteTwin: isRemoveObsoleteLine
        };

        let saveInputWriter = saveInputWriterService.get();
        saveInputWriter.addSyncObject( pageContextModelObject );
        saveInputWriter.addRelatedObjects( objectsToSync );
        return epSaveService.saveChanges( saveInputWriter, true, [ collaborationContext ] ).then( ( response ) => {
            if( objectsToSync[0].type === epBvrConstants.MBC_WORKAREA_ELEMENT ) {
                let nodesToToggle = [];
                let treeDataObject = appCtxService.getCtx( 'aceTreeLoadDataResult' );
                _.each( treeDataObject.vmc.loadedVMObjects, function( child ) {
                    if( objectsToSyncUids.includes( child.uid ) ) {
                        nodesToToggle.push( child );
                    }
                } );
                _.each( nodesToToggle, function( node ) {
                    fireTreeExpandEvent( node );
                } );
            } else{
                let eventData = {
                    objectsToSync: objToSync
                };
                eventBus.publish( 'ep.syncSuccess', eventData );
            }
            //No saveResults in case saveChanges fails
            if ( response.saveResults ) {
                showSynSuccessMessage( response.saveResults );
            }
        } );
    }
};

/**
 * Show the message stating the sync action was successful.
 * @param {*} saveResults
 */
function showSynSuccessMessage( saveResults ) {
    if( Array.isArray( saveResults ) && saveResults.length > 0 ) {
        for( let resultObj of saveResults ) {
            if( resultObj.saveResultObject.type !== epBvrConstants.ME_COLLABORATION_CONTEXT ) {
                const source = resultObj.saveResultObject.props.object_string.uiValues[ 0 ];
                let localTextBundle = localeService.getLoadedText( 'TwinMessages' );
                let successResponseMessage = localTextBundle.syncSuccessful;
                let msg =  successResponseMessage.replace( '{0}', source );
                msgSvc.showInfo( msg );
            }
        }
    }
}

/**
 * Expand/Collapse selected node
 * @param {Object} treeNodeToToggle tree node to be toggled
 */
function fireTreeExpandEvent( treeNodeToToggle ) {
    /* If this node is already expanded, then we have to collapse and
    then expand this tree to refresh the contents of this node. */
    if ( treeNodeToToggle.isExpanded ) {
        treeNodeToToggle.isExpanded = false;
        eventBus.publish( 'occTreeTable.plTable.toggleTreeNode', treeNodeToToggle );
    }
    if( treeNodeToToggle.__expandState ) {
        delete treeNodeToToggle.__expandState;
    }
    treeNodeToToggle.isExpanded = true;
    eventBus.publish( 'occTreeTable.plTable.toggleTreeNode', treeNodeToToggle );
}

let exports;
export default exports = {
    createSync
};

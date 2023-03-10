// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * File Attachement Service for EasyPlan.
 *
 * @module js/epFileAttachmentService
 */
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import AwPromiseService from 'js/awPromiseService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import cdm from 'soa/kernel/clientDataModel';
import fileManagementService from 'soa/fileManagementService';
import fmsUtils from 'js/fmsUtils';
import mfeVMOService from 'js/services/mfeViewModelObjectLifeCycleService';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import mfeSyncUtils from 'js/mfeSyncUtils';
import epReloadService from 'js/epReloadService';

/**
 * Get the list of attachments
 * @param {Object} object object
 * @returns {Object} object that contains the list of attachments and length of that list
 */
export function getAttachedFilesList( object ) {
    if ( object ) {
        const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.ATTACHMENTS ], object, [ epBvrConstants.MBC_ATTACHED_FILES ] );
        return epLoadService.loadObject( loadTypeInput, false ).then( ( response ) => {
            const attachedFiles = [];
            const attachedFileUidsArray = response.relatedObjectsMap[object].additionalPropertiesMap2[ epBvrConstants.MBC_ATTACHED_FILES ];
            attachedFileUidsArray.forEach( ( file ) => {
                const vmo = mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( file ) );
                const relation = response.relatedObjectsMap[file].additionalPropertiesMap2.relation[0];
                vmo.datasetRelation = [ cdm.getObject( relation ) ];
                attachedFiles.push( vmo );
            } );
            return {
                totalFound: attachedFiles.length,
                searchResults: attachedFiles
            };
        } );
    }
    return AwPromiseService.instance.resolve( {
        totalFound: 0,
        searchResults: []
    } );
}

/**
 * Update the newly added dataset VMOs with the relation object associated with them.
 * @param {*} relevantEvents - relevant events
 * @param {*} dataProvider - data provider
 * @param {*} inputObjectUid - input object
 */
export function updateVMODatasetRelation( relevantEvents, dataProvider, inputObjectUid ) {
    if ( relevantEvents.eventObjectUid === inputObjectUid ) {
        const relatedEvents = relevantEvents.relatedEvents;
        const deletedDatasetUids = relatedEvents[epSaveConstants.REMOVED_FROM_RELATION];
        //Clear the selection if save event contains removedFromRelation details
        if ( deletedDatasetUids && deletedDatasetUids.length > 0 ) {
            mfeSyncUtils.setSelection( dataProvider, {} );
            return;
        }
        const addedDatasetUids = relatedEvents[epSaveConstants.ADDED_TO_RELATION];
        const createdRelationUids = relatedEvents[epSaveConstants.CREATE_DATASET_RELATION];
        if ( addedDatasetUids && addedDatasetUids.length > 0 && createdRelationUids && createdRelationUids.length === addedDatasetUids.length ) {
            const loadedDatasetVMOs = dataProvider.viewModelCollection.loadedVMObjects;
            const newlyAddedVMOs = loadedDatasetVMOs.filter( loadedObj => addedDatasetUids.indexOf( loadedObj.uid ) > -1 );
            newlyAddedVMOs.forEach( ( vmo, index ) => {
                vmo.datasetRelation = [ cdm.getObject( createdRelationUids[index] ) ];
            } );
        }
    }
}

/**
 * this method downloads given attachment file
 * @param {Object} files files
 */
export function downloadAttachment( files ) {
    const fileUids = [];
    files.forEach( ( fileObj ) => {
        fileUids.push( fileObj.uid );
    } );
    const addLoadParams = [ {
        tagName: 'inputObjectsToLoad',
        attributeName: 'objectsUid',
        attributeValue: fileUids
    } ];
    let loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.GET_PROPERTIES ], '', [ epBvrConstants.DATASET_REFERENCES ], '', addLoadParams );
    epLoadService.loadObject( loadTypeInputs, false ).then(
        function() {
            const imanFiles = files.map( file => cdm.getObject( file.props.ref_list.dbValues[ 0 ] ) );
            fileManagementService.getFileReadTickets( imanFiles ).then( function( ticketsResponse ) {
                if( ticketsResponse && ticketsResponse.tickets && ticketsResponse.tickets.length > 1 ) {
                    let originalFileName = null;
                    const imanFileArray = ticketsResponse.tickets[ 0 ];
                    imanFileArray.forEach( imanFile => {
                        const imanFileObj = cdm.getObject( imanFile.uid );
                        if( imanFileObj.props ) {
                            originalFileName = imanFileObj.props.original_file_name.uiValues[ 0 ];
                            originalFileName.replace( ' ', '_' );
                        }
                    } );

                    const ticketsArray = ticketsResponse.tickets[ 1 ];
                    if( ticketsArray && ticketsArray.length > 0 ) {
                        fmsUtils.openFile( ticketsArray[ 0 ], originalFileName );
                    }
                }
            } );
        }
    );
}

const exports = {
    getAttachedFilesList,
    updateVMODatasetRelation,
    downloadAttachment
};

export default exports;

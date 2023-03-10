// Copyright (c) 2022 Siemens

/**
 * Initialization service for Visuals list.
 *
 * @module js/epVisualsGalleryService
 */
import _ from 'lodash';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import appCtxService from 'js/appCtxService';
import mfeTableService from 'js/mfeTableService';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import cdm from 'soa/kernel/clientDataModel';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import localeService from 'js/localeService';
import popupService from 'js/popupService';
import eventBus from 'js/eventBus';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import AwPromiseService from 'js/awPromiseService';
import epLeavePlaceHandler from 'js/epLeavePlaceHandler';
import mfeListUtils from 'js/utils/mfeListUtils';

const _datasetTypes = [
    epBvrConstants.JPEG_OBJECT_TYPE,
    epBvrConstants.BITMAP_OBJECT_TYPE,
    epBvrConstants.IMAGE_OBJECT_TYPE,
    epBvrConstants.SNAPSHOT_OBJECT_TYPE,
    epBvrConstants.GIF_OBJECT_TYPE
];

const GRAPHICS_GALLERY_PANEL_ID = 'epGraphicsGalleryPanel';
const VISUAL_GALLERY_EDIT_IN_PROGRESS = 'visualsGallery.editInProgress';

let updatedVisualsUidToNameMap = {};
let activeRenameVisualPopupData = null;

/**
 * Get the thumbnail display name
 *
 * @param {Object} object - the object to display its name
 *
 * @returns {String} displayName - the thumbnail display name
 */
export function getThumbnailDisplayName( object ) {
    let displayName = null;

    let props = object.props ? object.props : object.properties;
    if( mfeTypeUtils.isOfTypes( object, [ epBvrConstants.SNAPSHOT_OBJECT_TYPE, epBvrConstants.WEB_LINK_OBJECT_TYPE, epBvrConstants.FULL_TEXT_OBJECT_TYPE, epBvrConstants.CME_REPORT_OBJECT_TYPE ] ) ) {
        displayName = props.object_string.displayValues ? props.object_string.displayValues[ 0 ] : props.object_string.dbValues[0];
    } else {
        const imanFiles = props.ref_list;
        if( imanFiles && imanFiles.uiValues.length > 0 && imanFiles.uiValues[0] ) {
            displayName =  imanFiles.uiValues[0];
        } else if( imanFiles && imanFiles.dbValues.length > 0 ) {
            const imanFileUid = imanFiles.dbValues[ 0 ]; // Process only first file uid
            const imanFileModelObject = cdm.getObject( imanFileUid );

            if( imanFileModelObject ) {
                displayName = imanFileModelObject.props.original_file_name.uiValues[ 0 ];
            }
        }

        if( displayName === null ) {
            displayName = props.object_name.uiValues[ 0 ];
        }
    }

    return displayName;
}

/**
 * Sort datasets
 *
 * @param {ObjectArray} datasetsToShow the datasets to sort
 * @returns {ObjectArray} the sorted datasets
 */
function sortDatasets( datasetsToShow ) {
    datasetsToShow.sort( ( set1, set2 ) => {
        const name1 = getThumbnailDisplayName( set1 ).toLowerCase();
        const name2 = getThumbnailDisplayName( set2 ).toLowerCase();
        if( name1 < name2 ) {
            return -1;
        } else if( name1 === name2 ) {
            return 0;
        }
        return 1;
    } );
    return datasetsToShow;
}

/**
 * Get the selected process/ operation datasets to display in visuals gallery
 *
 * @param {String} selectedObjId - selected process/ operation uid
 *
 * @returns {Object} Visuals list attached to obj and their total
 */
export function updateGalleryPanel( selectedObjId ) {
    let result = {
        datasetsToShow: [],
        totalFound: 0
    };
    if( selectedObjId ) {
        registerLeaveHandler( cdm.getObject( selectedObjId ) );
        let loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( epLoadConstants.FILM_STRIP_PANEL, selectedObjId );
        return epLoadService.loadObject( loadTypeInputs, false ).then( function( output ) {
            const modelObjs = output.ServiceData.modelObjects;
            let datasetsToShow = _.filter( modelObjs, obj => _.includes( _datasetTypes, obj.type ) );
            updateEffectivityInProductViews( datasetsToShow, output.relatedObjectsMap );
            datasetsToShow = sortDatasets( datasetsToShow );
            const totalFound = datasetsToShow.length;

            result = {
                datasetsToShow,
                totalFound
            };

            return result;
        } );
    }

    return result;
}

/**
 * Update the effectivity objects in the Product View datasets
 */
export function updateEffectivityInProductViews( datasetsToShow, relatedObjectsMap ) {
    datasetsToShow.forEach( dataset => {
        if( dataset.type === epBvrConstants.SNAPSHOT_OBJECT_TYPE ) {
            let effectivityUids = relatedObjectsMap[ dataset.uid ].additionalPropertiesMap2.Effectivity;
            if( effectivityUids ) {
                let effectivityObjs = effectivityUids.map( effUid => cdm.getObject( effUid ) );
                dataset.effectivities = effectivityObjs;
            } else {
                dataset.effectivities = [];
            }
        }
    } );
    return datasetsToShow;
}

/**
 * Update the effectivity objects in the Product View VMOs
 */
export function updateProductViewVMOsWithEffectivities( datasetsToShow, epVisualsListDataProvider ) {
    let loadedVMOs = epVisualsListDataProvider.viewModelCollection.loadedVMObjects;
    datasetsToShow.forEach( dataset => {
        if( dataset.type === epBvrConstants.SNAPSHOT_OBJECT_TYPE && dataset.effectivities ) {
            let vmo = loadedVMOs.find( vmo => vmo.uid === dataset.uid );
            if( vmo ) {
                vmo.effectivities = dataset.effectivities;
            }
        }
    } );
}

/**
 * update ctx for "wiPageContext.isImageViewer"
 *
 * @param {String} name - name of ctx to be updated
 * @param {String} data - epVisualsGalleryViewModel data
 */
export function updateCtxForImageViewer( name, data ) {
    let isSelection = data.dataProviders.epVisualsListDataProvider.selectedObjects.length > 0;
    appCtxService.updatePartialCtx( name, isSelection );
}

/**
 * filter event data by type
 *
 * @param {Object} eventData - the save events as json object
 * @param {String} eventType - event Type
 */
function getEventData( eventData, eventType ) {
    return eventData.saveEvents.filter( event => event.eventType === eventType );
}

/**
 * Handle Save Events for Visual Gallery Panel"
 *
 * @param {String} eventData - the event data of save events
 * @param {String} dataProvider - epVisualsGalleryViewModel dataprovider
 */
export function handleSaveEvents( eventData, dataProvider ) {
    const modifyRelationsEvent = getEventData( eventData, epSaveConstants.MODIFY_RELATIONS );
    if( modifyRelationsEvent.length > 0 && ( modifyRelationsEvent[ 0 ].eventData.includes( epBvrConstants.MBC_ATTACHED_FILES ) ||
            modifyRelationsEvent[ 0 ].eventData.includes( epBvrConstants.MBC_ATTACHED_DATASET ) ) ) {
        handleAddedToRelationEvent( eventData, dataProvider );

        handleDeleteAndRemovedFromRelationEvent( eventData, dataProvider );
    }
    return dataProvider.viewModelCollection.loadedVMObjects.map( vmo => cdm.getObject( vmo.uid ) );
}

/**
 * Handle Create And AddedToRelation Event for Visual Gallery Panel"
 *We need to check for correct type when adding visual to dataProvider
 * @param {String} eventData - the event data of save events
 * @param {String} dataProvider - epVisualsGalleryViewModel dataprovider
 */
export function handleAddedToRelationEvent( eventData, dataProvider ) {
    let visualtoAdd = [];
    const addedToRelationEvent = getEventData( eventData, epSaveConstants.ADDED_TO_RELATION );
    if( addedToRelationEvent && addedToRelationEvent.length > 0 ) {
        if( _datasetTypes.includes( cdm.getObject( addedToRelationEvent[ 0 ].eventObjectUid ).type ) ) {
            visualtoAdd.push( addedToRelationEvent[ 0 ].eventObjectUid );
            mfeTableService.addToDataProvider( visualtoAdd, dataProvider );

            setTimeout( function() {
                mfeListUtils.horizontalListScrollToEnd( GRAPHICS_GALLERY_PANEL_ID );
                appCtxService.updatePartialCtx( 'wiPageContext.isImageViewer', false );
            }, 100 );
        }
    }
}

/**
 * Handle Delete and Removed From Relation for Visual Gallery Panel"
 * We need 2 events to ensure sync with FIles tab and Visual Tab
 * @param {String} eventData - the event data of save events
 * @param {String} dataProvider - epVisualsGalleryViewModel dataprovider
 */
export function handleDeleteAndRemovedFromRelationEvent( eventData, dataProvider ) {
    let visualtoRemove = [];
    const removedFromRelationEvent = getEventData( eventData, epSaveConstants.REMOVED_FROM_RELATION );
    if( removedFromRelationEvent && removedFromRelationEvent.length > 0 ) {
        visualtoRemove.push( removedFromRelationEvent[ 0 ].eventObjectUid );
        mfeTableService.removeFromDataProvider( visualtoRemove, dataProvider );
    }

    let visualtoDelete = [];
    const deleteVisualEvent = getEventData( eventData, epSaveConstants.DELETE );
    if( deleteVisualEvent && deleteVisualEvent.length > 0 ) {
        visualtoDelete.push( deleteVisualEvent[ 0 ].eventObjectUid );
        mfeTableService.removeFromDataProvider( visualtoDelete, dataProvider );
    }
}

/**
 *
 * @param {Boolean} editMode edit mode
 */
function setEditMode( editMode ) {
    updatedVisualsUidToNameMap = {};
    appCtxService.updatePartialCtx( VISUAL_GALLERY_EDIT_IN_PROGRESS, editMode );
}

/**
 *
 * @param {Array} selectedObjects selected objects
 */
function showRenameVisualPopup( selectedObjects ) {
    if( selectedObjects && selectedObjects.length === 1 ) {
        let thumbnailDisplayName = updatedVisualsUidToNameMap[ selectedObjects[ 0 ].uid ] ? updatedVisualsUidToNameMap[ selectedObjects[ 0 ].uid ] :
            getThumbnailDisplayName( selectedObjects[ 0 ] );
        let fileObject = cdm.getObject( selectedObjects[ 0 ].props.ref_list.dbValues[ 0 ] );
        let extension = fileObject.props.file_ext ? '.' + fileObject.props.file_ext.uiValues[ 0 ] : '';
        let popupData = {
            declView: 'EpRenameVisualsPopup',
            options: {
                reference: 'span[id=\'' + getLabelId( selectedObjects[ 0 ].uid ) + '\']',
                placement: 'top',
                hasArrow: true,
                whenParentScrolls: 'close',
                isModal: false,
                clickOutsideToClose: true,
                draggable: false
            },
            subPanelContext: {
                objectUid: selectedObjects[ 0 ].uid,
                fileExtension: extension,
                fileName: thumbnailDisplayName.replace( extension, '' )
            }
        };
        popupService.show( popupData );
        activeRenameVisualPopupData = popupData;
    }
}

/**
 *
 * @param {String} objectUid object uid
 * @param {String} fileName file name
 * @param {String} fileExtension file extension
 */
function updateVisualGalleryCell( objectUid, fileName, fileExtension ) {
    if( fileName && fileName !== '' ) {
        let thumbnailDisplayName = fileName + fileExtension;
        if( thumbnailDisplayName !== getThumbnailDisplayName( cdm.getObject( objectUid ) ) ) {
            updatedVisualsUidToNameMap[ objectUid ] = thumbnailDisplayName;
            eventBus.publish( 'epVisualsGalleryCell.updateThumbnailDisplayName', {
                objectUid: objectUid,
                thumbnailDisplayName: thumbnailDisplayName
            } );
        }
    }

    // Rename visual popup closed
    activeRenameVisualPopupData = null;
}

/**
 *
 * @param {String} objectUid object uid
 * @returns {String} label Id
 */
function getLabelId( objectUid ) {
    if( objectUid ) {
        //Remove following characters (':', '/','.','$','_') from object ID
        let labelId = objectUid.replace( /\$/g, '' );
        labelId = labelId.replace( /\./g, '' );
        labelId = labelId.replace( new RegExp( ':', 'g' ), '' );
        labelId = labelId.replace( new RegExp( '/', 'g' ), '' );
        labelId = labelId.replace( /_/g, '' );
        return 'visualCell' + labelId;
    }
}

/**
 *
 * @param {String} visualUid visual uid
 * @param {String} newName new name of the visual
 * @returns {Object} rename input
 */
function getRenameVisualInput( visualUid, newName ) {
    return {
        Object: {
            nameToValuesMap: {
                id: [ visualUid ]
            }
        },
        Rename: {
            nameToValuesMap: {
                NewName: [ newName ]
            }
        }
    };
}

/**
 * @param {String} selectedObjUid selected operation/process uid
 * @param {Function} callback callback function
 */
function saveEdits( selectedObjUid, callback ) {
    //Close popup if open and wait till renamed data updated
    let timeout = 0;
    if( activeRenameVisualPopupData !== null ) {
        popupService.hide( activeRenameVisualPopupData );
        timeout = 300;
    }

    return setTimeout( function() {
        let visualsToUpdate = updatedVisualsUidToNameMap;
        setEditMode( false );
        let saveInputWriter = saveInputWriterService.get();
        let relatedObjects = [];

        //Add operation of process to check for Release status
        const selectedObj = cdm.getObject( selectedObjUid );
        relatedObjects.push( selectedObj );
        saveInputWriter.addReviseInput( selectedObj );

        Object.keys( visualsToUpdate ).forEach( visualUid => {
            const updatedName = visualsToUpdate[ visualUid ];
            const visualVmo = cdm.getObject( visualUid );
            relatedObjects.push( visualVmo );
            const objectsToModifyEntry = getRenameVisualInput( visualUid, updatedName );
            saveInputWriter.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, objectsToModifyEntry );
        } );

        if( !_.isEmpty( visualsToUpdate ) ) {
            return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then(
                function( result ) {
                    let status = 'fail';
                    if( result && result.ServiceData && !result.ServiceData.partialErrors ) {
                        status = 'success';
                    }

                    callback ? callback() : eventBus.publish( 'EPRenameVisualDataset', {
                        status: status
                    } );
                } );
        }
    }, timeout );
}

/**
 * Refresh the Visual Gallery Panel - sort and label update
 *
 * @param {Object} dataProvider - epVisualsGalleryViewModel data provider
 * @param {ObjectArray} datasetsToShow - datasetsToShow
 *
 * @returns {Object} the sorted data provider
 */
function refreshVisualsDataProvider( dataProvider, datasetsToShow ) {
    let sortedDatasetsToShow = sortDatasets( datasetsToShow );
    const totalFound = sortedDatasetsToShow.length;
    return dataProvider.update( sortedDatasetsToShow, totalFound );
}

/**
 *
 * @param {Object} inputObject input object
 */
function handleUnsavedChanges( inputObject ) {
    let timeout = 0;
    if( activeRenameVisualPopupData !== null ) {
        popupService.hide( activeRenameVisualPopupData );
        timeout = 300;
    }
    setTimeout( function() {
        if( Object.keys( updatedVisualsUidToNameMap ).length > 0 ) {
            displayConfirmationMessage( inputObject, handleInput );
        } else {
            setEditMode( false );
            handleInput();
        }
    }, timeout );
}

/**
 *
 */
function handleInput() {
    eventBus.publish( 'epVisualsGallery.handleInput' );
}

/**
 *
 * @param {Object} inputObject input object
 * @param {Function} callback callback function
 * @returns {object} message
 */
function displayConfirmationMessage( inputObject, callback ) {
    const localTextBundle = localeService.getLoadedText( '/i18n/GraphicsMessages' );
    return mfgNotificationUtils.displayConfirmationMessage(
        localTextBundle.visualsGalleryleaveConfirmation.format( inputObject.props.object_string.uiValues[ 0 ] ),
        localTextBundle.save, localTextBundle.discard ).then(
        () => {
            //on save
            saveEdits( inputObject.uid, function() {
                callback();
            } );
        },
        () => {
            setEditMode( false );
            callback();
        }
    );
}

/**
 * editorHasChanges
 *
 * @return {Boolean} isVisualsUpdated
 */
export const isVisualsUpdated = function() {
    return updatedVisualsUidToNameMap && Object.keys( updatedVisualsUidToNameMap ).length > 0;
};

/**
 *
 * @param {Object} inputObject input object
 */
function registerLeaveHandler( inputObject ) {
    epLeavePlaceHandler.registerHandlerForDirtyCheck( {
        isDirty: isVisualsUpdated,
        save: () => {
            if( inputObject && inputObject.uid ) {
                return saveEdits( inputObject.uid );
            }
            return AwPromiseService.instance.resolve();
        },
        discard: () => {
            setEditMode( false );
            return AwPromiseService.instance.resolve();
        }
    } );
}

/**
 * This function is needed for the specific case where rename visual popup
 * is active and you click cancel edit.
 */
function epVisualsGalleryCancelEdits() {
    let timeout = 0;
    if( activeRenameVisualPopupData !== null ) {
        popupService.hide( activeRenameVisualPopupData );
        timeout = 300;
    }
    setTimeout( function() {
        let eventData = {
            status: 'fail'
        };
        eventBus.publish( 'EPRenameVisualDataset', eventData );
        updatedVisualsUidToNameMap = {};
    }, timeout );
}

export default {
    updateGalleryPanel,
    updateCtxForImageViewer,
    handleSaveEvents,
    getThumbnailDisplayName,
    setEditMode,
    showRenameVisualPopup,
    updateVisualGalleryCell,
    saveEdits,
    getLabelId,
    refreshVisualsDataProvider,
    handleUnsavedChanges,
    epVisualsGalleryCancelEdits,
    updateProductViewVMOsWithEffectivities,
    updateEffectivityInProductViews
};

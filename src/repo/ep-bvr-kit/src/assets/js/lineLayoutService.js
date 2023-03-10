// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for Line Layout
 *
 * @module js/lineLayoutService
 */
import $ from 'jquery';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import fmsUtils from 'js/fmsUtils';
import AwStateService from 'js/awStateService';
import appCtxService from 'js/appCtxService';
import browserUtils from 'js/browserUtils';
import cdm from 'soa/kernel/clientDataModel';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import epInitializationService from 'js/epInitializationService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import { constants as epSaveConstants } from 'js/epSaveConstants';


/**
 * Load line modeObject
 *
 * @param {String} lineNameTitlePrefix - the line name title prefix
 * @param {String} workPackageNameTitlePrefix - the workPackage name title prefix
 *
 * @return {ModelObject} lineModelObject - the line ModelObject
 * @return {String} lineName - the line name
 * @return {Object} workPackageObject - the workPackage Object
 * @return {String} workPackageName - the workPackage name
 * @return {Object} dataset - the dataset Object
 * @return {Object} readOnlyEffectivityModeData - the effectivity data for the read only message
 * @return {String} lineNameTitle - the line name title
 * @return {String} workPackageNameTitle - the workPackage name title
 */
export function loadModel( lineNameTitlePrefix, workPackageNameTitlePrefix ) {
    $( '.aw-lineLayout-associatedElementCommandsPanel' ).removeClass( 'aw-base-blk-button' );
    const currentObjectUid = AwStateService.instance.params.uid;
    if ( currentObjectUid ) {
        const loadTypes = [ epLoadConstants.HEADER, epLoadConstants.LayoutInfo ];
        const loadtypeInput = epLoadInputHelper.getLoadTypeInputs( loadTypes, currentObjectUid );

        return epLoadService.loadObject( loadtypeInput, false ).then(
            function( response ) {
                if ( response.ServiceData ) {
                    const readOnlyEffectivityModeData = epInitializationService.getReadOnlyByEffectivityCaptionData( response );

                    let dataset;
                    const relatedObjectsMap = response.relatedObjectsMap;
                    if ( relatedObjectsMap[currentObjectUid] ) {
                        const datasetKey = relatedObjectsMap[currentObjectUid].additionalPropertiesMap2.Layout[0];
                        dataset = response.ServiceData.modelObjects[datasetKey];
                    }

                    const lineModelObject = response.ServiceData.modelObjects[currentObjectUid];
                    const lineName = lineModelObject.props.bl_rev_object_name.uiValues[0];
                    const workPackageObject = response.loadedObjectsMap.collaborationContext[0];
                    const workPackageName = workPackageObject.props.object_string.uiValues[0];

                    return {
                        lineModelObject,
                        lineName,
                        workPackageObject,
                        workPackageName,
                        dataset,
                        readOnlyEffectivityModeData,
                        lineNameTitle: lineNameTitlePrefix + ' ' + lineName,
                        workPackageNameTitle: workPackageNameTitlePrefix + ': ' + workPackageName
                    };
                }
            } );
    }
}

/**
 * Get the viewer type to display the dataset in
 *
 * @param {String} datasetType - the dataset file type
 *
 * @return {String} viewerType - viewer name
 */
export function getViewerType( datasetType ) {
    let viewerType;

    const images = [ 'jpeg', 'bitmap', 'gif', 'jpg', 'png', 'image', 'bmp' ];
    const pdfs = [ 'pdf' ];
    if ( images.indexOf( datasetType.toString().toLowerCase() ) !== -1 ) {
        viewerType = 'Awp0ImageViewer';
    } else if ( pdfs.indexOf( datasetType.toString().toLowerCase() ) !== -1 ) {
        viewerType = 'Awp0PDFViewer';
    }

    return viewerType;
}

/**
 * Get file URL from ticket.
 *
 * @param {String} ticket - File ticket.
 *
 * @return {String} file URL
 */
export function getLayoutFileURL( ticket ) {
    if ( ticket ) {
        return browserUtils.getBaseURL() + 'fms/fmsdownload/' + fmsUtils.getFilenameFromTicket( ticket ) +
            '?ticket=' + ticket;
    }
    return null;
}

/**
 * Put the viewer data in ctx
 *
 * @param {Object} viewerData
 */
export function setViewerDataInCtx( viewerData ) {
    appCtxService.updatePartialCtx( 'ep.lineLayoutViewerData', viewerData );
}

/**
 * Get the list of allowed file types to attach as dataset
 *
 * @param {ObjectArray} preferenceValues - 'EP_FileTypesForLayoutDataset' preference value, having the file types allowed to attach as dataset
 *
 * @return {String} allowedTypes - allowed file types to attach as a string list like '.png, .gif, .jpg, .jpeg'
 */
export function getAllowedDatasetTypes( preferenceValues ) {
    let allowedTypes = '';
    if ( preferenceValues ) {
        let preferenceValuesLen = preferenceValues.length;
        if ( preferenceValuesLen > 0 ) {
            allowedTypes = '.' + preferenceValues[0];
            for ( let i = 1; i < preferenceValuesLen; i++ ) {
                allowedTypes = allowedTypes + ', .' + preferenceValues[i];
            }
        }
    }

    return {
        allowedTypes
    };
}

/**
 * Get the dataset type according to the file extension
 *
 * @param {StringArray} typesList - List of default dataset types. values have the following pattern: "file_extension:dataset_type", e.g. "doc:MSWord"
 * @param {String} fileExtension - the file extension
 *
 * @return {String} fileType - the dataset type
 * @return {Boolean} isText - is the dataset of text type
 */
export function getFileType( typesList, fileExtension ) {
    let fileType = null;
    let isText = false;
    _.forEach( typesList, function( type ) {
        let str = type.split( ':' );
        if ( fileExtension.toLowerCase() === str[0] ) {
            fileType = str[1];
            isText = fileType === 'text';
            return false; // to break the loop
        }
    } );

    return {
        fileType,
        isText
    };
}

/**
 * Generate unique Id for the just created dataset name
 *
 * @return {String} a unique name for the just created dataset
 */
export function generateNewID() {
    return 'new_object_id' + Math.floor( Math.random() * 100 ) + 100;
}

/**
 * Set loading indication
 */
export function setLoading() {
    return false;
}

/**
 * Call ep saveData3 SOA
 *
 * @param {ModelObject} relatedObject - the related objects
 * @param { String } datasetDesc - the dataset description field
 * @param {Object} objectsToCreateEntry - the ObjectsToCreate section entries for the save input
 *
 * @return {Object} saveResults - the save results
 */
export function epSave( relatedObject, datasetDesc, objectsToCreateEntry ) {
    if ( datasetDesc ) {
        objectsToCreateEntry.ItemProps.nameToValuesMap.object_desc = [ datasetDesc ];
    }
    let saveInputWriter = saveInputWriterService.get();
    saveInputWriter.addEntryToSection( epSaveConstants.OBJECTS_TO_CREATE, objectsToCreateEntry );
    epSaveService.saveChanges( saveInputWriter, true, [ relatedObject ] ).then( function( result ) {
        const saveResults = result.saveResults;
        eventBus.publish( 'attachLineLayout.getSavedDatasetObject', saveResults );
    } );
}

/**
 * Get the saved dataset object
 *
 * @param {ObjectArray} saveResults - list save results objects
 * @param {String} id - the new created dataset name
 *
 * @return {String} datasetUid - the dataset uid
 * @return {ModelObject} datasetObj - the dataset object
 * @return {String} namedReference - the dataset namedReference
 */
export function getSavedDatasetObject( saveResults, id ) {
    let datasetUid = null;
    let datasetObj = null;
    let dataTypeObject = null;
    let namedReference = '';

    _.forEach( saveResults, function( result ) {
        if ( result.clientID === id ) {
            dataTypeObject = result.saveResultObject;
            return false; // to break the loop
        }
    } );

    if ( dataTypeObject !== null ) {
        datasetUid = dataTypeObject.uid;
        datasetObj = cdm.getObject( datasetUid );
        namedReference = datasetObj.modelType.references[0].name;
    }

    return {
        datasetUid,
        datasetObj,
        namedReference
    };
}

let exports;
export default exports = {
    loadModel,
    getViewerType,
    getLayoutFileURL,
    setViewerDataInCtx,
    getAllowedDatasetTypes,
    getFileType,
    generateNewID,
    setLoading,
    epSave,
    getSavedDatasetObject
};

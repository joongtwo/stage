// Copyright (c) 2022 Siemens

/**
 * @module js/Ewi0CollectedAttachmentsService
 */
import clientDataModelSvc from 'soa/kernel/clientDataModel';
import listBoxSvc from 'js/listBoxService';
import dmSvc from 'soa/dataManagementService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';

/**
 * Export
 */
var exports = {};

/**
 * Get Dataset Types list
 *
 * @param {Object} response - the response of getDatasetTypesWithDefaultRelation SOA call
 * @returns {ObjectArray} Array of list model objects of dataset types
 */
export let getDatasetTypesFromTypesWithRelInfo = function( response ) {
    var datasetTypeList = [];
    var outputArray = response.output[ 0 ].datasetTypesWithDefaultRelInfo;
    _.forEach( outputArray, function( entry ) {
        var datasetTypeObj = clientDataModelSvc.getObject( entry.datasetType.uid );
        datasetTypeObj.refInfos = entry.refInfos;
        datasetTypeList.push( datasetTypeObj );
    } );
    return listBoxSvc.createListModelObjects( datasetTypeList, 'props.datasettype_name' );
};

/**
 * Is file format of text type
 *
 * @param {Object} data - The view model data
 * @return {String} true if file format is TEXT, else false
 */
export let isTextFileFormat = function( fileType ) {
    return fileType && fileType.toLowerCase() === 'text';
};

/**
 * Get the current collected attachments by uids
 *
 * @param {StringArray} uidsToLoad the list of collected attachments uids
 *
 * @return {ModelObjectArray} the list of current collected attachments ModelObjects
 */
export let getCurrentAttachments = function( uidsToLoad ) {
    if( !uidsToLoad ) {
        var currentStepCtx = appCtxSvc.getCtx( 'EWI0currentStep' );
        uidsToLoad = currentStepCtx.props.ewi0ExecutionAttachment.dbValues;
    }
    var datasetsToShow = [];

    _.forEach( uidsToLoad, function( datasetUid ) {
        var datasetObj = clientDataModelSvc.getObject( datasetUid );
        datasetsToShow.push( datasetObj );
    } );

    if( uidsToLoad.length > 0 ) {
        return dmSvc.loadObjects( uidsToLoad ).then( function() {
            // Load the required properties for display of the current collected attachments objects.
            return dmSvc.getProperties( uidsToLoad, [ 'object_string' ] );
        } ).then( function() {
            return datasetsToShow;
        } );
    }
};

/**
 * Get all the selected objects in palette tab from Clipboard, Favorite and Recent
 *
 * @param {Object} paletteData the selected objects from Clipboard, Favorite and Recent
 *
 * @return {ModelObjectArray} the list of all the selected datasets in the palette tab
 */
export let getAllSelectedFromPalette = function( paletteData ) {
    let selectedInPalette = [];

    if( paletteData ) {
        _.forEach( paletteData, function( obj ) {
            selectedInPalette.push( obj.uid );
        } );
    }

    return selectedInPalette;
};

/**
 * Initialize the new file data form
 *
 * @param {ObjectArray} data - all the view data
 */
export let initForm = function( data ) {
    data.fileName = null;
    data.datasetName = null;
    data.datasetDesc = null;
    data.datasetType = null;
};

/**
 * A glue code to support electronic work instructions
 *
 * @param {Object} clientDataModelSvc - soa_kernel_clientDataModel
 * @param {Object} listBoxSvc - listBoxService
 * @param {Object} dmSvc - soa_dataManagementService
 * @param {Object} appCtxSvc - appCtxService

 * @return {Object} - Service instance
 *
 * @member Ewi0CollectedAttachmentsService
 */
export default exports = {
    getDatasetTypesFromTypesWithRelInfo,
    isTextFileFormat,
    getCurrentAttachments,
    getAllSelectedFromPalette,
    initForm
};

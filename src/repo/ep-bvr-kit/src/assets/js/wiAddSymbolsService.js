// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 *
 * @module js/wiAddSymbolsService
 */
import $ from 'jquery';
import browserUtils from 'js/browserUtils';
import fmsUtils from 'js/fmsUtils';
import { constants as wiCtxConstants } from 'js/wiCtxConstants';
import appCtxService from 'js/appCtxService';
import wiCkeditor5Service from 'js/wiCkeditor5Service';
import wiEditorService from 'js/wiEditor.service';


const JPG = '.jpg';
const PNG = '.png';
const JPEG = '.jpeg';
const GIF = '.gif';
const IMAGE = 'Image';

/**
 *
 * @param {Object} eventData symbol data
 * @returns {Object} dataset info
 */
function getDatasetInfo( eventData ) {
    const fileName = eventData.file.name;
    let outputData = {};
    if ( stringEndsWith( fileName, JPG ) || stringEndsWith( fileName, JPEG ) ||
          stringEndsWith( fileName, PNG ) || stringEndsWith( fileName, GIF ) ) {
        outputData.form = eventData.form;
        outputData.datasetInfo = {
            clientId: fileName,
            namedReferenceName: IMAGE,
            fileName: fileName,
            name: fileName,
            type: IMAGE
        };
    }
    return outputData;
}

/**
  * update data for fileData
  *
  * @param {Object} fileData - key string value the location of the file
  * @param {Object} form - the view model data object
  * @returns {Object} form data
  */
function updateFormData( fileData, form ) {
    if( fileData && fileData.value ) {
        /* globals $: false */
        const formData = new FormData( $( form )[ 0 ] );
        formData.append( fileData.key, fileData.value );
        return formData;
    }
}


/**
 *
 * @param {Object} symbolDataset symbol dataset
 * @param {String} fmsTicket fms ticket
 */
function insertSymbol( symbolDataset, fmsTicket ) {
    updateSymbolDatasetsMap( symbolDataset );
    const selectedEditorInstanceId = wiEditorService.getSelectedEditorObjectData().editorInstanceId;
    const selectedEditorInstance = selectedEditorInstanceId && wiEditorService.getEditorInstance( selectedEditorInstanceId );

    if( symbolDataset && fmsTicket ) {
        const imageUrl = getFileURLFromTicket( fmsTicket );
        imageUrl && wiCkeditor5Service.insertSymbol( selectedEditorInstance, imageUrl, symbolDataset.uid  );
    }
}

/**
  * Get file URL from ticket.
  * @param {String} ticket - File ticket.
  * @returns {String} fileURL file ticket
  */
function getFileURLFromTicket( ticket ) {
    if( ticket ) {
        return browserUtils.getBaseURL() + 'fms/fmsdownload/' + fmsUtils.getFilenameFromTicket( ticket ) +
             '?ticket=' + ticket;
    }
    return null;
}

/**
 *
 * @param {Object} symbolDataset symbol dataset
 */
function updateSymbolDatasetsMap( symbolDataset ) {
    let idToDatasetsMap = {};
    idToDatasetsMap = appCtxService.getCtx( wiCtxConstants.WI_EDITOR_OBJECT_ID_TO_DATASET_MAP );
    if( !idToDatasetsMap ) {
        idToDatasetsMap = {};
    }
    const selectedObject = wiEditorService.getSelectedEditorObjectData().selectedObject;
    if( idToDatasetsMap && idToDatasetsMap[ selectedObject.uid ] ) {
        idToDatasetsMap[ selectedObject.uid ].push( symbolDataset.uid );
    } else {
        let datasets = [];
        datasets.push( symbolDataset.uid );
        idToDatasetsMap[ selectedObject.uid ] = datasets;
    }
    appCtxService.updatePartialCtx( wiCtxConstants.WI_EDITOR_OBJECT_ID_TO_DATASET_MAP, idToDatasetsMap );
}

/**
  * Check if String ends with given suffix
  *
  * @param {String} str - input string
  * @param {String} suffix - suffix
  * @return {boolean} true, if string ends with given suffix
  */
function stringEndsWith( str, suffix ) {
    return str.toLowerCase().indexOf( suffix, str.length - suffix.length ) !== -1;
}

const exports = {
    getDatasetInfo,
    updateFormData,
    insertSymbol
};

export default exports;



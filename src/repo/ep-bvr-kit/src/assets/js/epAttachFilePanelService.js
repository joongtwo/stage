// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for attaching files to an object.
 *
 * @module js/epAttachFilePanelService
 */
import _ from 'lodash';
import cmdSvc from 'js/command.service';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';


/**
 * Returns file name with extension
 * @param {Object} addPanelState file type
 * @returns {String} file name
 */
function getFileName( addPanelState ) {
    let fileName = addPanelState.datasetVMO.props.datasetName.dbValue;
    if ( addPanelState.references.length > 0 ) {
        let regExp = /\.(?=[^\.]+$)/;
        let referenceFileName = addPanelState.references[0].propInternalValue.fileExtension;
        let fileExt = referenceFileName.split( regExp )[1];
        if ( !fileExt.includes( '*' ) ) {
            fileName = fileName + '.' + fileExt;
        }
    }
    return fileName;
}

/**
 * Returns true if file type is text
 * @param {String} fileType file type
 * @returns {Boolean} true if file type is text
 */
function isText( fileType ) {
    return fileType && fileType.toLowerCase() === 'text';
}

/**
 * Get the allowed file types.
 * @param {*} fileExtnsWithDatasetTypes - mapping of file extensions and dataset types
 * @return {*} allowedTypes - All allowed types
 */
function getAllowedFileTypes( fileExtnsWithDatasetTypes ) {
    let allowedTypes = '';
    if( fileExtnsWithDatasetTypes ) {
        const regex = new RegExp( '(.*):' );
        fileExtnsWithDatasetTypes.forEach( (  datasetType ) => {
            let t = regex.exec( datasetType );
            if( t !== null && t[ 1 ] ) {
                allowedTypes = allowedTypes + ', .' + t[ 1 ];
            }
        } );
    }
    return {
        allowedTypes
    };
}

/**
 * Get the saved dataset object.
 * @param {*} saveResults - saveResults array
 * @param {*} fileType - type of file
 * @return {*} Object
 */
function getSavedDatasetObject( saveResults, fileType ) {
    let datasetUid = null;
    let namedReference = '';

    fileType = getDatasetType( fileType );
    const datasetResultObjects = saveResults.filter( saveResult => saveResult.saveResultObject.type === fileType );
    if( datasetResultObjects !== undefined && datasetResultObjects.length === 1 ) {
        let datasetObject = datasetResultObjects[ 0 ].saveResultObject;
        datasetUid = datasetObject.uid;
        namedReference = datasetObject.modelType.references[ 0 ].name;
    }
    return {
        datasetUid,
        namedReference
    };
}

/**
 * Launch XCReplace file popup. Auto-revise check included
 * @param {*} selectionContext - selectionContext
 * @return {*} Object
 */
function launchReplaceXCFilePopupWithReviseCheck( selectionContext ) {
    let object = selectionContext.selection;
    //check for autorevise
    let saveInputWriter = saveInputWriterService.get();
    if( object ) {
        saveInputWriter.addReviseInput( object );
        return epSaveService.saveChanges( saveInputWriter, true, [ object ] )
            .then( function( result ) {
                if( !result ) {
                    return;
                }
                return cmdSvc.executeCommandIfVisibleAndEnabled( 'XcBrowseReplaceFilePopupCommand', selectionContext );
            } );
    }
}

/**
 * return the dataset type of an input object
 * @param {object} datasetTypeProp - Dataset type object
 * @returns {string} - return the dataset type
 */
function getDatasetType( datasetTypeProp ) {
    let datasetTypePropIn = datasetTypeProp.getValue ? datasetTypeProp.getValue() : datasetTypeProp.dbValue;

    //when input value into reference LOV directly, datasetTypeProp.dbValue.props will be undefined.
    let dtObjRefVals = _.get( datasetTypePropIn, 'props.object_string.dbValues' );
    let dtObjRefVal = '';
    if( dtObjRefVals && _.isArray( dtObjRefVals ) ) {
        dtObjRefVal = dtObjRefVals[ 0 ];
    } else {
        dtObjRefVal =  datasetTypePropIn;
    }
    return dtObjRefVal;
}

export default {
    getAllowedFileTypes,
    getSavedDatasetObject,
    launchReplaceXCFilePopupWithReviseCheck,
    isText,
    getFileName
};

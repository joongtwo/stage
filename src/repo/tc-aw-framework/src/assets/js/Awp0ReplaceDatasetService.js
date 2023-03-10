// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0ReplaceDatasetService
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import awFileNameUtils from 'js/awFileNameUtils';

var exports = {};

/**
 * Determine whether the given file name matches the reference type of dataset
 *
 * @param {String} fileName the new file name
 * @param {Object} refInfo the dataset reference object
 * @param {Boolean} matchOnWildCard the flag to control using wild card match or not
 * @return {Boolean} true if matched, false otherwise
 */
function isFileOfReferenceType( fileName, refInfo, matchOnWildCard ) {
    if( fileName !== null && refInfo !== null ) {
        var fileExt = awFileNameUtils.getFileExtension( fileName );
        if( fileExt !== '' ) {
            fileExt = _.replace( fileExt, '.', '' );
        }
        var refExt = awFileNameUtils.getFileExtension( refInfo.fileExtension );
        if( refExt !== '' ) {
            refExt = _.replace( refExt, '.', '' );
        }

        if( matchOnWildCard ) {
            //Wild card could either be "*" or "*.*", if its the first then '' will come back
            //If refExt is '' that means it is wild card and any file matches
            if( refExt === '' ) {
                return true;
            }

            //if * that means it is wild card any file matches
            if( refExt === '*' ) {
                return true;
            }
        }

        if( refExt !== '' ) {
            return fileExt.toLowerCase() === refExt.toLowerCase();
        }
    }

    return false;
}

/**
 * Get the selected dataset file info
 *
 * @param {Object} dataset the dataset object
 * @param {Object} data the data object in scope
 * @return {ObjectArray} the dataset file info object used as "getDatasetWriteTickets" SOA call input
 */
export let getDatasetFileInfos = function( dataset, subPageData, data, uploadFileSelectionData ) {
    var fileFormat = null;
    var referenceName = null;

    //First loop through looking for exact matches on file ext (no wild card)
    var refInfos = data.refInfos;

    var hostedFileNameContext = appCtxSvc.getCtx( 'HostedFileNameContext' );
    if( !subPageData.fileName && hostedFileNameContext ) {
        subPageData.fileName = hostedFileNameContext.filename;
        subPageData.fileNameNoExt = awFileNameUtils.getFileNameWithoutExtension( subPageData.fileName );
    }

    if( refInfos ) {
        var ii;
        var refInfo;

        for( ii = 0; ii < refInfos.length; ii++ ) {
            refInfo = refInfos[ ii ];
            if( isFileOfReferenceType( subPageData.fileName, refInfo, false ) ) {
                fileFormat = refInfo.fileFormat;
                referenceName = refInfo.referenceName;
                break;
            }
        }

        //If no exact matches found loop through second time this time accepting wild cards
        if( fileFormat === null || referenceName === null ) {
            for( ii = 0; ii < refInfos.length; ii++ ) {
                refInfo = refInfos[ ii ];
                if( isFileOfReferenceType( subPageData.fileName, refInfo, true ) ) {
                    fileFormat = refInfo.fileFormat;
                    referenceName = refInfo.referenceName;
                    break;
                }
            }
        }

        if( fileFormat === null || referenceName === null ) {
            throw 'replaceFileError';
        }

        var ticketFileName = subPageData.datasetFileName.dbValue;
        if( !ticketFileName || ticketFileName === '' ) {
            ticketFileName = subPageData.fileName;
        }

        return [ {
            allowReplace: true,
            fileName: ticketFileName,
            isText: fileFormat.toUpperCase() === 'TEXT',
            namedReferencedName: referenceName
        } ];
    }

    return null;
};

/**
 * Get reference object of given dataset
 *
 * @param {Object} selectedDataset the selected dataset object
 * @return {Object} the dataset reference object
 */
export let getDatasetRefObj = function( selectedDataset ) {
    var refObjUid = selectedDataset.props.ref_list.dbValues[ 0 ];
    return cdm.getObject( refObjUid );
};

/**
 * Get updated objects after replacing dataset file
 *
 * @param {Object} selectedDataset the selected dataset object
 * @param {Object} parentSelectedObj the parent selected object
 * @return {ObjectArray} updated objects
 */
export let getUpdatedObjects = function( selectedDataset, parentSelectedObj ) {
    var objs = [];
    if( selectedDataset ) {
        objs.push( cdm.getObject( selectedDataset.uid ) );
    }

    if( parentSelectedObj ) {
        objs.push( cdm.getObject( parentSelectedObj.uid ) );
    }

    return objs;
};

/**
 * populate original file name from each ImanFile and saves in context object
 *
 * @param {data} data object
 */
export let populateFileNames = function( objects, originalFileName ) {
    var fileNames = [];
    var imanFileObjects = objects;
    let originalFileNameIn = originalFileName;
    for( var i = 0; i < imanFileObjects.length; i++ ) {
        if( imanFileObjects[ i ].type !== 'ImanFile' ) {
            continue;
        }
        var objTemp = cdm.getObject( imanFileObjects[ i ].uid );
        if( objTemp ) {
            var actFileName = objTemp.props.original_file_name.dbValues[ 0 ];
            if( !originalFileNameIn ) {
                originalFileNameIn = objTemp.props.original_file_name;
            }
            fileNames.push( actFileName );
        }
    }
    var ctx = appCtxSvc.getCtx( 'selectedDataset' );
    if( ctx ) {
        ctx.fileNames = fileNames;
        appCtxSvc.updateCtx( 'selectedDataset', ctx );
    }

    return originalFileNameIn;
};

/**
 * Create getPlmdFIleTicket soa's input for single/multiple imanFile object attached
 *
 * @param {object} selected selected dataset object
 * @param {data} data object
 * @return {info} object
 */
export let createInputForDSM = function( selected, data ) {
    var datasetObj = cdm.getObject( selected.uid );
    var imanFileList = cdm.getObjects( datasetObj.props.ref_list.dbValues );
    var imanFile = null;
    var imanFileReference = '';
    if( imanFileList.length === 1 ) {
        imanFile = imanFileList[ 0 ];
        imanFileReference = datasetObj.props.ref_names.dbValues[ 0 ];
    } else {
        for( var i = 0; i < imanFileList.length; i++ ) {
            var tempVar = imanFileList[ i ];
            var fileName = tempVar.props.original_file_name.dbValues[ 0 ];
            if( data.datasetFileName !== undefined && fileName === data.datasetFileName.uiValue ) {
                imanFile = imanFileList[ i ];
                imanFileReference = datasetObj.props.ref_names.dbValues[ i ];
                break;
            }
        }
    }

    return [ {
        dataset: datasetObj,
        imanFile: imanFile,
        namedReferenceName: imanFileReference
    } ];
};

/**
 * If platform is not supported, Asyncronous replace operation should go to synchronous replace
 *
 * @param {response} response soa response
 * @returns {Boolean} - If platform is supported
 */
export let isPlatformSupported = function( response ) {
    var isPlatformSupported = false;
    if( response.ServiceData.partialErrors ) {
        var errorCode = response.ServiceData.partialErrors[ 0 ].errorValues[ 0 ].code;
        if( errorCode === 141170 ) {
            isPlatformSupported = true;
        }
    }

    var ctx = appCtxSvc.getCtx( 'selectedDataset' );
    if( ctx ) {
        ctx.isPlatformSupported = isPlatformSupported;
        appCtxSvc.updateCtx( 'selectedDataset', ctx );
    }
    return isPlatformSupported;
};

export default exports = {
    getDatasetFileInfos,
    getDatasetRefObj,
    getUpdatedObjects,
    populateFileNames,
    createInputForDSM,
    isPlatformSupported
};

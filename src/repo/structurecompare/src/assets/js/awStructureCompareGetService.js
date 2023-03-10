// Copyright (c) 2022 Siemens

/**
 * Wrapper code to process compare soa requests
 *
 * @module js/awStructureCompareGetService
 */
import appCtxSvc from 'js/appCtxService';
import cdmSvc from 'soa/kernel/clientDataModel';
import awCompareUtils from 'js/awStructureCompareUtils';
import _ from 'lodash';

var exports = {};

function _getParentUidForCompare( modelObject ) {
    if( modelObject && modelObject.props ) {
        var props = modelObject.props;
        var uid;

        if( props.awb0Parent && !_.isEmpty( props.awb0Parent.dbValues ) ) {
            uid = props.awb0Parent.dbValues[ 0 ];
        }

        if( cdmSvc.isValidObjectUid( uid ) ) {
            return uid;
        }
    }
    return null;
}

function _getToplevelParent( modelObject ) {
    var oldParent = modelObject;
    var newParent = modelObject;
    while( newParent !== null ) {
        oldParent = newParent;
        newParent = cdmSvc.getObject( _getParentUidForCompare( newParent ) );
    }
    return oldParent;
}

export let isInTreeView = function() {
    var viewModeInfo = appCtxSvc.ctx.ViewModeContext;
    if( viewModeInfo &&
        ( viewModeInfo.ViewModeContext === 'TreeView' || viewModeInfo.ViewModeContext === 'TreeSummaryView' ) ) {
        return true;
    }
    return false;
};

let _getSourceTargetAndContexts = function( compareList, depth ) {
    let srcElement = null;
    let tgtElement = null;

    let contextKeys = awCompareUtils.getContextKeys();
    if( exports.isInTreeView() ) {
        let source_c_uid = appCtxSvc.getCtx( contextKeys.leftCtxKey + '.currentState.c_uid' );
        let target_c_uid = appCtxSvc.getCtx( contextKeys.rightCtxKey + '.currentState.c_uid' );
        if( cdmSvc.isValidObjectUid( source_c_uid ) ) {
            srcElement = cdmSvc.getObject( source_c_uid );
        } else {
            srcElement = cdmSvc.getObject( compareList.sourceSelection.uid );
        }
        if( cdmSvc.isValidObjectUid( target_c_uid ) ) {
            tgtElement = cdmSvc.getObject( target_c_uid );
        } else {
            tgtElement = cdmSvc.getObject( compareList.targetSelection.uid );
        }
    } else {
        srcElement = compareList.cmpSelection1;
        tgtElement = compareList.cmpSelection2;
    }

    let srcPCI = appCtxSvc.getCtx( contextKeys.leftCtxKey + '.productContextInfo' );
    let tgtPCI = appCtxSvc.getCtx( contextKeys.rightCtxKey + '.productContextInfo' );

    if( depth <= 0 ) {
        srcElement = _getToplevelParent( srcElement );
        tgtElement = _getToplevelParent( tgtElement );
    }

    return {
        srcElement: srcElement,
        srcContext: srcPCI,
        tgtElement: tgtElement,
        tgtContext: tgtPCI
    };
};
var _processOptions = function( options ) {
    var outputCollection = [];
    for( var outputVal in options ) {
        if( options.hasOwnProperty( outputVal ) ) {
            outputCollection.push( outputVal );
        }
    }
    return outputCollection;
};

export let createSOAInputForVisibleUids = function( compareContext, depth, startFreshCompare, backgroundOption, sourceVMOs,
    targetVMOs ) {
    let sourceUIDs = [];
    _.forEach( sourceVMOs, function( value ) {
        sourceUIDs.push( value.uid );
    } );

    let targetUIDs = [];
    _.forEach( targetVMOs, function( value ) {
        targetUIDs.push( value.uid );
    } );

    let inputDataForCompare = _getSourceTargetAndContexts( compareContext.compareList, depth );

    // Populate the compare options filter
    let displayOptions = compareContext.displayOptions;
    // Match Types and Equivalence
    let soaCompareOptionsList = {};
    let matchTypes = _.get( displayOptions, 'MatchType' );
    soaCompareOptionsList.MatchType = _processOptions( matchTypes );
    let equivalenceTypes = _.get( displayOptions, 'Equivalence' );
    soaCompareOptionsList.Equivalence = _processOptions( equivalenceTypes );

    if( soaCompareOptionsList.MatchType.length === 0 && soaCompareOptionsList.Equivalence.length === 0 ) {
        soaCompareOptionsList = undefined;
    }

    return {
        inputData: {
            source: {
                element: inputDataForCompare.srcElement,
                productContextInfo: inputDataForCompare.srcContext,
                visibleUids: sourceUIDs,
                depth: depth
            },
            target: {
                element: inputDataForCompare.tgtElement,
                productContextInfo: inputDataForCompare.tgtContext,
                visibleUids: targetUIDs,
                depth: depth
            },
            startFreshCompare: startFreshCompare,
            compareInBackground: backgroundOption,
            compareOptions: soaCompareOptionsList
        }
    };
};

export let createSOAInputForPaginationAndVisibleUids = function( compareContext, depth, startFreshCompare, backgroundOption,
    sourceCursor, targetCursor, sourceVMOs, targetVMOs, datasetUID ) {
    let compareInput = exports.createSOAInputForVisibleUids( compareContext, depth, startFreshCompare, backgroundOption,
        sourceVMOs, targetVMOs );

    compareInput.inputData.sourceCursor = sourceCursor;
    compareInput.inputData.targetCursor = targetCursor;

    if( datasetUID ) {
        compareInput.inputData.notificationMessage = {
            uid: datasetUID
        };
    }

    return compareInput;
};

export default exports = {
    isInTreeView,
    createSOAInputForVisibleUids,
    createSOAInputForPaginationAndVisibleUids
};

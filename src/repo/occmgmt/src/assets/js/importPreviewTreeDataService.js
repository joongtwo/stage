//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 define
 */

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/importPreviewTreeDataService
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import uwPropertySvc from 'js/uwPropertyService';
import occmgmtGetOccsResponseService from 'js/occmgmtGetOccsResponseService';
import importCellRenderingService from 'js/importCellRenderingService';
import appCtxSvc from 'js/appCtxService';
import awTableSvc from 'js/awTableService';
import occmgmtUtils from 'js/occmgmtUtils';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import importPreviewTreeRespProcessingService from 'js/importPreviewTreeRespProcessingService';
import importPreviewSetActionOnLine from 'js/importPreviewSetActionOnLine';
import localeService from 'js/localeService';
import navigationSvc from 'js/navigationService';

var exports = {};

var _nodeToPropsArray = [];
/**
 * Internal column names sent by server in vmo's property map to assist client in
 * creating tree from flat list of nodes.
 */
let internalColumnNames = [ 'ParentInx', 'Index', 'Level', 'HasChildren' ];

const useExistingValueInternalName = 'importPreview_use_existing_value';

/**
 * Processes server response and populates column config and create nodes for splm tree widget
 * @param {*} dataProvider
 * @param {*} treeLoadInput
 * @param {*} declViewModel
 */
let processSOAResponse = function( dataProvider, treeLoadInput, declViewModel ) {
    return function( response ) {
        let createdNodes = [];
        //Update Columns
        importPreviewTreeRespProcessingService.populateTreeNodes( response.nodeInfos,
            _nodeToPropsArray, createdNodes );
        importPreviewTreeRespProcessingService.populateTreeColumns( response.columnConfig,
            dataProvider, internalColumnNames );

        // Third Paramter is for a simple vs ??? tree
        let treeLoadResult = awTableSvc.buildTreeLoadResult( treeLoadInput,
            createdNodes, true, true, response.cursor.endReached );

        if( declViewModel && declViewModel.dataProviders ) {
            let vmc = occmgmtUtils.getCurrentTreeDataProvider( declViewModel.dataProviders ).viewModelCollection;
            appCtxSvc.updatePartialCtx( 'aceActiveContext.context.vmc', vmc );
        }
        importPreviewTreeRespProcessingService.populateInCompleteTailInLoadedResult( treeLoadResult, response.cursor.endReached );
        dataProvider.topTreeNode.cursorObject = response.cursor;
        return {
            parentNode: treeLoadResult.parentNode,
            childNodes: treeLoadResult.childNodes,
            totalChildCount: treeLoadResult.totalChildCount,
            startChildNdx: 0,
            treeLoadResult: treeLoadResult
        };
    };
};

/**
 * Creates SOA input using treeLoadInput and importBOMContext
 * @param {*} treeLoadInput
 */
function getSoaInput( treeLoadInput, importBOMContext ) {
    let fmsTicket;
    let propInfos = [];
    let typeMapInfos = {};
    if( importBOMContext ) {
        populateSOAInputUsingImportBOMContext();
    }
    return {
        inputData: {
            transientFileWriteTicket: fmsTicket,
            propInfos: propInfos,
            typePropInfos: typeMapInfos,
            cursor: treeLoadInput.cursor
        }
    };

    function populateSOAInputUsingImportBOMContext() {
        fmsTicket = importBOMContext.fmsTicket;
        let localBundle = localeService.getLoadedText( 'OccmgmtImportExportConstants' );
        for( let index = 0; index < importBOMContext.viewModelPropertiesForHeader.length; index++ ) {
            let viewProp = importBOMContext.viewModelPropertiesForHeader[ index ];
            if( viewProp.dbValue && !_.isArray( viewProp.dbValue ) ) {
                let dbValue = viewProp.dbValue.split( '.' );
                let propertyName = viewProp.dbValue;
                let type = '';
                if( dbValue.length === 2 ) {
                    propertyName = dbValue[ 1 ];
                    type = dbValue[ 0 ];
                }
                let viewPropUIValue = viewProp.uiValue.replace( localBundle.required, '' );
                let prop = {
                    propHeader: viewProp.propertyName,
                    realPropName: propertyName,
                    realPropDisplayName: viewPropUIValue
                };
                let propInfosForTypes = [];
                if( typeMapInfos && typeMapInfos[ type ] ) {
                    propInfosForTypes = typeMapInfos[ type ];
                }
                propInfos.push( prop );
                propInfosForTypes.push( prop );
                typeMapInfos[ type ] = propInfosForTypes;
            }
        }
    }
}

/**
 * Call Soa and get the data from server
 **/
function getImportPreviewData( soaInput ) {
    return soaSvc.postUnchecked( 'Internal-XlsBom-2020-12-Import', 'getStructureInfoFromExcel',
        soaInput ).then( function( response ) {
        var deferred = AwPromiseService.instance.defer();
        if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
            occmgmtGetOccsResponseService.processPartialErrors( response );
            eventBus.publish( 'importBOM.previewTreeLoadFailure' );
        }
        deferred.resolve( response );
        return deferred.promise;
    }, function( error ) {
        throw soaSvc.createError( error );
    } );
}

/**
 * Create View Model Property
 *
 * @param columnNumber
 * @param columnInfo
 * @param vmNode
 */
let createViewModelProperty = function( columnInfo, vmNode ) {
    let localBundle = localeService.getLoadedText( 'OccmgmtImportExportConstants' );
    let columnName = columnInfo.name;
    let props = _nodeToPropsArray[ vmNode.id ];
    let dbValues = [ props[ columnName ] ];
    // If the dbValue is set to the internal name for "Use Existing Value" text, convert uiValue to localized string
    let uiValues = [ '' ];
    if( dbValues[ 0 ] === useExistingValueInternalName ) {
        uiValues = [ localBundle.aceImportPreviewUseExistingValue ];
    } else {
        uiValues = [ props[ columnName ] ];
    }
    let vmProp = uwPropertySvc.createViewModelProperty( columnName, columnInfo.displayName,
        columnInfo.typeName, dbValues, uiValues );
    vmProp.propertyDescriptor = {
        displayName: columnInfo.displayName
    };
    return vmProp;
};

/**
 * @param {*} columnInfos
 * @param {*} vmo
 */
function _populateColumns( columnInfos, vmo ) {
    _.forEach( columnInfos, function( columnInfo ) {
        columnInfo.cellRenderers = [];
        if( !columnInfo.isTreeNavigation && !_.isUndefined( _nodeToPropsArray[ vmo.id ] ) ) {
            vmo.props[ columnInfo.name ] = createViewModelProperty( columnInfo, vmo );
        }
        importCellRenderingService.setCellRendererTemplate( columnInfo );
    } );
    importPreviewSetActionOnLine.populateActionColumnForReusedAssembly( vmo );
}

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from. The object is usually
 *            the result of processing the 'inputData' property of a DeclAction based on data from the current
 *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
 *
 * <pre>
 * {
 * Extra 'debug' Properties
 *     dbg_isLoadAllEnabled: {Boolean}
 *     dbg_pageDelay: {Number}
 * }
 * </pre>
 *
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let loadTreeTableData = function( treeLoadInput, dataProvider, declViewModel, cursor ) {
    /**
     * Check the validity of the parameters
     */
    let deferred = AwPromiseService.instance.defer();
    let failureReason = awTableSvc.validateTreeLoadInput( treeLoadInput );
    if( failureReason ) {
        deferred.reject( failureReason );
        return deferred.promise;
    }
    treeLoadInput.displayMode = 'Tree';
    treeLoadInput.cursor = cursor;
    if( dataProvider.topTreeNode && dataProvider.topTreeNode.cursorObject ) {
        treeLoadInput.cursor = dataProvider.topTreeNode.cursorObject;
    }
    let importBOMContext = appCtxSvc.getCtx( 'ImportBOMContext' );
    if( importBOMContext ) {
        let soaInput = getSoaInput( treeLoadInput, importBOMContext );
        return getImportPreviewData( soaInput ).then(
            processSOAResponse( dataProvider, treeLoadInput, declViewModel ) );
    }

    // If SOA input is not available it means location is not built correctly, Navigating it to Home.
    let action = { actionType: 'Navigate' };
    action.navigateTo = 'showHome';
    navigationSvc.navigate( action, {} );
};

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {PropertyLoadRequestArray} propertyLoadRequests - An array of PropertyLoadRequest objects this action
 *            function is invoked from. The object is usually the result of processing the 'inputData' property
 *            of a DeclAction based on data from the current DeclViewModel on the $scope) . The 'pageSize'
 *            properties on this object is used (if defined).
 * @returns {Promise} promise
 *
 */
export let loadTreeTableProperties = function() { // eslint-disable-line no-unused-vars
    /**
     * Extract action parameters from the arguments to this function.
     */
    let propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );
    if( propertyLoadInput ) {
        let allChildNodes = [];
        _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
            _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
                if( !childNode.props ) {
                    childNode.props = {};
                }
                _populateColumns( propertyLoadRequest.columnInfos, childNode );
                allChildNodes.push( childNode );
            } );
        } );
        let deferred = AwPromiseService.instance.defer();
        let propertyLoadResult = awTableSvc.createPropertyLoadResult( allChildNodes );
        let resolutionObj = {
            propertyLoadResult: propertyLoadResult
        };
        deferred.resolve( resolutionObj );
        return deferred.promise;
    }
    return AwPromiseService.instance.reject( 'Missing PropertyLoadInput parameter' );
};

/**
 * importPreviewTreeDataService factory
 */
export default exports = {
    loadTreeTableData,
    loadTreeTableProperties
};

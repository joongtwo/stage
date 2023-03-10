// Copyright (c) 2022 Siemens

/**
 * @module js/pca0VariabilityExplorerService
 */
import appCtxSvc from 'js/appCtxService';
import awIconService from 'js/awIconService';
import awColumnSvc from 'js/awColumnService';
import AwPromiseService from 'js/awPromiseService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0Constants from 'js/Pca0Constants';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import treeTableDataService from 'js/treeTableDataService';
import tableSvc from 'js/published/splmTablePublishedService';
import _ from 'lodash';

import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';

/**
 * Function to update tree table columns props and icon urls
 * @param {Object} propColumns Contains prop columns
 * @param {Object} childNodes Contains tree nodes
 */
function _updateColumnPropsAndNodeIconURLs( propColumns, childNodes ) {
    _.forEach( propColumns, function( col ) {
        if( !col.typeName && col.associatedTypeName ) {
            col.typeName = col.associatedTypeName;
            if( col.propertyName === 'object_type' ) {
                col.renderingHint = 'PcaObjectTypeLOVComponent';
            } else if( col.propertyName === 'object_name' || col.propertyName === 'cfg0ObjectId' ) {
                col.renderingHint = 'PcaAllocationLOVComponent';
            }
        }
    } );
    if( propColumns && propColumns.length > 0 ) {
        propColumns[ 0 ].enableColumnMoving = false;
        let firstColumnPropertyName = propColumns[ 0 ].propertyName;

        _.forEach( childNodes, function( childNode ) {
            childNode.iconURL = awIconService.getTypeIconFileUrl( childNode );
            treeTableDataService.updateVMODisplayName( childNode, firstColumnPropertyName );
        } );
    }
}


/**
 * Callback function to update column properties
 * @param {object} columnsToDisableSort List of columns that do not support sorting
 * @param {object} columnsToDisableFilter List of columns that do not support filtering
 * @return {Object} A Object consisting of callback function.
 */
function _getDataForUpdateColumnPropsAndNodeIconURLs( columnsToDisableSort, columnsToDisableFilter ) {
    var updateColumnPropsCallback = {};

    updateColumnPropsCallback.callUpdateColumnPropsAndNodeIconURLsFunction = function( propColumns, allChildNodes, contextKey, response ) {
        _updateColumnPropsAndNodeIconURLs( propColumns, allChildNodes );
        let columnConfig = response.output.columnConfig;
        columnConfig.columns = pca0ConfiguratorExplorerCommonUtils.disableColumnSortingAndFiltering( columnConfig.columns, columnsToDisableSort, columnsToDisableFilter );
        return columnConfig;
    };

    return updateColumnPropsCallback;
}

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 * <pre>
 * {
 *     columnInfos : {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 * }
 * </pre>
 */
export let loadTreeColumns = function() {
    var deferred = AwPromiseService.instance.defer();

    var awColumnInfos = [ {
        name: 'object_string',
        displayName: '...',
        typeName: 'WorkspaceObject',
        width: 300,
        isTreeNavigation: true,
        enableColumnMoving: false,
        enableColumnResizing: false
    } ];

    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos
        }
    } );

    return deferred.promise;
};

/**
 * Get a page of row column data for a tree-table.
 *
 * Note: This method assumes there is a single argument object being passed to it and that this object has the
 * following property(ies) defined in it.
 * <P>
 * {PropertyLoadInput} propertyLoadInput - (found within the 'arguments' property passed to this function) The
 * PropertyLoadInput contains an array of PropertyLoadRequest objects this action function is invoked to
 * resolve.
 *
 * @return {Promise} A Promise resolved with a 'PropertyLoadResult' object containing the details of the result.
 */
export let loadTreeProperties = function() {
    let data = arguments[ 0 ].declViewModel;
    arguments[ 0 ].updateColumnPropsCallback = _getDataForUpdateColumnPropsAndNodeIconURLs( data.columnsToDisableSort, data.columnsToDisableFilter );
    return AwPromiseService.instance.resolve( treeTableDataService.loadTreeTableProperties( arguments[ 0 ] ) );
};

/**
 * Updates the tree columns based on the client scope URI.
 * @param {Object} vmNodes - The tree table nodes collection
 * @param {Object} declViewModel - view model
 * @param {Object} uwDataProvider - tree data provider
 * @param {Object} context - the viewModel context
 * @param {Object} contextKey - the context key
 *
 * @returns {Promise} Promise containing tree table properties
 */
export let loadTreeTablePropertiesOnInitialLoad = function( vmNodes, declViewModel, uwDataProvider, context, contextKey ) {
    /*
        Note:- The variability explorer view shows configurator context as top node of tree but VCA and VCV
        views do not show configurator context as top node of tree, as we are using common tree rendering
        framework we use "variabilityTreeData" as common dummy node as top node. As it is not having valid uid,
        to filter out it from input to getTableViewModelProperties SOA we are populating its props as empty array.
        It is stopgap solution as we dont have direct hook to control getTableViewModelProperties SOA input.
    */
    uwDataProvider.topTreeNode.props = {};

    var updateColumnPropsCallback = _getDataForUpdateColumnPropsAndNodeIconURLs( declViewModel.columnsToDisableSort, declViewModel.columnsToDisableFilter );
    return AwPromiseService.instance.resolve( treeTableDataService.loadTreeTablePropertiesOnInitialLoad( vmNodes, declViewModel, uwDataProvider, context, contextKey, updateColumnPropsCallback ) );
};

/**
 * Returns configurator context if perspective is empty.
 * @param {Object} data - the viewModel data
 * @returns {Object} - Returns the configurator context
 */
export let populateConfigContext = function( data ) {
    return pca0ConfiguratorExplorerCommonUtils.populateConfigContext( data );
};

/**
 * Returns the request type to be set for fetching variability
 * Empty request type will be returned if parentNodeUid is being set for variability request
 * @param {Object} data - the viewModel data
 * @param {Object} ctx - the ctx
 * @returns {Object} requestTypes - Request type for fetching variability
 */
export let populateRequestType = function( data ) {
    let requestType = '';
    let clientScopeURI = '';
    let xrtID = appCtxSvc.getCtx( 'state.params.pageId' );
    if( xrtID === 'tc_xrt_Models' ) {
        clientScopeURI = veConstants.CLIENT_SCOPE_URI.PRODUCTS;
        requestType = 'Model';
    } else if( xrtID === 'tc_xrt_Features' ) {
        clientScopeURI = veConstants.CLIENT_SCOPE_URI.FEATURES;
        requestType = 'Group';
    }else if( xrtID === 'tc_xrt_Constraints' ) {
        clientScopeURI = veConstants.CLIENT_SCOPE_URI.VARIABILITY;
        requestType = _.get( data, 'subPanelContext.tabKey' ) === 'tc_xrt_Models' ? 'Model' : 'Group';
    }

    // Column configuration/arrange column use cases needs clientScopeURI populated with global ctx object.
    appCtxSvc.updatePartialCtx( 'sublocation.clientScopeURI', clientScopeURI );

    // Check if parentNodeUid is not being set first, otherwise return empty request type
    let requestTypes = [];
    if( populateParentNode( data ).length === 0 ) {
        requestTypes.push( requestType );
    }

    return requestTypes;
};

/**
 * Returns the uid of node being expanded.
 * Empty array will be returned if node being expanded is top node.
 * @param {Object} data - the viewModel data
 * @returns {Object} - Returns the parent node uid
 */
export let populateParentNode = function( data ) {
    let parentNodeUids = [];
    let parentNodeUid = _.get( data, 'treeLoadInput.parentNode.id' );
    if( parentNodeUid !== pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ) {
        parentNodeUids.push( parentNodeUid );
    }
    //else return empty array
    return parentNodeUids;
};

//Set the config perspective policy before SOA call
export let getConfigPerspectivePolicy = function() {
    return pca0CommonConstants.CFG0CONFIGURATORPERSPECTIVE_POLICY.types;
};

/**
 * This function will call getAllocationObjects function in pca0ConfiguratorExplorerCommonUtils
 * @param {Object} soaResponse response from SOA
 * @param {Object} allocationObjects - the allocation object from data
 * @returns {Object} - Returns the updated allocation object
 */
export let getAllocationObjectsFromVariabilityExplorer = function( soaResponse, allocationObjects ) {
    return pca0ConfiguratorExplorerCommonUtils.getAllocationObjects( soaResponse, allocationObjects );
};

export default exports = {
    loadTreeColumns,
    loadTreeProperties,
    populateRequestType,
    loadTreeTablePropertiesOnInitialLoad,
    getConfigPerspectivePolicy,
    populateParentNode,
    populateConfigContext,
    getAllocationObjectsFromVariabilityExplorer
};

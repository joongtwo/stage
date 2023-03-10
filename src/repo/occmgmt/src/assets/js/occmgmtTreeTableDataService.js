/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * @module js/occmgmtTreeTableDataService
 */
import AwPromiseService from 'js/awPromiseService';
import awTableSvc from 'js/awTableService';
import awStateService from 'js/awStateService';
import awColumnSvc from 'js/awColumnService';
import cdmSvc from 'soa/kernel/clientDataModel';
import dataManagementSvc from 'soa/dataManagementService';
import occmgmtGetSvc from 'js/occmgmtGetService';
import occmgmtUtils from 'js/occmgmtUtils';
import appCtxSvc from 'js/appCtxService';
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import structureFilterService from 'js/structureFilterService';
import occmgmtTreeTableStateService from 'js/occmgmtTreeTableStateService';
import contextStateMgmtService from 'js/contextStateMgmtService';
import occmgmtTreeTableBufferService from 'js/occmgmtTreeTableBufferService';
import occmgmtVisibilityService from 'js/occmgmtVisibility.service';
import occmgmtIconSvc from 'js/occmgmtIconService';
import occmgmtTreeLoadResultBuilder from 'js/occmgmtTreeLoadResultBuilder';
import occmgmtCellRenderingService from 'js/occmgmtCellRenderingService';
import awTableStateService from 'js/awTableStateService';
import treeTableDataService from 'js/treeTableDataService';
import localStrg from 'js/localStorage';
import assert from 'assert';
import _ from 'lodash';
import logger from 'js/logger';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import preferenceSvc from 'soa/preferenceService';
import acePartialSelectionService from 'js/acePartialSelectionService';
import expandRequests from 'js/invoker/expandRequests';
import requestQueue from 'js/invoker/requestQueue';

var _firstColumnConfigColumnPropertyName = null;

/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};

/**
 * {Boolean} TRUE if certain properties and/or events should be logged during occurrence loading.
 */
var _debug_logOccLoadActivity = false;

/**
 * Map from pci uid to "stableId" of nodes that are in expanded state
 */
var _pciToExpandedNodesStableIdsMap = {};

var _expandedNodes = {};

var updateExpansionState = function( treeLoadResult, declViewModel, contextState ) {
    if( appCtxSvc.ctx[ contextState.key ].resetTreeExpansionState || !_.isUndefined( treeLoadResult.retainTreeExpansionStatesForOpen ) &&
        treeLoadResult.retainTreeExpansionStatesForOpen === false ) {
        awTableStateService.clearAllStates( declViewModel, _.keys( declViewModel.grids )[ 0 ] );
        appCtxSvc.unRegisterCtx( contextState.key + '.resetTreeExpansionState' );
        _pciToExpandedNodesStableIdsMap[ contextState.key ] = {};
    }

    _expandedNodes[ contextState.key ] = _expandedNodes[ contextState.key ] || _.cloneDeep( _expandedNodes.nodes ) || [];
    if( _expandedNodes[ contextState.key ] && _expandedNodes[ contextState.key ].length > 0 ) {
        _expandedNodes[ contextState.key ].map( function( uid ) {
            var gridId = Object.keys( declViewModel.grids )[ 0 ];
            awTableStateService.saveRowExpanded( declViewModel, gridId, uid );
        } );
        treeLoadResult.retainTreeExpansionStates = true;
        _expandedNodes[ contextState.key ] = [];
    }
};

function _getSelectedObjectIndex( uwDataProvider, contextState ) {
    var _selectedObjectIndex = -1;
    var _selectedObjects = contextState.context.selectedModelObjects;

    if( _selectedObjects.length > 0 ) {
        var _selectedObject = _selectedObjects[ _selectedObjects.length - 1 ];

        if( !_.isUndefined( uwDataProvider.topNodeUid ) && _.isEqual( _selectedObject.uid, uwDataProvider.topNodeUid ) ) {
            _selectedObjectIndex = 0;
        } else {
            _selectedObjectIndex = uwDataProvider.getViewModelCollection().findViewModelObjectById( _selectedObject.uid );
        }
    }
    return _selectedObjectIndex;
}

function _getPageInfo( treeNodes, isFocusOccurrenceConfigured, uwDataProvider, contextState ) {
    var _defaultPageSize = 20;

    // set the default values to scroll position.
    var _scrollPosition = {
        firstIndex: 0,
        lastIndex: _defaultPageSize
    };

    // If the tree node is selected, then the focused page after tree re-load is selected nodes page.
    // So, we are calculating the index of selected tree node in flat tree structure.
    // If the selected object index is not present with currently loaded page, then we need to load the tree nodes
    // of page around selected object.
    var _selectedObjectIndex = -1;
    if( isFocusOccurrenceConfigured ) {
        _selectedObjectIndex = _getSelectedObjectIndex( uwDataProvider, contextState );
    }

    // identify first and last index of currently loaded page using scroll position information
    var _firstIndex = uwDataProvider.scrollPosition.firstIndex;
    var _lastIndex = uwDataProvider.scrollPosition.lastIndex;
    var _loadedPageSize = _lastIndex - _firstIndex;
    var _pageSize = _defaultPageSize < _loadedPageSize ? _loadedPageSize : _defaultPageSize;

    // if tree node is selected and selected tree node is not present within currently loaded page,
    // then loaded tree will scroll the page to selected tree node.
    // Hence, calculate the page around selected occurrence.
    if( !_.isEqual( _selectedObjectIndex, -1 ) && ( _selectedObjectIndex > _lastIndex || _selectedObjectIndex < _firstIndex ) ) {
        var _pageSizeUp = Math.floor( _pageSize / 2 );
        // if selected object index is less than _pageSizeUp, then choose first index as zero
        // calculate last index based on first index and total page size.
        _firstIndex = _selectedObjectIndex - _pageSizeUp > 0 ? _selectedObjectIndex - _pageSizeUp : 0;
        _lastIndex = _firstIndex + _pageSize;
    }

    // If We are at first page and extra nodes are added in page ( e.g. unpack-all action performed )
    // And if we rely on first scrolled page info, then the additional nodes loading will get delayed with new SOA call.
    // This will cause jitter. i.e. first page may be half full, so we can not rely on scrolled page info when first index is 0.
    // So, we will go with default settings

    // Else we will use the loaded page information to calculate scroll position.
    if( _firstIndex !== 0 || _defaultPageSize < _loadedPageSize ) {
        //  adjust first and last index of page
        if( treeNodes.length < _lastIndex ) {
            // if our scroll is at position where newly loaded page can not reach.
            // so my page will be last elements of size equal to _pageSize.
            _firstIndex = treeNodes.length - _pageSize;
            _lastIndex = treeNodes.length;
        }

        // we are adding some pre and post nodes to avoid edge-conditions and avoiding extra SOA call.
        var _extraNodesToLoad = 3;
        _scrollPosition.firstIndex = _firstIndex - _extraNodesToLoad;
        _scrollPosition.lastIndex = _lastIndex + _extraNodesToLoad;
    }

    return _scrollPosition;
}

function _getScrolledPageNodes( treeNodes, treeLoadResult, isFocusOccurrenceConfigured, uwDataProvider, contextState ) {
    // get the start and end index of scrolled page
    var _scrollPosition = _getPageInfo( treeNodes, isFocusOccurrenceConfigured, uwDataProvider, contextState );

    // get nodes for which we want to load properties
    var allVMNodes = [];
    var nodesForPropertyLoadPage = [];
    if( !_.isUndefined( treeLoadResult.rootPathNodes ) ) {
        for( var inx = 0; inx < treeLoadResult.rootPathNodes.length; inx++ ) {
            allVMNodes.push( treeLoadResult.rootPathNodes[ inx ] );
            nodesForPropertyLoadPage.push( treeLoadResult.rootPathNodes[ inx ] );
        }
    }
    if( !_.isUndefined( treeLoadResult.newTopNode ) ) {
        allVMNodes.push( treeLoadResult.newTopNode );
        nodesForPropertyLoadPage.push( treeLoadResult.newTopNode );
    }

    // load tree nodes based on scroll position information.
    for( var index = _scrollPosition.firstIndex; index <= _scrollPosition.lastIndex; index++ ) {
        if( !_.isUndefined( treeNodes[ index ] ) ) {
            nodesForPropertyLoadPage.push( treeNodes[ index ] );
        }
    }
    allVMNodes.push.apply( allVMNodes, treeNodes );

    // add extra buffer to nodesForPropertyPageLoad based on settings
    var input = { vmNodes: nodesForPropertyLoadPage };
    occmgmtTreeTableBufferService.addExtraBufferToPage( input, uwDataProvider, allVMNodes );

    return input.vmNodes;
}

function _sortTreeNodesBasedOnParentChildHierarchy( treeNodes ) {
    // move all the children of parent node to immediate next in same order
    for( var inx = 0; inx < treeNodes.length; inx++ ) {
        var parentNode = treeNodes[ inx ];

        // identify children of parentNode from treeNodes
        var childNodesIndex = [];
        for( var jnx = 0; jnx < treeNodes.length; jnx++ ) {
            if( treeNodes[ jnx ].parentUid === parentNode.uid ) {
                childNodesIndex.push( jnx );
            }
        }

        // move them next to parentNode in same order
        for( var jnx = 0; jnx < childNodesIndex.length; jnx++ ) {
            if( childNodesIndex[ jnx ] !== inx + jnx + 1 ) {
                var childNode = treeNodes[ childNodesIndex[ jnx ] ];
                treeNodes.splice( childNodesIndex[ jnx ], 1 );
                treeNodes.splice( inx + jnx + 1, 0, childNode );
            }
        }
    }
}

// Loads tree node page with properties
// 1. Identify all the tree nodes
// 2. sort the tree nodes in flat tree structure
// 3. get the loaded page nodes
// 4. load tree properties for loaded page nodes.
function loadTreeNodePageWithProperties( newlyLoadedNodes, treeLoadResult, isFocusOccurrenceConfigured, uwDataProvider, declViewModel, contextState, subPanelContext ) {
    // identify tree nodes that will be rendered on tree.
    var treeNodes = !_.isUndefined( newlyLoadedNodes ) ? newlyLoadedNodes : treeLoadResult.childNodes;

    // sort the newly added nodes in the order they are going to render in tree.
    _sortTreeNodesBasedOnParentChildHierarchy( treeNodes );

    //TODO : contextState is used for selectedModelObjects. Should be taken from occContext now ( cleanup candidate)

    // get scrolled page nodes
    var nodesForPropertyLoadPage = _getScrolledPageNodes( treeNodes, treeLoadResult, isFocusOccurrenceConfigured, uwDataProvider, contextState );
    if( _.isEmpty( nodesForPropertyLoadPage ) ) {
        return {
            treeLoadResult: treeLoadResult
        };
    }

    // load properties for page of tree nodes.
    var contextKey = contextState.key;
    var columnInfos = [];
    _.forEach( uwDataProvider.cols, function( columnInfo ) {
        if( !columnInfo.isTreeNavigation ) {
            columnInfos.push( columnInfo );
        }
    } );

    var propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI: uwDataProvider.objectSetUri ? uwDataProvider.objectSetUri : subPanelContext.provider.clientScopeURI,
        typesForArrange: uwDataProvider.columnConfig.typesForArrange
    };

    var propertyLoadRequest = {
        parentNode: null,
        childNodes: nodesForPropertyLoadPage,
        columnInfos: columnInfos
    };
    var propertyLoadInput = awTableSvc.createPropertyLoadInput( [ propertyLoadRequest ] );

    return exports.loadTreeTableProperties( {
        propertyLoadInput: propertyLoadInput,
        contextKey: contextKey,
        declViewModel: declViewModel,
        uwDataProvider: uwDataProvider,
        propertyLoadContext: propertyLoadContext,
        skipExtraBuffer: true,
        subPanelContext: {
            occContext: contextState.occContext
        }
    } ).then(
        function( response ) {
            treeLoadResult.columnConfig = response.propertyLoadResult.columnConfig;
            return {
                treeLoadResult: treeLoadResult
            };
        } );
}

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {Object} soaInput - Parameters to be sent to the 'pocc6' SOA call.
 * @param {*} uwDataProvider - Data Provider
 * @param {*} declViewModel - Decl ViewModel
 * @param {*} contextState - Context State
 * @return {Promise} A Promise resolved with a resulting TreeLoadResult object.
 */
function _loadTreeTableNodes( treeLoadInput, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext ) {
    var parentNode = treeLoadInput.parentNode;
    var sytemLocatorParams = appCtxSvc.getCtx( 'systemLocator' );
    if( sytemLocatorParams && sytemLocatorParams.isFocusedLoad !== undefined ) {
        treeLoadInput.isFocusedLoad = sytemLocatorParams.isFocusedLoad;
    }

    /**
     * If 'parent' has no 'child' nodes yet, there is no cursor that should be needed, or used.
     */
    if( _.isEmpty( parentNode.children ) ) {
        parentNode.cursorObject = null;
    }

    /**
     * If input has a known 'pci_uid', locate the IModelObject and set it in the inputData.
     *
     */
    if( treeLoadInput.pci_uid ) {
        soaInput.inputData.config.productContext = occmgmtUtils.getObject( treeLoadInput.pci_uid );
    }

    treeLoadInput.displayMode = 'Tree';
    treeLoadInput.subPanelContext = subPanelContext;

    /**
     * If a node other than the active product is being expanded then we must fetch and use filter parameters
     * from the cache
     */
    if( treeLoadInput.pci_uid && treeLoadInput.pci_uid !== contextState.occContext.currentState.pci_uid ) {
        treeLoadInput.filterString = updateFilterParamsOnInputForCurrentPciUid( treeLoadInput.pci_uid,
            contextState );
    }

    /**
     * Record if request is about jitter free tree load
     */
    if( !_.isUndefined( contextState.context.transientRequestPref.jitterFreePropLoad ) &&
        _.isEqual( contextState.context.transientRequestPref.jitterFreePropLoad, true ) ) {
        treeLoadInput.jitterFreePropLoad = true;
    }

    // get the hierarchy of focus object
    // if we get delta tree response, then we have to decide focus occurrence based on
    // this hierarchy of focus objects.
    var focusObjectHierarchy = [];
    var selectedObjects = contextState.occContext.selectedModelObjects;
    if( !_.isUndefined( selectedObjects ) && !_.isEmpty( selectedObjects ) ) {
        var focusObject = selectedObjects[ selectedObjects.length - 1 ];
        while( !_.isUndefined( focusObject ) && focusObject !== null ) {
            focusObjectHierarchy.push( focusObject );
            var parentFocusObject;
            if( focusObject.props && focusObject.props.awb0Parent ) {
                var parentFocusId = focusObject.props.awb0Parent.dbValues[ 0 ];
                parentFocusObject = cdmSvc.getObject( parentFocusId );
            }
            focusObject = parentFocusObject;
        }
    }
    treeLoadInput.focusObjectHierarchy = focusObjectHierarchy;

    let transientRequestPref = contextState.occContext.transientRequestPref;

    if (  transientRequestPref && transientRequestPref.getOccResponse ) {
        return _getTreeLoadResultBuiltFromGetOccResponse( treeLoadInput, soaInput, contextState, declViewModel, uwDataProvider, transientRequestPref.getOccResponse );
    }


    //TODO: To be passed in to getOccurrences() when CFX changes go in
    //let occContextValue = subPanelContext.occContext.getValue();
    return occmgmtGetSvc.getOccurrences( treeLoadInput, soaInput, contextState ).then(
        function( response ) {
            return _getTreeLoadResultBuiltFromGetOccResponse( treeLoadInput, soaInput, contextState, declViewModel, uwDataProvider, response );
        } );
} // _loadTreeTableNodes

let _getTreeLoadResultBuiltFromGetOccResponse = function( treeLoadInput, soaInput, contextState, declViewModel, uwDataProvider, response ) {
    if( !declViewModel.isDestroyed() ) {
        const pciBeforeConfigurationChange = contextState.occContext.currentState.pci_uid;
        const occContext = contextState.occContext;
        const subPanelContext = treeLoadInput.subPanelContext;
        let isConfigurationChangeRequest = !_.isEmpty( occContext.configContext ) || !_.isEmpty( contextState.context.configContext );
        let treeLoadResult = occmgmtTreeLoadResultBuilder.processGetOccurrencesResponse( treeLoadInput, response, contextState, declViewModel, uwDataProvider, soaInput );
        var localDataProvider = declViewModel.dataProviders[ declViewModel._internal.grids[ Object.keys( declViewModel._internal.grids )[ 0 ] ].dataProvider ];

        if( localDataProvider && treeLoadResult && treeLoadResult.newTopNode && localDataProvider.topTreeNode !== treeLoadResult.newTopNode.uid ) {
            localDataProvider.topNodeUid = treeLoadResult.newTopNode.uid;
            localDataProvider.topTreeNode = treeLoadResult.newTopNode;
        }

        updateExpansionState( treeLoadResult, declViewModel, contextState );
        /**
         * Expansion state updated through above method make updates on dataProvider
         * and actual update in local storage is made after debounce of 2000ms
         * Because of that while tree is loading it reads data from dataProvider and it doesnt get updated data if we dont update dataProvider through disptach
         * We need to update dataProvider properly that is with disptach.
         */
        treeLoadResult.ttstate = localDataProvider.ttState;
        _pciToExpandedNodesStableIdsMap[ contextState.key ] = _pciToExpandedNodesStableIdsMap[ contextState.key ] || {};

        /**
         * Currently expansion state is maintained in local storage and is based on "id" property of the
         * nodes which is nothing but "uid" property of an element. When configuration changes, for ACE,
         * "uid" of objects change and hence expansion state is lost. It is important from user
         * perspective that we maintain expansion state. In order to achieve that what we do is use
         * "stableId" (commonly referred to as clone stable id chain) property of expanded nodes to
         * identify those on reload. This property remains same across configuration changes. Adding a
         * mapping between product context and "stableId" further solidifies the proper identification
         * of an element. Hence we build a map from "pci" to all "csid" that were expanded.
         */
        if( _.isEqual( treeLoadInput.retainTreeExpansionStates, true ) ) {
            occmgmtTreeTableStateService.setupCacheToRestoreExpansionStateOnConfigChange(
                uwDataProvider, declViewModel, pciBeforeConfigurationChange,
                contextState, _pciToExpandedNodesStableIdsMap[ contextState.key ] );
            treeLoadResult.retainTreeExpansionStates = true;
        }

        var newlyLoadedNodes = treeLoadResult.childNodes;
        // If we have received multiple parent-child info consider those nodes too for maintaining expansion state.
        if( treeLoadResult.vmNodesInTreeHierarchyLevels ) {
            newlyLoadedNodes = [];

            _.forEach( treeLoadResult.vmNodesInTreeHierarchyLevels, function(
                vmNodesInTreeHierarchyLevel ) {
                newlyLoadedNodes = newlyLoadedNodes.concat( vmNodesInTreeHierarchyLevel );
            } );
        }

        /**
         * Restore expansion state of nodes that were identified as expanded when the request was made.
         * It cannot be restricted to the call which made configuration change as not all expanded nodes
         * are returned in a single load action. Hence we must try to identify nodes that need to be
         * expanded from those that are returned after every call.
         */
        if( uwDataProvider && _pciToExpandedNodesStableIdsMap[ contextState.key ] &&
            Object.keys( _pciToExpandedNodesStableIdsMap[ contextState.key ] ).length > 0 ) {
            var pciAfterConfigurationChange = contextState.occContext.currentState.pci_uid;

            occmgmtTreeTableStateService.updateLocalStorageWithExpandedNodesOnConfigChange(
                newlyLoadedNodes, declViewModel, pciAfterConfigurationChange,
                _pciToExpandedNodesStableIdsMap[ contextState.key ] );

            if( response.elementToPCIMap ) {
                occmgmtTreeTableStateService.updateLocalStorageForProductNodesOfSWCOnConfigChange(
                    declViewModel, uwDataProvider.viewModelCollection.getLoadedViewModelObjects(),
                    pciBeforeConfigurationChange, newlyLoadedNodes, pciAfterConfigurationChange );
            }
        }

        if( treeLoadInput.grid ) {
            treeLoadResult.enableSorting = occmgmtUtils.isSortingSupported( contextState );
            treeLoadResult.grid = treeLoadInput.grid;
            if( treeLoadResult.grid.gridOptions ) {
                treeLoadResult.grid.gridOptions.enableExpansionStateCaching = !aceRestoreBWCStateService.isRestoreOptionApplicable( treeLoadResult, contextState.occContext.currentState.uid,
                    subPanelContext );
            }
            //adding expanded nodes to local storage is turned off if expb_all is set...its exceeding local storage quota
            if( contextState.occContext.currentState.expb_all ) {
                treeLoadResult.grid.gridOptions.enableExpansionStateCaching = false;
            }
        }
        treeLoadResult.columnConfig = uwDataProvider.columnConfig;
        if( !_.isUndefined( uwDataProvider.scrollPosition ) && // scroll position is recorded
            ( _.isEqual( isConfigurationChangeRequest, true ) // configuration has changed
                ||
                _.isEqual( treeLoadInput.isResetRequest, true ) // configurration is resetted
                ||
                _.isEqual( treeLoadInput.isFilterChangeRequest, true ) ) ) { // filters are changed
            var isFocusOccurrenceConfigured = !_.isEmpty( response.focusChildOccurrence.occurrenceId );
            return loadTreeNodePageWithProperties( newlyLoadedNodes, treeLoadResult, isFocusOccurrenceConfigured, uwDataProvider, declViewModel, contextState, subPanelContext );
        }
        return {
            treeLoadResult: treeLoadResult
        };
    }
};

/**
 *
 * @param {TreeLoadInput} treeLoadInput TreeLoadInput
 * @param {*} soaInput soa input
 */
function _populateParentElementAndFocusElementInSoaInput( treeLoadInput, soaInput ) {
    /**
     * Since we are 'selecting' the 'opened' node. We want to make sure the 'opened' node is
     * expanded.
     */
    treeLoadInput.expandParent = true;
    var loadIDs = treeLoadInput.loadIDs;

    if( treeLoadInput.openOrUrlRefreshCase ) {
        //All uids i.e. top occurrence, opened occurrence and selected occurrence are same
        if( _.isEqual( loadIDs.t_uid, loadIDs.o_uid ) && _.isEqual( loadIDs.o_uid, loadIDs.c_uid ) ) {
            treeLoadInput.parentElement = loadIDs.t_uid;
        }
    }

    /**
     * Check if the 'parent' has already been loaded
     */
    var oUidObject = cdmSvc.getObject( loadIDs.o_uid );
    var grandParentUid = occmgmtUtils.getParentUid( oUidObject );

    if( grandParentUid ) {
        treeLoadInput.parentElement = grandParentUid;
        populateFocusElementInSoaInputIfApplicable( treeLoadInput, soaInput, oUidObject );
    }
}

/**
 *
 * @param {TreeLoadInput} treeLoadInput TreeLoadInput
 * @param {*} loadIDs IDs to be loaded
 */
function _populateSOAInputParamsAndLoadTreeTableNodes( treeLoadInput, loadIDs, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext ) {
    var oUidObject = cdmSvc.getObject( loadIDs.o_uid );
    var grandParentUid = occmgmtUtils.getParentUid( oUidObject );

    if( cdmSvc.isValidObjectUid( grandParentUid ) ) {
        treeLoadInput.parentElement = grandParentUid;
        populateFocusElementInSoaInputIfApplicable( treeLoadInput, soaInput, oUidObject );
    } else {
        treeLoadInput.parentElement = loadIDs.o_uid;
    }

    return _loadTreeTableNodes( treeLoadInput, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext );
}

/**
 *
 * @param {TreeLoadInput} treeLoadInput TreeLoadInput
 * @param {*} contextState Context State
 * @param {*} loadIDs IDs to be loaded
 * @param {*} newSortCriteria sortCriteria passed in argument input
 */
function _populateTreeLoadInputParamsForProvidedInput( treeLoadInput, contextState, loadIDs, newSortCriteria, soaInput, reuseVMNodes ) {
    let occContext = contextState.occContext;
    if( treeLoadInput.parentNode.levelNdx === -1 ) {
        treeLoadInput.isTopNode = true;
        treeLoadInput.loadIDs = _getTreeNodeIdsToBeLoaded( loadIDs, contextState );
        treeLoadInput.topUid = treeLoadInput.loadIDs.t_uid ? treeLoadInput.loadIDs.t_uid : treeLoadInput.loadIDs.o_uid;
        treeLoadInput.parentElement = cdmSvc.NULL_UID;
    }

    //TODO : Check why previousState is from ctx and currentState from atomic data
    if( _.isEmpty( contextState.context.previousState ) ) {
        treeLoadInput.openOrUrlRefreshCase = 'open';
        if( !_.isEmpty( occContext.currentState.pci_uid ) ) {
            if( _.isUndefined( appCtxSvc.ctx.aceSessionInitalized ) ) {
                treeLoadInput.openOrUrlRefreshCase = 'urlRefresh';
                let value = {
                    userGesture: 'REFRESH',
                    jitterFreePropLoad: true
                };
                occmgmtUtils.updateValueOnCtxOrState( 'transientRequestPref', value, occContext );
            } else {
                treeLoadInput.openOrUrlRefreshCase = 'backButton';
            }
        }
        appCtxSvc.ctx.aceSessionInitalized = true;

        treeLoadInput.isProductInteracted = aceRestoreBWCStateService.isProductInteracted( occContext.currentState.uid );
        if( !_.isEqual( treeLoadInput.openOrUrlRefreshCase, 'urlRefresh' ) && !treeLoadInput.isProductInteracted ) {
            contextState.context.transientRequestPref.savedSessionMode = [ 'ignore' ];
        }
    }

    _populateRetainExpansionStatesParameterForProvidedInput( treeLoadInput, occContext );
    _populateSortCriteriaParameterForProvidedInput( treeLoadInput, contextState, newSortCriteria, soaInput );
    if( contextState.context.openedElement && contextState.context.openedElement.modelType.typeHierarchyArray.indexOf( 'Awb0SavedBookmark' ) === -1 ) {
        _populateViewMoldelTreeNodeCreationStrategy( treeLoadInput, contextState, reuseVMNodes );
    }
}

/**
 *
 * @param {TreeLoadInput} treeLoadInput TreeLoadInput
 * @param {*} contextState Context State
 * @param {*} loadIDs IDs to be loaded
 * @param {*} topUid topUid
 */
function _populateParentElementAndExpansionParamsForProvidedInput( treeLoadInput ) {
    var loadIDs = treeLoadInput.loadIDs;
    if( _.isEqual( loadIDs.c_uid, loadIDs.o_uid ) ) {
        treeLoadInput.expandParent = true;
    }
    if( _.isEqual( loadIDs.c_uid, loadIDs.t_uid ) ) {
        treeLoadInput.parentElement = treeLoadInput.topUid;
    }
}

/**
 *
 * @param {TreeLoadInput} treeLoadInput TreeLoadInput
 * @param {*} contextState Context State
 */
function _resetCusrorParamsForProvidedParentNodeIfApplicable( treeLoadInput, contextState ) {
    if( contextState.context.requestPref.resetTreeDisplay || !_.isEmpty( contextState.context.configContext ) ) {
        if( treeLoadInput.parentNode.cursorObject && treeLoadInput.parentNode.cursorObject.endIndex ) {
            treeLoadInput.parentNode.cursorObject.endIndex = 0;
        }
        treeLoadInput.startChildNdx = 0;
    }
}

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 *
 * @return {Promise} A Promise resolved with a resulting TreeLoadResult object.
 */
function _doTreeTableLoad( treeLoadInput, uwDataProvider, declViewModel, contextState, soaInput, subPanelContext ) {
    var loadIDs = treeLoadInput.loadIDs;

    if( contextState.occContext.transientRequestPref && contextState.occContext.transientRequestPref.expandBelow ) {
        treeLoadInput.parentElement = contextState.occContext.currentState.o_uid;
        treeLoadInput.expandBelow = true;
        treeLoadInput.levelsApplicableForExpansion = contextState.occContext.transientRequestPref.levelsApplicableForExpansion;
    } //Move to populateExpandBelowParamsIfAppliacble()
    /*
     * loadTreeTableData() is calling this method with skipFocusOccurrenceCheck to true. So , logic to set
     * skipFocusOccurrenceCheck to true is commented as default value is true. Going forward , we should try to
     * get rid of this flag skipFocusOccurrenceCheck
     */

    /**
     * Determine what 'parent' we should tell 'occ6' to focus on.
     */
    else if( treeLoadInput.isTopNode ) {
        if( !treeLoadInput.cursorObject ) {
            soaInput.inputData.requestPref.includePath = [ 'true' ];
            if( _.isUndefined( soaInput.inputData.requestPref.loadTreeHierarchyThreshold ) ) {
                soaInput.inputData.requestPref.loadTreeHierarchyThreshold = [ '50' ];
            }
        } //This should move to _populateTreeLoadInputParamsForProvidedInput()

        /**
         * Check if a 'top' occurrence is set
         */
        if( treeLoadInput.topUid ) {
            /**
             * Check if no 'selected' (c_uid) occurrence OR it is the same as the, valid, 'parent' (o_uid) being
             * loaded.<BR>
             * If so: Find the 'grandparent' and make the 'parent' the focus of the query.
             * <P>
             * TODO: This is where 'includePath' can be used to avoid needing access to the 'grandParent' when
             * the SOA API change to support this is fully deployed.
             */
            if( _isSelectedNodeEmptyOrSameAsOpenedNode( loadIDs ) ) {
                if( _debug_logOccLoadActivity ) {
                    logger.info( '_doTreeTableLoad: Case #1: Focus on parent o_uid:' + loadIDs.o_uid );
                }

                _populateParentElementAndFocusElementInSoaInput( treeLoadInput, soaInput );

                /**
                 * We need to load the 'parent' before we can know the 'grandparent'
                 */
                if( _.isEqual( treeLoadInput.parentElement, cdmSvc.NULL_UID ) ) {
                    if( cdmSvc.isValidObjectUid( loadIDs.c_uid ) ) {
                        treeLoadInput.skipFocusOccurrenceCheck = false;
                    }

                    return dataManagementSvc.loadObjects( [ loadIDs.o_uid ] ).then( function() {
                        return _populateSOAInputParamsAndLoadTreeTableNodes( treeLoadInput, loadIDs, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext );
                    } );
                }
            } else {
                /**
                 * Check if the 'c_uid' and 'o_uid' are valid and 'c_uid' and 'o_uid' are NOT the same as the
                 * 'uid'. -- Need to check with use case is this.
                 */
                if( _areLoadIDsAndOpenedObjectDifferent( loadIDs ) ) {
                    if( _debug_logOccLoadActivity ) {
                        logger.info( '_doTreeTableLoad: Case #2: Focus on parent o_uid:' + loadIDs.o_uid //
                            +
                            ' c_uid: ' + loadIDs.c_uid );
                    }

                    _populateParentElementAndExpansionParamsForProvidedInput( treeLoadInput );

                    /**
                     * Check for case of the 'top' is selected<BR>
                     * If so: Just treat it as a normal 'top' expansion<BR>
                     * If not: Trust that the 'o_uid' is the immediate parent of the 'c_uid'.
                     */
                    if( !_.isEqual( loadIDs.c_uid, loadIDs.t_uid ) ) {
                        treeLoadInput.parentElement = loadIDs.o_uid; //already set above?
                        var cUidObject = cdmSvc.getObject( loadIDs.c_uid );

                        treeLoadInput.isFocusedLoad = true;

                        if( cUidObject ) {
                            if( !cdmSvc.isValidObjectUid( treeLoadInput.parentElement ) ) {
                                treeLoadInput.parentElement = occmgmtUtils.getParentUid( cUidObject );
                            }
                        } else {
                            cUidObject = occmgmtUtils.getObject( loadIDs.c_uid );
                        }

                        /**
                         * Check if we are changing the configuration<BR>
                         * If so: We need to reset inputs as if we are loading for the first time
                         */
                        _resetCusrorParamsForProvidedParentNodeIfApplicable( treeLoadInput, contextState );

                        if( !_.isEmpty( contextState.context.configContext ) ) {
                            treeLoadInput.skipFocusOccurrenceCheck = false;
                        }

                        soaInput.inputData.focusOccurrenceInput.element = cUidObject;
                    }

                    if( _debug_logOccLoadActivity ) {
                        logger.info( //
                            '_doTreeTableLoad: treeLoadInput:' + JSON.stringify( treeLoadInput, //
                                [ 'parentElement', 'cursorObject', 'isFocusedLoad', 'skipFocusOccurrenceCheck' ], 2 ) +
                            '\n' + 'soaInput.inputData.focusOccurrenceInput:' + '\n' +
                            JSON.stringify( soaInput.inputData.focusOccurrenceInput, [ 'element' ], 2 ) );
                    }
                } else {
                    if( _debug_logOccLoadActivity ) {
                        logger.info( '_doTreeTableLoad: Case #3: Focus on top o_uid:' + loadIDs.o_uid //
                            +
                            ' c_uid: ' + loadIDs.c_uid );
                    }

                    treeLoadInput.skipFocusOccurrenceCheck = false;
                    treeLoadInput.parentElement = treeLoadInput.topUid;
                }
            }
        } else {
            treeLoadInput.parentElement = cdmSvc.NULL_UID;
        }
    } else {
        /**
         * Assume the 'parent' node UID is good for the loading
         */
        treeLoadInput.parentElement = treeLoadInput.parentNode.uid;

        /**
         * Check if the 'c_uid' and 'o_uid' are valid and 'c_uid' and 'o_uid' are NOT the same as the 'uid'.
         */
        if( loadIDs && _areLoadIDsAndOpenedObjectDifferent( loadIDs ) ) {
            if( _debug_logOccLoadActivity ) {
                logger.info( '_doTreeTableLoad: Case #4: Focus on placeholder o_uid:' + loadIDs.o_uid //
                    +
                    ' c_uid: ' + loadIDs.c_uid );
            }

            cUidObject = cdmSvc.getObject( loadIDs.c_uid );

            if( cUidObject ) {
                if( !cdmSvc.isValidObjectUid( treeLoadInput.parentElement ) ) {
                    treeLoadInput.parentElement = occmgmtUtils.getParentUid( cUidObject );
                }
            } else {
                cUidObject = occmgmtUtils.getObject( loadIDs.c_uid );
            }

            soaInput.inputData.focusOccurrenceInput.element = cUidObject;
        }
    }

    return _loadTreeTableNodes( treeLoadInput, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext );
} // _doTreeTableLoad

function populateFocusElementInSoaInputIfApplicable( treeLoadInput, soaInput, focusObject ) {
    if( !treeLoadInput.skipFocusOccurrenceCheck ) {
        treeLoadInput.isFocusedLoad = true;
        soaInput.inputData.focusOccurrenceInput.element = focusObject;
    }
}

/**
 * @param {TreeLoadInput} loadIDs - Parameters for the operation.
 * @return {boolean} true if condition is met
 */
function _isSelectedNodeEmptyOrSameAsOpenedNode( loadIDs ) {
    return cdmSvc.isValidObjectUid( loadIDs.o_uid ) && ( !loadIDs.c_uid || cdmSvc.isValidObjectUid( loadIDs.c_uid ) && loadIDs.c_uid === loadIDs.o_uid );
}

/**
 * @param {TreeLoadInput} loadIDs - Parameters for the operation.
 * @return {boolean} true if condition is met
 */
function _areLoadIDsAndOpenedObjectDifferent( loadIDs ) {
    /**
     * Check if the 'c_uid' and 'o_uid' are valid and 'c_uid' and 'o_uid' are NOT the same as the
     * 'uid'.
     */
    return cdmSvc.isValidObjectUid( loadIDs.o_uid ) && cdmSvc.isValidObjectUid( loadIDs.c_uid ) && loadIDs.o_uid !== loadIDs.uid && loadIDs.c_uid !== loadIDs.uid;
}

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 *
 * @return {Promise} A Promise resolved with a resulting TreeLoadResult object.
 */
function _doTreeTablePage( treeLoadInput, uwDataProvider, declViewModel, contextState, soaInput, subPanelContext ) {
    var loadIDs = treeLoadInput.loadIDs;

    /**
     * Determine what 'parent' we should tell 'occ6' to focus on.
     */
    if( treeLoadInput.isTopNode ) {
        soaInput.inputData.requestPref.includePath = [ 'true' ];

        /**
         * Check if a 'top' occurrence is set
         */
        if( treeLoadInput.topUid ) {
            /**
             * Check if no 'selected' (c_uid) occurrence OR it is the same as the, valid, 'parent' (o_uid) being
             * loaded.<BR>
             * If so: Find the 'grandparent' and make the 'parent' the focus of the query.
             * <P>
             * TODO: This is where 'includePath' can be used to avoid needing access to the 'grandParent' when
             * the SOA API change to support this is fully deployed.
             */
            if( _isSelectedNodeEmptyOrSameAsOpenedNode( loadIDs ) ) {
                if( _debug_logOccLoadActivity ) {
                    logger.info( '_doTreeTablePage: Case #1: Focus on parent o_uid:' + loadIDs.o_uid );
                }

                _populateParentElementAndFocusElementInSoaInput( treeLoadInput, soaInput );

                /**
                 * If parent is emtpy , we need to load the 'parent' before we can know the 'grandparent'
                 */
                if( _.isEqual( treeLoadInput.parentElement, cdmSvc.NULL_UID ) ) {
                    return dataManagementSvc.loadObjects( [ loadIDs.o_uid ] ).then( function() {
                        return _populateSOAInputParamsAndLoadTreeTableNodes( treeLoadInput, loadIDs, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext );
                    } );
                }
            } else {
                /**
                 * Check if the 'c_uid' and 'o_uid' are valid and 'c_uid' and 'o_uid' are NOT the same as the
                 * 'uid'.
                 */
                if( _areLoadIDsAndOpenedObjectDifferent( loadIDs ) ) {
                    if( _debug_logOccLoadActivity ) {
                        logger.info( '_doTreeTablePage: Case #2: Focus on parent o_uid:' + loadIDs.o_uid //
                            +
                            ' c_uid: ' + loadIDs.o_uid );
                    }

                    _populateParentElementAndExpansionParamsForProvidedInput( treeLoadInput );

                    /**
                     * Check for case of the 'top' is selected<BR>
                     * If so: Just treat it as a normal 'top' expansion<BR>
                     * If not: Trust that the 'o_uid' is the immediate parent of the 'c_uid'.
                     */
                    if( !_.isEqual( loadIDs.c_uid, loadIDs.t_uid ) ) {
                        treeLoadInput.parentElement = loadIDs.o_uid; //already set above?
                        var cUidObject = cdmSvc.getObject( loadIDs.c_uid );

                        if( cUidObject ) {
                            var parentElement = occmgmtUtils.getParentUid( cUidObject );

                            if( cdmSvc.isValidObjectUid( parentElement ) ) {
                                treeLoadInput.parentElement = parentElement;
                            }

                            populateFocusElementInSoaInputIfApplicable( treeLoadInput, soaInput, cUidObject );
                        } else {
                            cUidObject = occmgmtUtils.getObject( loadIDs.c_uid );
                        }

                        /**
                         * Check if we are changing the configuration<BR>
                         * If so: We need to reset inputs as if we are loading for the first time
                         */
                        _resetCusrorParamsForProvidedParentNodeIfApplicable( treeLoadInput, contextState );
                    }

                    if( _debug_logOccLoadActivity ) {
                        logger.info( //
                            '_doTreeTablePage: treeLoadInput:' + JSON.stringify( treeLoadInput, //
                                [ 'parentElement', 'cursorObject', 'isFocusedLoad', 'skipFocusOccurrenceCheck' ], 2 ) +
                            '\n' + 'soaInput.inputData.focusOccurrenceInput:' + '\n' +
                            JSON.stringify( soaInput.inputData.focusOccurrenceInput, [ 'element' ], 2 ) );
                    }
                } else {
                    if( _debug_logOccLoadActivity ) {
                        logger.info( '_doTreeTablePage: Case #3: Focus on top o_uid:' + loadIDs.o_uid //
                            +
                            ' c_uid: ' + loadIDs.o_uid );
                    }

                    treeLoadInput.parentElement = treeLoadInput.topUid;
                }
            }
        }
    } else {
        treeLoadInput.parentElement = treeLoadInput.parentNode.uid;
    }

    return _loadTreeTableNodes( treeLoadInput, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext );
} // __doTreeTablePage

/**
 *
 *
 */
export let updateColumnPropsAndNodeIconURLs = function( propColumns, occurrenceNodes, contextState ) {
    var firstColumnConfigColumn = _.filter( propColumns, function( col ) { return _.isUndefined( col.clientColumn ); } )[ 0 ];
    var sortingSupported = occmgmtUtils.isSortingSupported( contextState );
    if( !sortingSupported ) {
        appCtxSvc.updatePartialCtx( contextState.key + '.sortCriteria', null );
    }

    // first column is special here
    if( appCtxSvc.ctx.ViewModeContext.ViewModeContext === 'TreeSummaryView' || appCtxSvc.ctx.ViewModeContext.ViewModeContext === 'TreeView' ) {
        firstColumnConfigColumn.isTreeNavigation = true;
        firstColumnConfigColumn.enableColumnHiding = false;
    } else if( appCtxSvc.ctx.ViewModeContext.ViewModeContext === 'TableSummaryView' || appCtxSvc.ctx.ViewModeContext.ViewModeContext === 'TableView' ) {
        firstColumnConfigColumn.isTableCommand = true;
    }

    _.forEach( propColumns, function( col ) {
        if( !col.typeName && col.associatedTypeName ) {
            col.typeName = col.associatedTypeName;
            col.enableSorting = sortingSupported;

            var vmpOfColumnProp = occurrenceNodes[ 0 ].props[ col.propertyName ];

            if( col.sortDirection === 'Ascending' || col.sortDirection === 'Descending' ) {
                var newSortCriteria = [ { fieldName: col.propertyName, sortDirection: 'ASC' } ];
                if( col.sortDirection === 'Descending' ) {
                    newSortCriteria[ 0 ].sortDirection = 'DESC';
                }
                appCtxSvc.updatePartialCtx( contextState.key + '.sortCriteria', newSortCriteria );
            }

            //Disable Sorting on DCP property
            if( vmpOfColumnProp && vmpOfColumnProp.isDCP ) {
                col.enableSorting = false;
            }

            var sortCriteria = _.cloneDeep( appCtxSvc.getCtx( contextState.key ).sortCriteria );
            if( !_.isEmpty( sortCriteria ) ) {
                if( sortCriteria[ 0 ].fieldName && _.eq( col.propertyName, sortCriteria[ 0 ].fieldName ) ) {
                    col.sort = {};
                    col.sort.direction = sortCriteria[ 0 ].sortDirection.toLowerCase();
                    col.sort.priority = 0;
                }
            }
        }
    } );

    firstColumnConfigColumn.enableColumnMoving = false;
    _firstColumnConfigColumnPropertyName = firstColumnConfigColumn.propertyName;

    // We got awb0ThumbnailImageTicket for nodes in SOA response. Update icon URL for all Nodes
    _.forEach( occurrenceNodes, function( childNode ) {
        childNode.iconURL = occmgmtIconSvc.getIconURL( childNode );
        treeTableDataService.updateVMODisplayName( childNode, _firstColumnConfigColumnPropertyName );
    } );

    //TODO : probable data mutation case
    var vmc = appCtxSvc.ctx[ contextState.key ].vmc;
    let cellRenderers = contextState.occContext ? contextState.occContext.cellRenderers : null;
    exports.updateDisplayNames( { viewModelObjects: vmc.getLoadedViewModelObjects() } );
    occmgmtCellRenderingService.addCellClass( propColumns );
    occmgmtCellRenderingService.setOccmgmtCellTemplate( propColumns, cellRenderers, contextState.key );
};

/**
 *
 */
function _resetContextState( contextKey ) {
    appCtxSvc.updatePartialCtx( contextKey + '.treeLoadingInProgress', false );
    if( appCtxSvc.ctx[ contextKey ].transientRequestPref.selectionToUpdatePostTreeLoad ) {
        contextStateMgmtService.syncContextState( contextKey, appCtxSvc.ctx[ contextKey ].transientRequestPref.selectionToUpdatePostTreeLoad );
    }
}

/**
 *
 */
function _populateRetainExpansionStatesParameterForProvidedInput( treeLoadInput, occContext ) {
    // //Retain expansion states when initializeAction.
    if( _.isEqual( treeLoadInput.dataProviderActionType, 'initializeAction' ) ) {
        treeLoadInput.retainTreeExpansionStates = true;
    }

    if( !_.isUndefined( occContext.transientRequestPref ) && !_.isUndefined( occContext.transientRequestPref.retainTreeExpansionStates ) ) {
        treeLoadInput.retainTreeExpansionStates = occContext.transientRequestPref.retainTreeExpansionStates;
    }
}

/**
 *
 */
function _populateSortCriteriaParameterForProvidedInput( treeLoadInput, contextState, newSortCriteria, soaInput ) {
    var context = appCtxSvc.getCtx( contextState.key );
    var currentSortCriteria = context.sortCriteria;
    // If no sort criteria to sort criteria OR sort criteria to no sort criteria
    if( !_.isEmpty( newSortCriteria ) || !_.isEmpty( currentSortCriteria ) ) {
        if( !_.isEqual( newSortCriteria, currentSortCriteria ) ) {
            treeLoadInput.retainTreeExpansionStates = true;
            treeLoadInput.sortCriteriaChanged = true;
            // Enable jitter free propery load
            // Return the child nodes without bom expansion
            let value = {
                jitterFreePropLoad: [ 'true' ],
                returnChildrenNoExpansion: [ 'true' ]
            };
            // Set loadTreeHierarchyThreshold to number of VMOs in the client
            if( !_.isEmpty( context.vmc ) && !_.isEmpty( context.vmc.loadedVMObjects ) ) {
                value.loadTreeHierarchyThreshold = [ context.vmc.loadedVMObjects.length.toString() ];
            }
            soaInput.inputData.requestPref = value;
            appCtxSvc.updatePartialCtx( contextState.key + '.sortCriteria', newSortCriteria );
        }
    }

    treeLoadInput.sortCriteria = appCtxSvc.getCtx( contextState.key ).sortCriteria;
}

/**
 * Populates the strategy for reuse of view model tree node during creation
 * reuseVMNode - If existing view mode tree node exists with collection then that will be reused.
 */
function _populateViewMoldelTreeNodeCreationStrategy( treeLoadInput, contextState, reuseVMNodes ) {
    var reuseVMNode = ( !_.isEqual( treeLoadInput.dataProviderActionType, 'initializeAction' ) ||
        contextState.context.requestPref.filterOrRecipeChange || contextState.occContext.transientRequestPref.filterOrRecipeChange ||
        treeLoadInput.sortCriteriaChanged ) && reuseVMNodes !== 'false';
    treeLoadInput.vmNodeCreationStrategy = {
        reuseVMNode: reuseVMNode
    };
    if( treeLoadInput.sortCriteriaChanged ) {
        treeLoadInput.vmNodeCreationStrategy.clearExpandState = true;
    }
}

/**
 *
 */
function _populateClearExistingSelectionsParameterForProvidedInput( treeLoadInput, contextState ) {
    var clearExistingSelections = appCtxSvc.getCtx( contextState.key ).clearExistingSelections;

    if( clearExistingSelections || !_.isEmpty( contextState.context.configContext ) ) {
        treeLoadInput.clearExistingSelections = true;
        appCtxSvc.updatePartialCtx( contextState.key + '.clearExistingSelections', false );
    }
}

/**
 *
 */
function _updateContextStateOnUrlRefresh( treeLoadInput, contextState ) {
    //If previous state is empty, that means it is open case/url refresh case
    if( treeLoadInput.openOrUrlRefreshCase ) {
        if( !_.isEmpty( contextState.occContext.currentState.incontext_uid ) ) {
            contextState.occContext.currentState.c_uid = contextState.occContext.currentState.incontext_uid;
        }
    }
}

/**
 * Local storage has 2 set of information stored per product(PCI uid), nodeStates and structure.
 * nodeStates has a flat list of expadedNodes sorted alphabetically and structure has expandedNodes in parent-children hierarchy.
 * This API iterates over the structure and gets the expandedNodes csids if the same entry is present in the nodeState.
 */
function _fetchCsidsForNodes( csids, structureNode, nodeStates ) {
    for( var node in structureNode ) {
        if( node && node !== 'childNdx' ) {
            if( nodeStates.includes( node ) ) {
                csids.push( node );
            } else {
                continue;
            }
        }

        if( !_.isEmpty( structureNode[ node ] ) ) {
            _fetchCsidsForNodes( csids, structureNode[ node ], nodeStates );
        }
    }
}

/**
 *
 */
function _updateTreeLoadInputParameterForResetAction( treeLoadInput, contextState ) {
    let occContext = contextState.occContext;
    let isResetActionInProgress = !_.isEmpty( occContext.transientRequestPref ) && _.isEqual( occContext.transientRequestPref.savedSessionMode, 'reset' );

    //When reset is done and UID of rootNode doesn't change, Tree widget doesn't populate children property.
    //Re-setting parentNode UID info to what it was when we open structure (state.uid ) helps. Correct way
    //to fix this is refactor dataProviderFactory processTreeNodes logic.
    if( isResetActionInProgress ) {
        treeLoadInput.parentNode.uid = occContext.currentState.uid;
        /*
         For exapnsion state to clear in AFX, isFocusedLoad is required to be true.
         Somehow for reset, loadIDs are coming as NULL in BA. So, setting this explicitly for now.
         */
        treeLoadInput.isFocusedLoad = true;
        treeLoadInput.isResetRequest = true;
    }
}

/**
 * Modified tree load input for isFilterChangeRequest parameter bsaed on applied filters
 */
function _updateTreeLoadInputParameterForFilterChangeAction( treeLoadInput, contextState ) {
    let occContext = contextState.occContext;
    // When there if change or add or remove of filters, the contextstate gets populated with applied filters field.
    // The field used to decide whether this is filter change action.
    if( !_.isUndefined( occContext.appliedFilters ) ) {
        treeLoadInput.isFilterChangeRequest = true;
    }
}

function _getTreeNodeIdsToBeLoaded( loadIDs, contextState ) {
    if( awStateService.instance.params[ contextState.urlParams.rootQueryParamKey ] !== contextState.occContext.currentState.uid ) {
        return {
            t_uid: awStateService.instance.params[ contextState.urlParams.topElementQueryParamKey ],
            o_uid: awStateService.instance.params[ contextState.urlParams.openStructureQueryParamKey ],
            c_uid: awStateService.instance.params[ contextState.urlParams.selectionQueryParamKey ],
            uid: awStateService.instance.params[ contextState.urlParams.rootQueryParamKey ]
        };
    }

    if( !loadIDs ) {
        return {
            t_uid: contextState.occContext.currentState.t_uid,
            o_uid: contextState.occContext.currentState.o_uid,
            c_uid: contextState.occContext.currentState.c_uid,
            uid: contextState.occContext.currentState.uid
        };
    }

    if( !cdmSvc.isValidObjectUid( loadIDs.uid ) ) {
        loadIDs.uid = contextState.occContext.currentState.uid;
    }
    return loadIDs;
}

/**
 *
 */
function _getEffectiveOverriddenPolicy() {
    var overriddenPropertyPolicy = propertyPolicySvc.getEffectivePolicy();

    //read preference AWB_ShowTypeIcon
    if( !_.isUndefined( appCtxSvc.ctx.preferences ) && !_.isUndefined( appCtxSvc.ctx.preferences.AWB_ShowTypeIcon ) &&
        appCtxSvc.ctx.preferences.AWB_ShowTypeIcon.length > 0 && appCtxSvc.ctx.preferences.AWB_ShowTypeIcon[ 0 ].toUpperCase() === 'TRUE' ) {
        // show thumbnail false, show type ICON true
        _.forEach( overriddenPropertyPolicy.types, function( type ) {
            var properties = [];
            _.forEach( type.properties, function( property ) {
                if( property.name !== 'awp0ThumbnailImageTicket' ) {
                    properties.push( property );
                }
            } );
            type.properties = properties;
        } );
    }

    return overriddenPropertyPolicy;
}

/**
 * @param {Object} uwDataProvider - An Object (usually a UwDataProvider) on the DeclViewModel on the $scope this
 *            action function is invoked from.
 * @param {Object} columnProvider:
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 *
 * <pre>
 * {
 *     columnInfos : {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 * }
 * </pre>
 */
export let loadTreeTableColumns = function( uwDataProvider, columnProvider ) {
    var deferred = AwPromiseService.instance.defer();
    var awColumnInfos = [];
    var firstColumnConfigCol = {
        name: 'object_string',
        displayName: '...',
        typeName: 'Awb0Element',
        width: 400,
        isTreeNavigation: true,
        enableColumnMoving: false,
        enableColumnResizing: false,
        columnOrder: 100
    };

    var clientColumns = columnProvider && columnProvider.clientColumns ? columnProvider.clientColumns : [];
    if( clientColumns ) {
        _.forEach( clientColumns, function( column ) {
            if( column.clientColumn ) {
                awColumnInfos.push( column );
            }
        } );
    }

    awColumnInfos.push( firstColumnConfigCol );
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );

    //TODO: Check why columnProvider call is not passing additional arugments.
    occmgmtCellRenderingService.setOccmgmtCellTemplate( awColumnInfos, null );

    var sortCriteria = appCtxSvc.getCtx( 'aceActiveContext.context.sortCriteria' );
    if( !_.isEmpty( sortCriteria ) ) {
        if( sortCriteria[ 0 ].fieldName && _.eq( awColumnInfos[ 0 ].name, sortCriteria[ 0 ].fieldName ) ) {
            awColumnInfos[ 0 ].sort = {};
            awColumnInfos[ 0 ].sort.direction = sortCriteria[ 0 ].sortDirection.toLowerCase();
            awColumnInfos[ 0 ].sort.priority = 0;
        }
    }

    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos
        }
    } );

    return deferred.promise;
};

// Clears the vector if it contains SRUID
let _enforceCsidChains = function( csidChains ) {
    var sruidPrefix = 'SR::N::';
    var sruidFound = csidChains.find( csidChain => {
        if( csidChain.includes( sruidPrefix ) ) {
            return true;
        }
    } );
    if( sruidFound ) {
        csidChains.splice( 0, csidChains.length );
    }
};

/**
 * Get a page of row data for a 'tree' table.
 *
 * Note: This method assumes there is a single argument object being passed to it and that this object has the
 * following property(ies) defined in it.
 * <P>
 * {TreeLoadInput} treeLoadInput - An Object with details for this action for what to load. The object is
 * usually the result of processing the 'inputData' property of a DeclAction based on data from the current
 * DeclViewModel on the $scope). The 'pageSize' properties on this object is used (if defined).
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
export let loadTreeTableData = function() { // eslint-disable-line no-unused-vars
    /**
     * Extract action parameters from the argument to this function.
     */
    assert( arguments.length === 1, 'Invalid argument count' );
    assert( arguments[ 0 ].treeLoadInput, 'Missing argument property' );

    let treeLoadInput = arguments[ 0 ].treeLoadInput;
    let loadIDs = arguments[ 0 ].loadIDs;
    let grid = { ...arguments[ 0 ].grid };
    let subPanelContext = arguments[ 0 ].subPanelContext;
    let contextKey = subPanelContext.contextKey;
    let dataProvider = arguments[ 0 ].uwDataProvider;
    let declViewModel = { ...arguments[ 0 ].declViewModel };
    let newSortCriteria = _.cloneDeep( arguments[ 0 ].sortCriteria );
    let contextState = {
        context: appCtxSvc.ctx[ contextKey ],
        key: contextKey,
        urlParams: subPanelContext.urlParams,
        occContext: subPanelContext.occContext.getValue()
    };
    let reuseVMNodes = arguments[ 0 ].reuseVMNodes;

    treeLoadInput.dataProviderActionType = arguments[ 0 ].dataProviderActionType;

    _populateClearExistingSelectionsParameterForProvidedInput( treeLoadInput, contextState );
    _updateTreeLoadInputParameterForResetAction( treeLoadInput, contextState );
    _updateTreeLoadInputParameterForFilterChangeAction( treeLoadInput, contextState );

    treeLoadInput.grid = grid;

    /**
     * Check the validity of the parameters
     */
    var failureReason = awTableSvc.validateTreeLoadInput( treeLoadInput );

    if( failureReason ) {
        return AwPromiseService.instance.reject( failureReason );
    }

    appCtxSvc.updatePartialCtx( contextKey + '.treeLoadingInProgress', true );

    let isConfigurationChangeRequest = !_.isEmpty( contextState.occContext.configContext ) || !_.isEmpty( contextState.context.configContext );
    var soaInput = occmgmtGetSvc.getDefaultSoaInput();

    _populateTreeLoadInputParamsForProvidedInput( treeLoadInput, contextState, loadIDs, newSortCriteria, soaInput, reuseVMNodes );
    _updateContextStateOnUrlRefresh( treeLoadInput, contextState );

    // Fix for LCS-766393
    // isUserContextSaveRequired is a transient state on ctx which is lost on urlRefresh reset it to true
    if(  treeLoadInput.openOrUrlRefreshCase === 'urlRefresh'  ) {
        occmgmtUtils.updateValueOnCtxOrState( 'isUserContextSaveRequired', true, contextKey );
    }

    // When changing configuration we need to send list of expanded nodes to server
    //should this have generic check for retainTreeExpansionStates?
    if( _.isEqual( treeLoadInput.retainTreeExpansionStates, true ) ) {
        soaInput.inputData.requestPref.expandedNodes = occmgmtTreeTableStateService.getCSIDChainsForExpandedNodes( dataProvider );
    }


    var gridId = Object.keys( declViewModel.grids )[ 0 ];
    if( !_.isUndefined( appCtxSvc.ctx.clearLocalStorageForInactiveView ) && appCtxSvc.ctx.clearLocalStorageForInactiveView === gridId ) {
        awTableStateService.clearAllStates( declViewModel, gridId );
        appCtxSvc.updatePartialCtx( 'clearLocalStorageForInactiveView', null );
    }

    var newReqPrefValues = {};
    var csidChainsOfNodes = [ ':' ];
    // In case of urlRefresh and backButton, we send the expanded nodes cached in the local storage as input.
    // This is done to achieve jitterfree behaviour for the 2 scenarios.
    if( ( treeLoadInput.openOrUrlRefreshCase === 'urlRefresh' || treeLoadInput.openOrUrlRefreshCase === 'backButton' ) &&
         _.isEmpty( contextState.occContext.transientRequestPref.expandedNodes )  ) {
        var topNodeUid = treeLoadInput.topUid;

        if( topNodeUid ) {
            // The dataProvider.topTreeNode.uid is populated with SRUID as a part of getOcc call response processing.
            // Until then it is the uid of top item rev.
            // Populate the uid as alternate id on the dataprovider to get the correct values from the local storage.
            // To get the ttstate from LS, the awTableState APIs compare the dataprovider uid with the topNode uid (SRUID)
            if( dataProvider.topTreeNode && dataProvider.topTreeNode.uid !== topNodeUid ) {
                dataProvider.topTreeNode.alternateID = topNodeUid;
            }

            var ttState = awTableStateService.getTreeTableState( declViewModel, gridId );
            if( !_.isEmpty( ttState.nodeStates ) && !_.isEmpty( ttState.structure ) ) {
                // Get the list of expanded nodes from the local storage if an entry exists
                var nodeStates = [];
                for( var node in ttState.nodeStates ) {
                    nodeStates.push( node );
                }

                // Fetch the csids to an array from local storage
                var tableStructure = ttState.structure;
                var structureNodes = tableStructure[ topNodeUid ];
                _fetchCsidsForNodes( csidChainsOfNodes, structureNodes, nodeStates );
            }

            if( dataProvider.topTreeNode && dataProvider.topTreeNode.alternateID ) {
                delete dataProvider.topTreeNode.alternateID;
            }

            _enforceCsidChains( csidChainsOfNodes );

            if( csidChainsOfNodes.length > 1 ) {
                newReqPrefValues = {
                    expandedNodes: csidChainsOfNodes
                };
            }
        }
    }
    if( contextState.occContext.transientRequestPref.expandedNodes > 1 || csidChainsOfNodes.length > 1 ) {
        newReqPrefValues.jitterFreePropLoad = [ 'true' ];
        newReqPrefValues.loadTreeHierarchyThreshold = [ '2147483646' ];
        newReqPrefValues.returnChildrenNoExpansion = [ 'true' ];

        soaInput.inputData.requestPref = newReqPrefValues;
    }
    /**
     * Get the 'child' nodes async
     */
    return _doTreeTableLoad( treeLoadInput, dataProvider, declViewModel, contextState, soaInput, subPanelContext );
};

/*
 * Method registered against focusAction in viewModel json.
 */
export let loadOccurrencesWithFocusInTreeTable = function() {
    let soaInput = occmgmtGetSvc.getDefaultSoaInput();
    let subPanelContext = arguments[ 0 ].subPanelContext;
    let treeLoadInput = arguments[ 0 ].treeLoadInput;
    let dataProvider = arguments[ 0 ].uwDataProvider;
    let newSortCriteria =  arguments[ 0 ].sortCriteria;
    let contextState = {
        context: appCtxSvc.ctx[ subPanelContext.contextKey ],
        key: subPanelContext.contextKey,
        urlParams: subPanelContext.urlParams,
        occContext: subPanelContext.occContext
        //occContext: subPanelContext.occContext.getValue() //We dont need getValue() here as in focus case, occContext doesnt modify
    };

    // Fix for LCS-749532 Workaround fix till we get correct fix from CFX
    // CFX should not trigger the focus load action if the focussed element is part of the VMC
    let elementToFocusOn = occmgmtUtils.getObject( contextState.occContext.currentState.c_uid );
    if( contextState.occContext.vmc.findViewModelObjectById( elementToFocusOn.uid ) !== -1 ) {
        return AwPromiseService.instance.reject( 'Focus occurrence is already in the vmc.' );
    }

    let parentProp = elementToFocusOn.props.awb0BreadcrumbAncestor ? elementToFocusOn.props.awb0BreadcrumbAncestor : elementToFocusOn.props.awb0Parent;

    treeLoadInput.dataProviderActionType = arguments[ 0 ].dataProviderActionType;
    treeLoadInput.loadIDs = _getTreeNodeIdsToBeLoaded( undefined, contextState );
    // When focus load action triggered we need to send list of expanded nodes to server
    // Applications can consume expanded nodes information as needed
    treeLoadInput.loadIDs = _getTreeNodeIdsToBeLoaded( undefined, contextState );
    soaInput.inputData.requestPref.expandedNodes = occmgmtTreeTableStateService.getCSIDChainsForExpandedNodes( dataProvider );
    soaInput.inputData.requestPref.loadTreeHierarchyThreshold = [ '50' ];
    soaInput.inputData.focusOccurrenceInput.element = elementToFocusOn;
    treeLoadInput.parentElement = parentProp.dbValues[ 0 ];

    /*
     * If focus occurrence is hidden occurrence, then we should process tree update.
     */
    if( contextState.context ) {
        if( !_.isUndefined( treeLoadInput.loadIDs ) && !_.isUndefined( treeLoadInput.loadIDs.c_uid ) &&
            acePartialSelectionService.isPartiallySelected( treeLoadInput.loadIDs.c_uid ) &&
            acePartialSelectionService.isPartiallySelectedInTree( treeLoadInput.loadIDs.c_uid ) ) {
            return AwPromiseService.instance.reject( 'focus occurrence is hidden.' );
        }
    }

    appCtxSvc.updatePartialCtx( subPanelContext.contextKey + '.treeLoadingInProgress', true );
    _populateSortCriteriaParameterForProvidedInput( treeLoadInput, contextState, newSortCriteria, soaInput );
    //return _doTreeTablePage( treeLoadInput, dataProvider, arguments[ 0 ].declViewModel, contextState, soaInput, subPanelContext );
    return _loadTreeTableNodes( treeLoadInput, soaInput, dataProvider, arguments[ 0 ].declViewModel, contextState, subPanelContext );
};

export let clearCurrentExpandBelowBufferVmo = function( response, scrollPosition ) {
    if( scrollPosition && scrollPosition.currentExpandBelowBufferVmo ) {
        let treeLoadResult = response.treeLoadResult;
        if( _.isEqual( treeLoadResult.parentNode.uid, scrollPosition.currentExpandBelowBufferVmo.uid ) ) {
            delete scrollPosition.currentExpandBelowBufferVmo;
        }
    }
    return scrollPosition;
};

/**
 * Expands a single parent using the Invoker
 * @returns {Promise} Promise required for return by loadNextOccurrencesInTreeTable
 */
function _expandOneWithInvoker() {
    // TODO: Factor into separate fn
    assert( arguments.length === 1, 'Invalid argument count' );
    assert( arguments[ 0 ].treeLoadInput !== undefined, 'Missing argument property' );

    let treeLoadInput = arguments[ 0 ].treeLoadInput;
    let uwDataProvider = arguments[ 0 ].uwDataProvider;
    let subPanelContext = arguments[ 0 ].subPanelContext;

    /* loadTreeTableDataPage talks in terms of this structure */
    /*     let contextState = {
        context: appCtxSvc.ctx[ contextKey ],
        key: contextKey,
        urlParams: subPanelContext.urlParams,
        occContext: subPanelContext.occContext.getValue()
    }; */

    let commandContext = {
        occContext: subPanelContext.occContext.getValue(),
        viewKey: subPanelContext.contextKey,
        clientScopeURI: uwDataProvider.objectSetUri,
        uwDataProvider: uwDataProvider
    };
    expandRequests.expandOne( treeLoadInput.parentNode, commandContext );

    // Return only enough to keep tree happy for now
    var emptyResult = {
        treeLoadResult: { totalChildCount: 0 }
    };
    return AwPromiseService.instance.resolve( emptyResult );
}

export let loadNextOccurrencesInTreeTable = function() {
    if( expandRequests.expandOneEnabled( arguments[ 0 ].subPanelContext.occContext ) ) {
        return _expandOneWithInvoker( arguments[ 0 ] );
    }
    return exports.loadTreeTableDataPage( arguments[ 0 ] );
};

/*
 * Method registered against previousAction in viewModel json
 */
export let loadPreviousOccurrencesInTreeTable = function() {
    return exports.loadTreeTableDataPage( arguments[ 0 ] );
};

/**
 * Get a page of row data for a 'tree' table.
 *
 * Note: This method assumes there is a single argument object being passed to it and that this object has the
 * following property(ies) defined in it.
 * <P>
 * {TreeLoadInput} treeLoadInput - An Object with details for this action for what to load. The object is
 * usually the result of processing the 'inputData' property of a DeclAction based on data from the current
 * DeclViewModel on the $scope). The 'pageSize' properties on this object is used (if defined).
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
export let loadTreeTableDataPage = function() { // eslint-disable-line no-unused-vars
    /**
     * Extract action parameters from the argument to this function.
     */

    assert( arguments.length === 1, 'Invalid argument count' );
    assert( arguments[ 0 ].treeLoadInput, 'Missing argument property' );

    let treeLoadInput = arguments[ 0 ].treeLoadInput;
    let loadIDs = arguments[ 0 ].loadIDs;
    let grid = arguments[ 0 ].grid;
    let dataProvider = arguments[ 0 ].uwDataProvider;
    let newSortCriteria = arguments[ 0 ].sortCriteria;
    let subPanelContext = arguments[ 0 ].subPanelContext;
    let contextKey = subPanelContext.contextKey;
    let contextState = {
        context: appCtxSvc.ctx[ contextKey ],
        key: contextKey,
        urlParams: subPanelContext.urlParams,
        occContext: subPanelContext.occContext.getValue()
    };
    let reuseVMNodes = arguments[ 0 ].reuseVMNodes;

    aceRestoreBWCStateService.toggleTreeNode( arguments[ 0 ].declViewModel, subPanelContext, treeLoadInput.parentNode );
    treeLoadInput.dataProviderActionType = arguments[ 0 ].dataProviderActionType;

    if( treeLoadInput.cursorNodeId ) {
        var objNdx = dataProvider.viewModelCollection.findViewModelObjectById( treeLoadInput.cursorNodeId );
        var vmNode = dataProvider.viewModelCollection.getViewModelObject( objNdx );

        /**isPlaceholder / _focusRequested property on vmNode indicates that it is placeHolder node. This is not actual focus
         * object. But passed as focus object to load that particular incomplete level in client. So set skipFocusOccurrenceCheck to true.
         **/
        if( vmNode._loadTailRequested || vmNode._loadHeadRequested || vmNode._focusRequested ) {
            treeLoadInput.skipFocusOccurrenceCheck = true;
        } else {
            /**
             * Call is being made neither for focus action nor for pagination.
             * Invalid call. Results into duplicate nodes being shown in Tree + other functional issues.
             */
            //return AwPromiseService.instance.reject( 'Invalid TreeLoadInput specified' );
        }
    }

    let transientRequestPref = contextState.occContext.transientRequestPref;
    if( ( transientRequestPref && transientRequestPref.expandBelow || treeLoadInput.parentNode.isInExpandBelowMode ) && _.isEmpty( contextState.context
        .configContext ) ) {
        treeLoadInput.expandBelow = true;
        treeLoadInput.levelsApplicableForExpansion = contextState.occContext.transientRequestPref.levelsApplicableForExpansion;
        transientRequestPref.expandBelow = true;
        transientRequestPref.loadTreeHierarchyThreshold = occmgmtUtils.getExpandBelowPageSize();

        //scopeForExpandBelow should be sent to server for every follow up expandBelow request
        transientRequestPref.scopeForExpandBelow = contextState.occContext.persistentRequestPref.scopeForExpandBelow;
    }

    treeLoadInput.grid = grid;

    /*
     * This method is called in following scenarios : a) Object is added into selection,it is not displayed
     * currently in tree , needs to be fetched from server and focused. In this case, skipFocusOccurrenceCheck
     * should not be true so that focus occurrence is passed to server and it get focused after server response (
     * in case of 4G , different object comes from server) b) When Tree Node is expanded. In this case,
     * skipFocusOccurrenceCheck should be true so that current focus occurrence is not passed to server. Server
     * returns data based on parent of focus occurrence
     */
    if( treeLoadInput.parentNode ) {
        if( treeLoadInput.parentNode.isExpanded ) {
            //TreeNode expansion scenario
            treeLoadInput.skipFocusOccurrenceCheck = true;
            //We need loadIDs from data provider only in "Expand Node" use case. Otherwise, loadIDs
            //information is there on URL.
            treeLoadInput.loadIDs = {
                t_uid: arguments[ 0 ].loadIDs.t_uid,
                o_uid: arguments[ 0 ].loadIDs.o_uid,
                uid: contextState.occContext.currentState.uid
            };

            if( contextState.context.elementToPCIMap ) {
                if( treeLoadInput.parentNode.pciUid ) {
                    treeLoadInput.pci_uid = treeLoadInput.parentNode.pciUid;
                } else {
                    treeLoadInput.pci_uid = occmgmtUtils.getProductContextForProvidedObject( treeLoadInput.parentNode );
                }
            }
        }
    }

    /**
     * Check the validity of the parameters
     */
    var failureReason = awTableSvc.validateTreeLoadInput( treeLoadInput );

    if( failureReason ) {
        return AwPromiseService.instance.reject( failureReason );
    }
    var soaInput = occmgmtGetSvc.getDefaultSoaInput();
    appCtxSvc.updatePartialCtx( contextKey + '.treeLoadingInProgress', true );
    _populateTreeLoadInputParamsForProvidedInput( treeLoadInput, contextState, loadIDs, newSortCriteria, soaInput, reuseVMNodes );

    /**
     * Get the 'child' nodes async
     */

    return _doTreeTablePage( treeLoadInput, arguments[ 0 ].uwDataProvider, arguments[ 0 ].declViewModel, contextState, soaInput, subPanelContext );
};

/**
 * Get a object containing callback function.
 * @return {Object} A object containing callback function.
 */
function getDataForUpdateColumnPropsAndNodeIconURLs( subPanelContext ) {
    var updateColumnPropsCallback = {};
    let contextState = {
        occContext: subPanelContext.occContext,
        key: subPanelContext.occContext.viewKey
    };
    updateColumnPropsCallback.callUpdateColumnPropsAndNodeIconURLsFunction = function( propColumns, allChildNodes, contextKey, response, uwDataProvider ) {
        var columnConfigResult = null;
        let clientColumns = uwDataProvider && !_.isEmpty( uwDataProvider.cols ) ? _.filter( uwDataProvider.cols, { clientColumn: true } ) : [];
        propColumns = clientColumns.length > 0 ? _.concat( clientColumns, propColumns ) : propColumns;
        exports.updateColumnPropsAndNodeIconURLs( propColumns, allChildNodes, contextState );

        let columnsConfig = response.output.columnConfig;
        columnsConfig.columns = _.sortBy( propColumns, function( column ) { return column.columnOrder; } );
        columnConfigResult = columnsConfig;

        _resetContextState( contextKey );
        return columnConfigResult;
    };

    return updateColumnPropsCallback;
}

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
export let loadTreeTableProperties = function() {
    arguments[ 0 ].updateColumnPropsCallback = getDataForUpdateColumnPropsAndNodeIconURLs( arguments[ 0 ].subPanelContext );
    arguments[ 0 ].overriddenPropertyPolicy = _getEffectiveOverriddenPolicy();

    //Disable Buffer service
    if( requestQueue.active() ) {
        return AwPromiseService.instance.resolve( treeTableDataService.loadTreeTableProperties( arguments[ 0 ] ) );
    }

    let subPanelContext = arguments[ 0 ].subPanelContext;
    if( expandRequests.loadTreePropertiesInBackgroundEnabled( subPanelContext.occContext ) ) {
        let uwDataProvider = arguments[ 0 ].uwDataProvider;
        let commandContext = {
            occContext: subPanelContext.occContext,
            viewKey: subPanelContext.contextKey,
            clientScopeURI: uwDataProvider.objectSetUri,
            uwDataProvider: uwDataProvider
        };

        return AwPromiseService.instance.resolve( treeTableDataService.loadTreeTableProperties( arguments[ 0 ] ) ).then( expandRequests.loadTreePropertiesInBackground( commandContext ) );
    }

    if( _.isUndefined( arguments[ 0 ].skipExtraBuffer ) || arguments[ 0 ].skipExtraBuffer === false ) {
        occmgmtTreeTableBufferService.addExtraBufferToPage( { propertyLoadInput: arguments[ 0 ].propertyLoadInput }, arguments[ 0 ].uwDataProvider );
    }
    return AwPromiseService.instance.resolve( treeTableDataService.loadTreeTableProperties( arguments[ 0 ] ) );
};

export let clearCurrentPropBufferVmo = function( response, scrollPosition ) {
    if( scrollPosition && scrollPosition.currentPropBufferVmo ) {
        _.forEach( response.propertyLoadResult.updatedNodes, function( vmo ) {
            if( _.isEqual( vmo.uid, scrollPosition.currentPropBufferVmo.uid ) ) {
                delete scrollPosition.currentPropBufferVmo;
                return false; // break
            }
        } );
    }
    return scrollPosition;
};

export let loadTreeTablePropertiesOnInitialLoad = function( vmNodes, declViewModel, uwDataProvider, context, contextKey, subPanelContext ) {
    var updateColumnPropsCallback = getDataForUpdateColumnPropsAndNodeIconURLs( subPanelContext );
    return AwPromiseService.instance.resolve( treeTableDataService.loadTreeTablePropertiesOnInitialLoad( vmNodes,
        declViewModel, uwDataProvider, context, contextKey, updateColumnPropsCallback, _getEffectiveOverriddenPolicy() ) );
};

export let getContextKeyFromParentScope = function( parentScope ) {
    return contextStateMgmtService.getContextKeyFromParentScope( parentScope );
};

/**
 * Makes sure the displayName on the ViewModelTreeNode is the same as the Column 0 ViewModelProperty
 * eventData : {Object} containing viewModelObjects and totalObjectsFound
 */
export let updateDisplayNames = function( loadedVMObjects, eventData ) {
    //update the display name for all ViewModelObjects which should be viewModelTreeNodes
    if( eventData && eventData.viewModelObjects ) {
        _.forEach( eventData.viewModelObjects, function( updatedVMO ) {
            if( updatedVMO.props && updatedVMO.props[ _firstColumnConfigColumnPropertyName ] && updatedVMO.props[ _firstColumnConfigColumnPropertyName ].displayValues ) {
                treeTableDataService.updateVMODisplayName( updatedVMO, _firstColumnConfigColumnPropertyName );
            }
        } );
    }

    //TODO : probable data mutation case
    //loadedVMObjects from eventData are getting updated...probably not right copy from dispatcher...
    if( eventData && eventData.modifiedObjects && loadedVMObjects ) {
        _.forEach( eventData.modifiedObjects, function( modifiedObject ) {
            var modifiedVMOs = loadedVMObjects.filter( function( vmo ) { return vmo.id === modifiedObject.uid; } );
            _.forEach( modifiedVMOs, function( modifiedVMO ) {
                if( modifiedVMO.props && modifiedVMO.props[ _firstColumnConfigColumnPropertyName ] && modifiedVMO.props[ _firstColumnConfigColumnPropertyName ].displayValues ) {
                    treeTableDataService.updateVMODisplayName( modifiedVMO, _firstColumnConfigColumnPropertyName );
                }
            } );
        } );
    }
};

var _changeNodeStateToCollapsed = function( vmo, declViewModel ) {
    vmo.children = [];
    vmo.expanded = false;
    vmo.isLeaf = true;
    var gridId = Object.keys( declViewModel.grids )[0];
    awTableStateService.saveRowCollapsed( declViewModel, gridId, vmo );
    delete vmo.isExpanded;
};

var _getTreeNodesToRemove = function( vmo, declViewModel ) {
    var treeNodesToRemove = [];
    if( vmo.children && vmo.children.length > 0 ) {
        _.forEach( vmo.children, function( childVMO ) {
            var childTreeNodesToRemove = _getTreeNodesToRemove( childVMO, declViewModel );
            treeNodesToRemove = treeNodesToRemove.concat( childTreeNodesToRemove );
            childVMO.children = [];
            childVMO.expanded = false;
        } );
        treeNodesToRemove = treeNodesToRemove.concat( vmo.children );
        _changeNodeStateToCollapsed( vmo, declViewModel );
    }
    return treeNodesToRemove;
};

/**
 * Process the viewModelCollectionEvent
 *
 * @param {Object} event The viewModelCollectionEvent
 */
export let processViewModelCollectionEvent = function( vmc, data ) {
    var event = data.eventData;
    if( vmc ) {
        var treeNodesToRemove = [];
        var loadedVMObjects = vmc.getLoadedViewModelObjects();

        if( loadedVMObjects && loadedVMObjects.length > 0 ) {
            _.forEach( event.modifiedObjects, function( mo ) {
                _.forEach( loadedVMObjects, function( currentlyLoadedVmo ) {
                    if( mo.uid === currentlyLoadedVmo.uid ) {
                        //Update the display name
                        treeTableDataService.updateVMODisplayName( currentlyLoadedVmo, _firstColumnConfigColumnPropertyName );

                        // Understand the if the node is leaf or not
                        var numChildren = 0;
                        if( mo.props && mo.props.awb0NumberOfChildren &&
                            mo.props.awb0NumberOfChildren.dbValues &&
                            mo.props.awb0NumberOfChildren.dbValues.length ) {
                            numChildren = parseInt( mo.props.awb0NumberOfChildren.dbValues[ 0 ] );
                        }

                        var updatedObjectOfVmoHasNoChildren = numChildren === 0;

                        //update children status
                        if( currentlyLoadedVmo.isLeaf === false && updatedObjectOfVmoHasNoChildren ) {
                            if( currentlyLoadedVmo.children && currentlyLoadedVmo.children.length > 0 ) {
                                var childTreeNodesToRemove = _getTreeNodesToRemove( currentlyLoadedVmo, data );
                                treeNodesToRemove = treeNodesToRemove.concat( childTreeNodesToRemove );
                            }
                            _changeNodeStateToCollapsed( currentlyLoadedVmo, data );
                        } else if ( currentlyLoadedVmo.isLeaf === true && updatedObjectOfVmoHasNoChildren === false ) {
                            currentlyLoadedVmo.isLeaf = false;
                        }
                    }
                } );
            } );

            if( treeNodesToRemove && treeNodesToRemove.length > 0 ) {
                vmc.removeLoadedObjects( treeNodesToRemove );
            }
        }
    }
};

/**
 * @param {Object} loadedVMObjects all loaded view model objects whose visibility to be populated
 */
export let setOccVisibility = function( loadedVMObjects, contextKey, gridId ) {
    let viewKey = contextKey ? contextKey : appCtxSvc.ctx.aceActiveContext.key;
    let visibilityControlsCurrentValue = appCtxSvc.getCtx( viewKey + '.visibilityControls' );

    if( _.isArray( loadedVMObjects ) ) {
        var visibilityChangedVmos = [];
        var partialSelectionsToRemove = [];
        _.forEach( loadedVMObjects, function( target ) {
            var originalVisibility = target.visible;
            target.visible = occmgmtVisibilityService.getOccVisibility( cdmSvc.getObject( target.uid ), viewKey );
            if( originalVisibility !== target.visible ) {
                visibilityChangedVmos.push( target );
            }
            if( acePartialSelectionService.isHiddenNodePresentInPartialSelection( target.uid ) ) {
                partialSelectionsToRemove.push( target );
            }
        } );
        if( partialSelectionsToRemove.length > 0 ) {
            acePartialSelectionService.removePartialSelection( [], partialSelectionsToRemove );
        }
        let visibilityControlsNewValue = appCtxSvc.getCtx( viewKey + '.visibilityControls' );

        if( visibilityChangedVmos.length || !_.isEqual( visibilityControlsCurrentValue, visibilityControlsNewValue ) ) {
            //event should also take visibilityStateChangedVMOs and update process only this.
            eventBus.publish( gridId + '.plTable.visibilityStateChanged' );
        }
    }
};

export let initialize = function() {
    if( appCtxSvc.ctx.expandedNodes ) {
        _pciToExpandedNodesStableIdsMap = {};
        _expandedNodes = {};
        _expandedNodes.nodes = _.cloneDeep( appCtxSvc.ctx.expandedNodes );
        appCtxSvc.unRegisterCtx( 'expandedNodes' );
    }
};

export let destroy = function() {
    _pciToExpandedNodesStableIdsMap = {};
    _.keys( _expandedNodes ).map( function( key ) {
        delete _expandedNodes[ key ];
    } );
    _expandedNodes = {};
};

export let retainCurrentExpansionState = function( vmc ) {
    var expandedNodes = vmc.getLoadedViewModelObjects().filter( function( node ) {
        return node.isExpanded === true;
    } );
    appCtxSvc.updatePartialCtx( 'expandedNodes', expandedNodes );
};

export let updateOccMgmtTreeTableColumns = function( data, dataProvider, subPanelContext ) {
    let output = {};
    if( dataProvider && data.newColumnConfig ) {
        let contextState = {
            occContext: subPanelContext.occContext,
            key: subPanelContext.occContext.viewKey
        };
        var propColumns = data.newColumnConfig.columns;
        let clientColumns = !_.isEmpty( dataProvider.cols ) ? _.filter( dataProvider.cols, { clientColumn: true } ) : [];
        propColumns = clientColumns.length > 0 ? _.concat( clientColumns, propColumns ) : propColumns;
        exports.updateColumnPropsAndNodeIconURLs( propColumns, dataProvider.getViewModelCollection().getLoadedViewModelObjects(), contextState );
        data.newColumnConfig.columns = _.sortBy( propColumns, function( column ) { return column.columnOrder; } );
        dataProvider.columnConfig = data.newColumnConfig;
    }
    output.newColumnConfig = data.newColumnConfig;
    output.columnConfig = dataProvider.columnConfig;
    return output;
};

/**
 * In case of Saved Working Context in Tree view it can happen so that filter is applied to multiple products.<br>
 * The URL will have filter information only for the active product.<br>
 * If a non-active product is being expanded we check if its information is available in the cache and use it
 */
function updateFilterParamsOnInputForCurrentPciUid( currentPciUid, contextState ) {
    if( !contextState.context.requestPref.calculateFilters ) {
        return structureFilterService
            .computeFilterStringForNewProductContextInfo( currentPciUid );
    }
    return null;
}

var urlAttrs = browserUtils.getUrlAttributes();
_debug_logOccLoadActivity = urlAttrs.logOccLoadActivity !== undefined;

export default exports = {
    updateColumnPropsAndNodeIconURLs,
    loadTreeTableColumns,
    loadTreeTableData,
    loadTreeTableDataPage,
    loadOccurrencesWithFocusInTreeTable,
    loadNextOccurrencesInTreeTable,
    loadPreviousOccurrencesInTreeTable,
    loadTreeTableProperties,
    loadTreeTablePropertiesOnInitialLoad,
    getContextKeyFromParentScope,
    updateDisplayNames,
    processViewModelCollectionEvent,
    setOccVisibility,
    initialize,
    destroy,
    retainCurrentExpansionState,
    updateOccMgmtTreeTableColumns,
    clearCurrentPropBufferVmo,
    clearCurrentExpandBelowBufferVmo
};

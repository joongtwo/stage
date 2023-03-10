// Copyright (c) 2022 Siemens

/**
 * @module js/pca0ConstraintsGridService
 */
import addObjectUtils from 'js/addObjectUtils';
import appCtxService from 'js/appCtxService';
import awTableSvc from 'js/awTableService';
import cdm from 'soa/kernel/clientDataModel';
import commandPanelService from 'js/commandPanel.service';
import configuratorUtils from 'js/configuratorUtils';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import dataSourceService from 'js/dataSourceService';
import editHandlerFactory from 'js/editHandlerFactory';
import editHandlerService from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import { getBaseUrlPath } from 'app';
import localeService from 'js/localeService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import pca0ExpressionGridService from 'js/Pca0ExpressionGridService';
import pca0GridAuthoringService from 'js/pca0GridAuthoringService';
import preferenceService from 'soa/preferenceService';
import pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectSvc from 'js/viewModelObjectService';

import _ from 'lodash';
import tableSvc from 'js/published/splmTablePublishedService';

/**
 * Internal Settings Cache
 * It is inizialized when Grid Editor is loaded from SessionStorage (or default params)
 * It gets synced with SessionStorage when settings are changed
 * NOTE: cache is redundant, but it allows to avoid multiple queries to Session Storage
 */
let _settingsCache;

/**
 * Helps to prepare soaResponse as per newly object added in topGrid or bottomGrid
 * @param {*} topGridData - To check data added in topGrid
 * @param {*} bottomGridData - To check data added in bottomGrid
 * @param {*} soaResponse - To update new data in soaReponse
 */
let _prepareSoaResponseForNewlyAddedVariability = ( topGridData, bottomGridData, soaResponse ) => {
    let variabilityNodes = pca0CommonUtils.getVariabilityNodes( soaResponse );
    if( topGridData ) {
        for( const key in topGridData.viewModelObjectMap ) {
            if( !soaResponse.viewModelObjectMap[ key ] ) {
                soaResponse.viewModelObjectMap[ key ] = topGridData.viewModelObjectMap[ key ];
            }
            for( let index = 0; index < topGridData.variabilityNodes.length; index++ ) {
                let treeNode = _.find( variabilityNodes, ( variabilityNode ) => {
                    return _.isEqual( variabilityNode.nodeUid, topGridData.variabilityNodes[ index ].nodeUid ) &&
                    _.isEqual( variabilityNode.props.parentTree[ 0 ], topGridData.variabilityNodes[ index ].props.parentTree[ 0 ] );
                } );
                if( !treeNode ) {
                    variabilityNodes.push( topGridData.variabilityNodes[ index ] );
                }
            }
        }
    }

    if( bottomGridData ) {
        for( const key in bottomGridData.viewModelObjectMap ) {
            if( !soaResponse.viewModelObjectMap[ key ] ) {
                soaResponse.viewModelObjectMap[ key ] = bottomGridData.viewModelObjectMap[ key ];
            }
            for( let index = 0; index < bottomGridData.variabilityNodes.length; index++ ) {
                let treeNode = _.find( variabilityNodes, ( variabilityNode ) => {
                    return _.isEqual( variabilityNode.nodeUid, bottomGridData.variabilityNodes[ index ].nodeUid ) &&
                    _.isEqual( variabilityNode.props.parentTree[ 0 ], bottomGridData.variabilityNodes[ index ].props.parentTree[ 0 ] );
                } );
                if( !treeNode ) {
                    variabilityNodes.push( bottomGridData.variabilityNodes[ index ] );
                }
            }
        }
    }
};

/**
 * Initialize Settings Cache with Default values if something is not set
 * This can happen if new parameters are added to the Session Storage configuration at different times
 */
let _initMissingSettingsInCacheWithDefaultValues = () => {
    let [ showPropsInfoInGrid, showSubjectInTopGrid, columnWidth ] = appCtxService.getCtx( 'preferences' ).PCA_constraint_grid_settings ? appCtxService.getCtx( 'preferences' ).PCA_constraint_grid_settings : [ undefined, undefined, undefined ];
    if( showPropsInfoInGrid ) {
        showPropsInfoInGrid = showPropsInfoInGrid.split( ':' )[ 1 ].toLowerCase() === 'true';
    }
    if( showSubjectInTopGrid ) {
        showSubjectInTopGrid = showSubjectInTopGrid.split( ':' )[ 1 ].toLowerCase() === 'true';
    }
    if( columnWidth ) {
        columnWidth = Number( columnWidth.split( ':' )[ 1 ] );
        columnWidth = columnWidth > pca0CommonConstants.GRID_CONSTANTS.MAX_SLIDER_COLUMN_WIDTH ? pca0CommonConstants.GRID_CONSTANTS.MAX_SLIDER_COLUMN_WIDTH : columnWidth;
    }

    if( _.isUndefined( _settingsCache ) ) {
        _settingsCache = {}; // Session Storage has no content
    }
    if( _.isUndefined( _settingsCache.showPropsInfoInGrid ) ) {
        _settingsCache.showPropsInfoInGrid = !_.isUndefined( showPropsInfoInGrid ) ? showPropsInfoInGrid : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.SHOW_PROPERTIES_INFORMATION_IN_GRID;
    }
    if( _.isUndefined( _settingsCache.topTableHeight ) ) {
        _settingsCache.topTableHeight = veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.TOP_TABLE_HEIGHT;
    }
    if( _.isUndefined( _settingsCache.useCompactColumnWidth ) ) {
        if( columnWidth ) {
            _settingsCache.useCompactColumnWidth = columnWidth === pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH ? true : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.USE_COMPACT_COLUMN_WIDTH;
        } else {
            _settingsCache.useCompactColumnWidth = veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.USE_COMPACT_COLUMN_WIDTH;
        }
    }
    if( _.isUndefined( _settingsCache.columnWidth ) ) {
        _settingsCache.columnWidth = columnWidth ? columnWidth : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.COLUMN_WIDTH;
    }
    if( _.isUndefined( _settingsCache.showSubjectInTopGrid ) ) {
        _settingsCache.showSubjectInTopGrid = !_.isUndefined( showSubjectInTopGrid ) ? showSubjectInTopGrid : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.SHOW_SUBJECT_IN_TOP_GRID;
    }
};

/**
 * Generate Property Map for the ViewModel TreeNode
 * @param {ViewModelTreeNode} vmTreeNode - the treeNode to attach the map to
 * @param {Object} selectedObjects - To create property with selection column
 * @return {Object} propertyMap - map of ViewModelProperty objects for the treeNode
 * @param {String} parentTree - subject or condition
 */
let _generatePropertyMap = function( vmTreeNode, selectedObjects, parentTree ) {
    let propertyMap = {
        object_string: {
            uiValue: vmTreeNode.displayName,
            dbValue: [ 5 ]
        }
    };
    propertyMap[ Pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT ] = propertyMap.object_string;
    for( const key in selectedObjects ) {
        let propValue = selectedObjects[ key ][ parentTree + ':' + vmTreeNode.parentUID + ':' + vmTreeNode.nodeUid ] ?
            selectedObjects[ key ][ parentTree + ':' + vmTreeNode.parentUID + ':' + vmTreeNode.nodeUid ].selectionState : 0;
        propertyMap[ key ] = pca0VariabilityTreeDisplayService.getViewModelProperty( key, vmTreeNode.parentUID, propValue, {} );
        propertyMap[ key ].isSummarized = false;
    }

    if( !vmTreeNode.isParentFreeForm && !vmTreeNode.isParentEnumerated ) {
        propertyMap[ Pca0Constants.GRID_CONSTANTS.SOURCE_TYPE ] = pca0VariabilityTreeDisplayService.getViewModelProperty( Pca0Constants.GRID_CONSTANTS.SOURCE_TYPE,
            vmTreeNode.parentUID, vmTreeNode.type );
    }

    return propertyMap;
};

/**
 * Create View Model Tree Node for the Constraint object
 * @param {ViewModelTreeNode} sourceNode  source VM Tree Node
 * @param {ViewModelTreeNode} targetParentNode target Parent  VM Tree Node
 * @param {Integer} treeIndex tree family Index
 * @param {Integer} targetIndex target expected Index
 * @param {Object} targetVMC Target ViewModel Collection
 * @param {Boolean} isLeafNode  true if node is Leaf
 * @param {Object} selectedObjects - To create property with selection column
 * @param {Object} parentGridNode - To update parent nodes with its children uids
 * @returns {ViewModelTreeNode} constraint VM Tree node
 */
let _createConstraintTreeNode = ( sourceNode, targetParentNode, treeIndex, targetIndex, targetVMC, isLeafNode, selectedObjects, parentGridNode, parentTree ) => {
    let targetNode = awTableSvc.createViewModelTreeNode( sourceNode.uid,
        sourceNode.type, sourceNode.displayName, treeIndex, treeIndex, sourceNode.iconURL );
    let { uid } = sourceNode;
    let gridVMO = {};
    let gridNode = {
        childrenUids: [],
        isExpanded: !isLeafNode,
        nodeUid: uid,
        props: {
            isLeaf: [ isLeafNode ],
            parentTree : [ parentTree ]
        },
        parent: [ targetParentNode.uid ]
    };
    gridVMO[ uid ] = {
        displayName: sourceNode.displayName,
        props: sourceNode.props,
        sourceType: sourceNode.type,
        sourceUid: sourceNode.uid
    };
    targetNode.parentUID = targetParentNode.uid;
    if( isLeafNode ) {
        targetNode.alternateID = pca0CommonUtils.prepareUniqueId( targetParentNode.alternateID, sourceNode.uid );
    } else {
        targetNode.alternateID = pca0CommonUtils.prepareUniqueId( targetParentNode.uid, sourceNode.uid );
    }

    targetNode.props = _generatePropertyMap( sourceNode, selectedObjects, parentTree );
    targetNode.nodeUid = sourceNode.uid;
    targetNode.isLeaf = isLeafNode;
    targetVMC.splice( targetIndex, 0, targetNode );
    if( !targetParentNode.children ) {
        targetParentNode.children = [];
    }
    targetParentNode.children.push( targetNode );
    targetParentNode.isExpanded = true;
    if( !targetParentNode.childrenUids ) {
        targetParentNode.childrenUids = [];
    }
    targetParentNode.childrenUids.push( targetNode.uid );
    parentGridNode.childrenUids = targetParentNode.childrenUids;
    return { targetNode, gridVMO, gridNode };
};

/**
 *  Row background renderer
 */
let _rowBackgroundRenderer = {
    action: function( column, vmo, tableElem, rowElem ) {
        let cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );

        if( rowElem ) {
            rowElem.classList.add( 'aw-cfg-headerBackgroundCell' );
        }
        return cellContent;
    },
    condition: function( column, vmo ) {
        return vmo.isSpecialBackgroundCell;
    },
    name: '_rowBackgroundRenderer'
};

/**
 * Get the Viewport of the Top tree table
 * @returns {Object} ViewPort DOM instance for Top tree table
 */
let _getTopGridViewport = () => {
    let viewPort = null;
    let topTreeTable = document.getElementById( veConstants.GRID_CONSTANTS.TOP_CONSTRAINTS_GRID );
    if( topTreeTable ) {
        viewPort = tableSvc.getTableScrollBar( topTreeTable );
    }
    return viewPort;
};

/**
 * Get the Viewport of the Bottom tree table
 * @returns {Object} ViewPort DOM instance for Bottom tree table
 */
let _getBottomGridViewport = () => {
    let viewPort = null;
    let bottomTreeTable = document.getElementById( veConstants.GRID_CONSTANTS.BOTTOM_CONSTRAINTS_GRID );
    if( bottomTreeTable ) {
        viewPort = tableSvc.getTableScrollBar( bottomTreeTable );
    }
    return viewPort;
};

/**
 * Callback function to scroll Horizontally the Top grid
 * based on the scroll position in Bottom grid.
 * @param {object} event object containing the scroll event information
 */
let _scrollFirstTableCallbackFn = ( event ) => {
    let topTableViewPort = _getTopGridViewport();
    if( topTableViewPort ) {
        topTableViewPort.scrollLeft = event.currentTarget.scrollLeft;
    }
};

/**
 * Update selection maps on grid data as per settings
 * @param {Object} topGridData data we want to update in topGrid
 * @param {Object} bottomGridData data we want to update botoomGrid
 * @param {Boolean} changeDataInGrids - To update data in grids
 * @return {Object} Object with topGrid and bottomGrid
 */
let _updateGridDataAsPerSettings = ( topGridData, bottomGridData, changeDataInGrids ) => {
    const topBusinessObjectToSelectionMap = topGridData.businessObjectToSelectionMap;
    const topBkpOfBusinessObjectMap = topGridData.backupOfBusinessObjectToSelectionMap;
    const bottomBusinessObjectToSelectionMap = bottomGridData.businessObjectToSelectionMap;
    const bottomBkpOfBusinessObjecMap = bottomGridData.backupOfBusinessObjectToSelectionMap;
    let topData = {};
    let bottomData = {};
    if( _settingsCache.showPropsInfoInGrid && _settingsCache.showSubjectInTopGrid ) {
        topGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID, veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ];
        bottomGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ];
    } else if( _settingsCache.showPropsInfoInGrid && !_settingsCache.showSubjectInTopGrid ) {
        topGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID, veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ];
        bottomGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ];
    } else if( !_settingsCache.showPropsInfoInGrid && _settingsCache.showSubjectInTopGrid ) {
        topGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ];
        bottomGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ];
    } else if( !_settingsCache.showPropsInfoInGrid && !_settingsCache.showSubjectInTopGrid ) {
        topGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ];
        bottomGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ];
    }
    if( changeDataInGrids ) {
        topGridData.businessObjectToSelectionMap = _.cloneDeep( bottomBusinessObjectToSelectionMap );
        topGridData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( bottomBkpOfBusinessObjecMap );
        bottomGridData.businessObjectToSelectionMap = _.cloneDeep( topBusinessObjectToSelectionMap );
        bottomGridData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( topBkpOfBusinessObjectMap );
    } else {
        topGridData.businessObjectToSelectionMap = _.cloneDeep( topBusinessObjectToSelectionMap );
        topGridData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( topBkpOfBusinessObjectMap );
        bottomGridData.businessObjectToSelectionMap = _.cloneDeep( bottomBusinessObjectToSelectionMap );
        bottomGridData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( bottomBkpOfBusinessObjecMap );
    }
    exports.updateTopTableHeight( 0 ); // To set top table height as inherit
    topData = { ...topGridData };
    bottomData = { ...bottomGridData };
    return { topData, bottomData };
};

let _setConstraintsGridSettingsInPreference = function( settingsMap ) {
    let constraintsSettings =  [];

    let preferenceConstraintsSettings = [ 'showPropsInfoInGrid', 'showSubjectInTopGrid', 'columnWidth' ];
    _.forEach( preferenceConstraintsSettings, ( preferenceConstraintsSettings ) => {
        constraintsSettings.push( preferenceConstraintsSettings + ':' + String( settingsMap[ preferenceConstraintsSettings ] ) );
    } );
    preferenceService.setStringValues( [ veConstants.PCA_CONSTRAINT_GRID_SETTINGS_PREFERENCE ], [ constraintsSettings ] );
};

/**
 * Grid Save Handler
 * NOTE: this must be an internal variable as it is accessed by external services to get correct saveHandler instance
 */
var m_saveHandler;

/**

/**
 * Function to populate selected object for Constraints Grid Editor.
 * @return {Array} Selected objects in Primary work Area.
 * If Cfg0ProductItem or Cfg0Dictionary is selected, then it returns empty array.
 */
let _getSelectedObjetsForConstraintsGrid = ( ) => {
    let selectedObjectsInPWA = pca0CommonUtils.getSelectedObjectsForSOA( veConstants.CONSTRAINTS_CONTEXT_KEY );
    let configuratorContextFound = false;
    // There is no possibilty that we will get more than 1 selected objects where one of the object is Cfg0ProductItem or Cfg0Dictionary.
    if ( selectedObjectsInPWA.length === 1 && ( selectedObjectsInPWA[0].type === Pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_ITEM ||
        selectedObjectsInPWA[0].type === Pca0Constants.CFG_OBJECT_TYPES.TYPE_DICTIONARY ) ) {
        configuratorContextFound = true;
    }
    return configuratorContextFound === true ? [] : selectedObjectsInPWA;
};

/**
 * Close the add variability panel.
 * @param {Object} panelPinned to close panel when it is unpinned
 */
let closeAddVariabilityPanel = function( panelPinned ) {
    if( !panelPinned ) {
        var eventData = {
            source: 'toolAndInfoPanel'
        };
        eventBus.publish( 'complete', eventData );
    }
};
/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Initialize required details for Constraints grids
 * @param {Object} declViewModel - VM Object
 */
export let initConstraintsGridEditor = function( declViewModel ) {
    var configContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    if( configContext ) {
        configContext[ veConstants.CONSTRAINTS_CONTEXT_KEY ] = {};

        // Set autoEdit mode for Constraints Grid
        configContext.autoEditMode = true;
        appCtxService.updateCtx( veConstants.CONFIG_CONTEXT_KEY, configContext );

        // Initialize Edit handler
        declViewModel.data.constraintsEditHandler = editHandlerFactory.createEditHandler( dataSourceService
            .createNewDataSource( {
                declViewModel: declViewModel
            } ) );

        // Add new method to identify editing context
        declViewModel.data.constraintsEditHandler.getEditHandlerContext = () => {
            return veConstants.CONFIG_CONTEXT_KEY;
        };

        // Re-define Cancel Edits
        // this is called when Edit Mode is de-activated
        // Call explicitly method to resync maps and reset Edit mode
        declViewModel.data.constraintsEditHandler.cancelEdits = () => {
            let vmGridData = declViewModel.atomicDataRef;
            exports.handleCancel( vmGridData );
        };

        editHandlerService.setEditHandler( declViewModel.data.constraintsEditHandler, veConstants.GRID_CONSTANTS.CONSTRAINTS_EDITOR_TREE_CONTEXT );

        // Initialize Save Handler
        m_saveHandler = {
            isDirty: () => {
                let atomicDataRef = declViewModel.atomicDataRef;
                let topGridData = { ...atomicDataRef.topGrid.getAtomicData() };
                let bottomGridData = { ...atomicDataRef.bottomGrid.getAtomicData() };

                return !_.isEqual( topGridData.businessObjectToSelectionMap, topGridData.backupOfBusinessObjectToSelectionMap ) ||
                    !_.isEqual( bottomGridData.businessObjectToSelectionMap, bottomGridData.backupOfBusinessObjectToSelectionMap );
            },
            saveEdits: function() {
                eventBus.publish( 'Pca0ConstraintsGridEditorViewModel.saveEdits' );
            }
        };
    }
};

/**
 * sets grid data to empty
 * @param {Object} topGridDataProp - View Model Atomic Data <topGrid>
 * @param {Object} bottomGridDataProp - View Model Atomic Data <bottomGrid>
 */
export let initGridData = ( topGridDataProp, bottomGridDataProp ) => {
    let topGridData = { ...topGridDataProp.getAtomicData() };
    topGridData.gridNodes = [];
    topGridData.businessObjectToSelectionMap = {};
    topGridData.backupOfBusinessObjectToSelectionMap = {};
    topGridData.viewModelObjectMap = {};
    topGridData.variabilityNodes = [];
    topGridDataProp.setAtomicData( topGridData );

    let bottomGridData = { ...bottomGridDataProp.getAtomicData() };
    bottomGridData.gridNodes = [];
    bottomGridData.businessObjectToSelectionMap = {};
    bottomGridData.backupOfBusinessObjectToSelectionMap = {};
    bottomGridData.viewModelObjectMap = {};
    bottomGridData.variabilityNodes = [];
    bottomGridDataProp.expandAll = true;
    bottomGridDataProp.setAtomicData( bottomGridData );
};


/**
 * Populate Internal Settings Cache (from Session Storage or default values)
 * @param {Object} topGridData - View Model Atomic Data <topGrid>
 * @param {Object} bottomGridData - View Model Atomic Data <bottomGrid>
 */
export let initSettingsCache = ( topGridData, bottomGridData ) => {
    // Query Session Storage and initialize values from Storage if available
    _settingsCache = {}; // Clear cache before re-initializing
    let configuratorContextUID = pca0ConfiguratorExplorerCommonUtils.getConfiguratorContextUID();
    let settingsMap = pca0ConfiguratorExplorerCommonUtils.getConstraintsEditorSettingsMapFromSessionStorage();
    if( settingsMap.hasOwnProperty( configuratorContextUID ) ) {
        _settingsCache = settingsMap[ configuratorContextUID ];
    }

    // empty the top and bottom grid atomic data
    initGridData( topGridData, bottomGridData );

    // Use default values if something is not set (i.e. parameters added a different times)
    _initMissingSettingsInCacheWithDefaultValues();
};

/**
 * Registers a scroll event listener
 * When scroll action is performed on Bottom grid,
 * then scroll the Top grid based on the scroll position.
 */
export let registerScrollSync = () => {
    let bottomTableViewPort = _getBottomGridViewport();
    if( bottomTableViewPort ) {
        bottomTableViewPort.addEventListener( 'scroll', _scrollFirstTableCallbackFn );
    }
};

/**
 * Destroy global object or unregister hooks or events
 */
export let gridUnmount = function( ) {
    let configContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    let bottomTableViewPort = _getBottomGridViewport();
    if( configContext ) {
        delete configContext[ veConstants.CONSTRAINTS_CONTEXT_KEY ];
        appCtxService.updateCtx( veConstants.CONFIG_CONTEXT_KEY, configContext );
    }

    // Remove the scroll event listener
    if( bottomTableViewPort ) {
        bottomTableViewPort.removeEventListener( 'scroll', _scrollFirstTableCallbackFn );
        bottomTableViewPort = null;
    }
};

/**
 * Customize Header appearance for Top grid header cells
 * Show/Hide icon(s) for Properties Informations for constraint header cell
 * @param {Object} column - the column object
 * @return {Object} data container to initialize Extended Tooltip component for column
 */
export let populateTopGridHeader = ( column ) => {
    if( column.isTreeNavigation || column.isSplitColumn ) {
        return {};
    }
    let showPropsInfoInGrid = _settingsCache.showPropsInfoInGrid;
    let headerIconUrl = getBaseUrlPath() + '/image/indicatorInfo16.svg';

    let tooltipDetails = {};
    let constraintType = {};
    if( !_.isUndefined( column.props[ veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID ] ) ) {
        constraintType = { ...column.props[ veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID ] };
    }

    if( !showPropsInfoInGrid ) {
        tooltipDetails.propertiesList = [];

        Object.entries( column.props ).forEach( ( [ propKey, propValue ] ) => {
            let propertyDisplayName = propValue.propDisplayName;
            let vmProp = uwPropertyService.createViewModelProperty(
                propKey, // propertyName
                propertyDisplayName, // propertyDisplayName
                'STRING', // dataType
                propValue.propDisplayValue, // dbValue
                [ propValue.propDisplayValue ] // displayValuesIn
            );

            vmProp.fielddata = {
                propertyDisplayName: propertyDisplayName,
                uiValue: propValue.propDisplayValue
            };
            tooltipDetails.propertiesList.push( vmProp );
        } );
    }
    return { constraintType, showPropsInfoInGrid, headerIconUrl, tooltipDetails };
};

/**
 * Reflect applied changes in column width from Top grid into Bottom grid
 * @param {UwDataProvider} gridDataProvider Bottom Table Data provider
 * @param {Object} eventData the eventData info container
 * @returns {Object} - New ColumnConfig to be dispatched
 */
export let handleColumnArrange = ( gridDataProvider, eventData ) => {
    let newColumnInfos = [ ...gridDataProvider.columnConfig.columns ];
    _.forEach( newColumnInfos, columnInfo => {
        columnInfo.width = _.find( eventData.columns, { name: columnInfo.name } ).drawnWidth;
    } );

    return {
        columnConfig: {
            columns: [ ...newColumnInfos ]
        }
    };
};

/**
 * This function helps to prepare soa input require to fetch constraints expression
 * @returns {Object} Required for getVariantExpressionData3
 */
export let prepareSOAInputToGetConstraints = function() {
    const source = appCtxService.getCtx( 'state.processed.uid' );
    const configContext = { uid: source, type: 'unknownType' };
    let selectedObjectsInPWA = _getSelectedObjetsForConstraintsGrid();
    return {
        configContextProvider: '',
        configContext: configContext,
        // configure context have config perspective so use it for constraints grid
        configPerspective: pca0CommonUtils.getConfigPerspective( veConstants.CONFIG_CONTEXT_KEY ),
        selectedObjects: selectedObjectsInPWA,
        currentExpandedFamilies: '',
        filters: {
            intentFilters: [],
            optionFilter: 'pca0_show_current' // It will always current in constraints
        },
        requestInfo:  selectedObjectsInPWA.length === 0 ? {
            showEmptyConstraintsGrid: [ 'True' ]
        } : {}
    };
};

/**
 * Initialize Settings Panel with data from internal Settings Cache
 * @returns {Object} Initialization data info container
 */
export let initializeSettingsPanel = () => {
    return _settingsCache;
};

/**
 * Apply Settings
 * Compare values with settingsCache which was initialized from Session Storage (or default values)
 * Synchronize Session Storage
 * @param {Object} viewModel - Settings Panel ViewModel data
 */
export let applySettings = ( viewModel ) => {
    // NOTE: need to implement smart logic like FSC Settings Panel
    // to check on actual changes.
    // Here we simply look for 'valueUpdated' flag and compare values
    // flag is still true if user makes a change then reverts value to original

    // Show 'Properties Information'
    if( viewModel.data.showPropsInfoInGrid.valueUpdated &&
        viewModel.data.showPropsInfoInGrid.dbValue !== _settingsCache.showPropsInfoInGrid ) {
        _settingsCache.showPropsInfoInGrid = viewModel.data.showPropsInfoInGrid.dbValue;
        eventBus.publish( 'Pca0ConstraintsGrid.showPropertiesInformationChanged' );
    }

    // Column Width
    // Adjust column Width on both tables
    let columnWidthChanged = false;
    if( viewModel.data.useCompactColumnWidth.valueUpdated &&
        viewModel.data.useCompactColumnWidth.dbValue !== _settingsCache.useCompactColumnWidth ) {
        _settingsCache.useCompactColumnWidth = viewModel.data.useCompactColumnWidth.dbValue;
        columnWidthChanged = true;
    }
    if( viewModel.data.columnWidth.dbValue[ 0 ].sliderOption.value !== _settingsCache.columnWidth ) {
        _settingsCache.columnWidth = viewModel.data.columnWidth.dbValue[ 0 ].sliderOption.value;
        columnWidthChanged = true;
    }
    if( columnWidthChanged ) {
        let newColumnWidth;
        if( _settingsCache.useCompactColumnWidth ) {
            newColumnWidth = pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH;
        } else {
            newColumnWidth = _settingsCache.columnWidth;
        }
        eventBus.publish( 'Pca0ConstraintsGrid.updateColumnWidth', newColumnWidth );
    }

    // Show Subject in Top Grid
    if( viewModel.data.showSubjectInTopGrid.valueUpdated &&
        viewModel.data.showSubjectInTopGrid.dbValue !== _settingsCache.showSubjectInTopGrid ) {
        _settingsCache.showSubjectInTopGrid = viewModel.data.showSubjectInTopGrid.dbValue;
        eventBus.publish( 'Pca0ConstraintsGrid.sectionsConfigurationChanged', { changeDataInGrids: true } );
    }

    // Sync Session Storage
    let configuratorContextUID = pca0ConfiguratorExplorerCommonUtils.getConfiguratorContextUID();
    let settingsMap = pca0ConfiguratorExplorerCommonUtils.getConstraintsEditorSettingsMapFromSessionStorage();
    settingsMap[ configuratorContextUID ] = { ..._settingsCache };
    sessionStorage.setItem( veConstants.CONSTRAINTS_EDITOR_SETTINGS, JSON.stringify( settingsMap ) );

    _setConstraintsGridSettingsInPreference( settingsMap[ configuratorContextUID ] );

    // Close panel
    eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
};

/**
 * Handle 'Expand All'/'Collapse All' action
 * - Set 'expandAll' and dispatch atomic data changes
 * - Fire event to reload the tables
 * No need to fire special events as we are updating atomicData.
 * @param {Object} eventData - subject/condition
 * @param {Object} topGridData - View Model Atomic Data <topGrid>
 * @param {Object} bottomGridData - View Model Atomic Data <bottomGrid>
 */
export let handleExpandCollapseAllAction = ( eventData, topGridData, bottomGridData ) => {
    if( eventData.grid === 'subject' && _settingsCache.showSubjectInTopGrid ||
        eventData.grid === 'condition' && !_settingsCache.showSubjectInTopGrid ) {
        let topData = { ...topGridData.getAtomicData() };
        topData.expandAll = eventData.actionType === 'expand';
        topGridData.setAtomicData( topData );
    } else if( eventData.grid === 'subject' && !_settingsCache.showSubjectInTopGrid ||
        eventData.grid === 'condition' && _settingsCache.showSubjectInTopGrid ) {
        let bottomData = { ...bottomGridData.getAtomicData() };
        bottomData.expandAll = eventData.actionType === 'expand';
        bottomGridData.setAtomicData( bottomData );
    }
};

/**
 * Helps to update summary of provided node
 * @param {ViewModelTreeNode} viewModelTreeNode ViewModelTreeNode toggled in the grid
 * @param {UwDataProvider} treeDataProvider - DataProvider to be initialized/loaded
 * @param {Object} gridData - To get selection map with respective to topGrid/bottomGrid
 * @param {Object} viewModelObjectMap - From soaResponse we use it to read display name of feature
 */
export let updateSummary = function( viewModelTreeNode, treeDataProvider, gridData, viewModelObjectMap ) {
    var vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    var updatedVMOs = [ ...vmos ];
    let vmo = _.find( updatedVMOs, { nodeUid: viewModelTreeNode.nodeUid } );

    let gridProps = gridData.getValue ? gridData.getValue() : gridData.getAtomicData();

    // Update VMOs
    pca0CommonUtils.updateViewModelTreeNodeSummary(
        gridProps.businessObjectToSelectionMap, // selectionMap
        vmo, // viewModelTreeNode,
        viewModelObjectMap
    );
    if( !viewModelTreeNode.isExpanded ) {
        // Call dispatch on data provider
        treeDataProvider.vmCollectionDispatcher( {
            type: 'COLLECTION_REPLACE',
            viewModelObjects: updatedVMOs,
            totalFound: updatedVMOs.length
        } );
    }
};

/**
 * Adjust Height of Header Cells to show/hide 'Properties Information' icons/tooltips
 * @param {Object} vmData - VM Object
 * @param {Boolean} changeDataInGrids - True when user changes settings to show subject in top or bottom
 */
export let handleShowPropertiesInformationChanged = ( vmData, changeDataInGrids ) => {
    let topGridData = vmData.topGrid.getAtomicData();
    let bottomGridData = vmData.bottomGrid.getAtomicData();
    let { topData, bottomData } = _updateGridDataAsPerSettings( topGridData, bottomGridData, changeDataInGrids );
    vmData.topGrid.setAtomicData( topData );
    vmData.bottomGrid.setAtomicData( bottomData );
    eventBus.publish( 'Pca0ConstraintsGrid.RefreshTopHeader' );
    eventBus.publish( 'topConstraintsGrid.plTable.reload' );
    eventBus.publish( 'bottomConstraintsGrid.plTable.reload' );
};

/**
 * This function helps to initialize grids which are coming under constraint editors
 * @param {Object} soaResponse response from SOA
 * @param {Object} vmData declarative data
 * isMultiGrid helps to identify we are using this component with multiple grid editor
 * For topGrid must be use aw-grid-editor component as it contains header, context menu
 * For any lower grids should use aw-grid-helper which will sync HR scroll of top grid and itself
 * Lower grids dont have header to show them as part of topGrid
 * if multiGrid is false then there is no need of aw-grid-helper
 * @return {Boolean} if initialzed then true or false
 */
export let getVariabilityData = function( soaResponse, vmData ) {
    if( soaResponse.partialErrors || soaResponse.ServiceData && soaResponse.ServiceData.partialErrors ) {
        pca0CommonUtils.processPartialErrors( soaResponse.ServiceData );
        return false;
    }

    let variability = { ...vmData.variabilityProps.getAtomicData() };
    let selectedExpressions = configuratorUtils.convertSelectedExpressionJsonStringToObject( soaResponse.selectedExpressions );
    let clonedExpressions = { ...selectedExpressions };
    let topGridData = { ...vmData.topGrid.getAtomicData() };
    let bottomGridData = { ...vmData.bottomGrid.getAtomicData() };
    let selectedObjects = _getSelectedObjetsForConstraintsGrid();
    const variabilityNodesFromResponse = pca0CommonUtils.getVariabilityNodes( soaResponse );
    soaResponse.variabilityPropertiesToDisplay = [];
    soaResponse.selectedExpressions = {};

    _.forEach( selectedObjects, ( selectedObject ) => {
        soaResponse.selectedExpressions[ selectedObject.uid ] = clonedExpressions[ selectedObject.uid ];
    } );

    // Populate businessObjectToSelectionMap and get Column Properties
    let { columnProperties, columnSplitIDsMap, businessObjectToSelectionMap, subjectSelectionMap, conditionSelectionMap } =
     pca0VariabilityTreeDisplayService.getColumnPropsAndSelectionMap(
         pca0CommonConstants.GRID_CONSTANTS.CONSTRAINTS_GRID,
         soaResponse
     );

    // Add custom properties to column definitions:
    // 1) columnWidth property as per Settings Cache (already initialized)
    // 2) rowBackgroundRender
    let columnWidth = pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH;
    if( _settingsCache.useCompactColumnWidth ) {
        columnWidth = pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH;
    } else {
        columnWidth = _settingsCache.columnWidth;
    }
    let { topData, bottomData } = _updateGridDataAsPerSettings( topGridData, bottomGridData, conditionSelectionMap );

    // Why cloneDeep? change in these below variables may lead to change in actual SoaResponse data which can be catastrophic.
    const subjectNode = _.cloneDeep( _.find( variabilityNodesFromResponse, ( variabilityNode ) => _.isEqual( variabilityNode.nodeUid,  veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ) ) );
    const conditionNode = _.cloneDeep( _.find( variabilityNodesFromResponse, ( variabilityNode ) => _.isEqual( variabilityNode.nodeUid, veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ) ) );
    const subjectVMO = _.cloneDeep( soaResponse.viewModelObjectMap[veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID] );
    const conditionVMO = _.cloneDeep( soaResponse.viewModelObjectMap[veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID] );
    if( _settingsCache.showSubjectInTopGrid ) {
        topData.businessObjectToSelectionMap = _.cloneDeep( subjectSelectionMap );
        topData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( subjectSelectionMap );
        bottomData.businessObjectToSelectionMap = _.cloneDeep( conditionSelectionMap );
        bottomData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( conditionSelectionMap );
        if ( topData.variabilityNodes.length === 0 ) {
            // this is only first time
            topData.variabilityNodes.push( { ...subjectNode } );
            topData.viewModelObjectMap[veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID] = { ...subjectVMO };
            bottomData.variabilityNodes.push( { ...conditionNode } );
            bottomData.viewModelObjectMap[veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID] = { ...conditionVMO };
        }
    } else if( !_settingsCache.showSubjectInTopGrid ) {
        topData.businessObjectToSelectionMap = _.cloneDeep( conditionSelectionMap );
        topData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( conditionSelectionMap );
        bottomData.businessObjectToSelectionMap = _.cloneDeep( subjectSelectionMap );
        bottomData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( subjectSelectionMap );
        if ( topData.variabilityNodes.length === 0 ) {
            // this is only first time
            bottomData.variabilityNodes.push( { ...subjectNode } );
            bottomData.viewModelObjectMap[veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID] = { ...subjectVMO };
            topData.variabilityNodes.push( { ...conditionNode } );
            topData.viewModelObjectMap[veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID] = { ...conditionVMO };
        }
    }
    _.forEach( columnProperties, columnProps => {
        columnProps.columnWidth = columnWidth;
        columnProps.cellRenderers = [ _rowBackgroundRenderer ];
    } );
    variability.soaResponse = { ...soaResponse };
    variability.columnProperties = [ ...columnProperties ];
    vmData.variabilityProps.setAtomicData( variability );
    vmData.topGrid.setAtomicData( topData );
    vmData.bottomGrid.setAtomicData( bottomData );
    return true;
};

/**
 * Get tree result and required column config using provided inputs.
 * @param {Object} treeLoadInput - nodeBeingExpanded for the Tree Table
 * @param {UwDataProvider} gridDataProvider - DataProvider to be initialized/loaded
 * @param {Object} variabilityData - View Model Atomic Data <variabilityProps>
 * @param {Object} gridProps - Properiteis for respective grid
 * @param {Object} vmGridSelectionState - To identify and pass to get new column if required
 * @returns {Object} TreeLoadResult for the Tree Table
 */
export let loadBottomGridDataProvider = ( treeLoadInput, gridDataProvider, variabilityData, gridProps, vmGridSelectionState ) => {
    if( !treeLoadInput ) {
        return {};
    }
    let gridData = gridProps.getAtomicData();
    let variability = variabilityData.getAtomicData();
    let subsetUIDs = gridData.gridNodes;
    const { treeResult, columnConfig } = pca0GridAuthoringService.prepareColConfigAndTreeData( variability, gridDataProvider, subsetUIDs, vmGridSelectionState, treeLoadInput, gridData, true );
    return {
        treeLoadResult: treeResult,
        treeColumnConfig: columnConfig,
        parentNode: treeLoadInput
    };
};

/**
 * LIVE Update top table height
 * @param {Object} dbValue slider dbValue to update to tree height
 * @returns {Boolean} value has been updated
 */
export let updateTopTableHeight = ( dbValue ) => {
    let topTreeTableRowElement = document.getElementsByClassName( 'aw-cfg-topTreeHeight' );
    if( dbValue ) {
        topTreeTableRowElement[ 0 ].style.height = dbValue[ 0 ].sliderOption.value + '%';
        _settingsCache.topTableHeight =  dbValue[ 0 ].sliderOption.value;
    } else {
        topTreeTableRowElement[ 0 ].style.height = 'inherit';
    }
    return true;
};

/**
 * LIVE Update Width of all Table Columns
 * @param {Object} dbValue slider dbValue to update to tree height
 * @returns {Boolean} value has been updated
 */
export let updateAllColumnsWidth = ( dbValue ) => {
    // Live Update TODO
    // Here, we just return a temp flag to state slider value has been changed
    // Question was posted in the channel as 'valueUpdated' is not set to true when user changes value in the slider
    return true;
};

/**
 * Update Width of all Table Columns
 * Action is performed when user clicks on "Apply" button in Settings Panel
 * @param {Object} columnWidth - Column Width (px)
 * @param {Array} treeDataProvider - Data provider for Constraints Grid Editor
 * @param {Object} variabilityProps - Atomic Data variabilityData
 * @returns {Object} - New Column Configuration to be dispatched on both grids
 */
export let updateColumnWidth = function( columnWidth, treeDataProvider, variabilityProps ) {
    let columnConfig = { columns: [] };
    let colConfig = [ ...treeDataProvider.columnConfig.columns ];
    _.forEach( colConfig, columnInfo => {
        if( columnInfo.name !== 'variabilityContent' ) {
            columnInfo.width = columnWidth;
            columnInfo.minWidth = pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH;
            columnInfo.maxWidth = pca0CommonConstants.GRID_CONSTANTS.MAX_COLUMN_WIDTH;
        }
    } );
    columnConfig.columns = colConfig;

    // update variabilityData/ variabilityProps which is used to construct columnConfig
    //for loadBottomGridDataProvider and loadGridDataProvider
    let variabilityData = { ...variabilityProps.getValue ? variabilityProps.getValue() : variabilityProps.getAtomicData() };
    _.forEach( variabilityData.columnProperties, columnInfo => {
        if( columnInfo.name !== 'variabilityContent' ) {
            columnInfo.columnWidth = columnWidth;
        }
    } );
    variabilityProps.setAtomicData ? variabilityProps.setAtomicData( variabilityData ) : variabilityProps.update( variabilityData );

    return { columnConfig };
};

/**
 * Populate Input required for SetVariantExpressionData SOA.
 * @param {Object} variabilityData - View Model Atomic Data <variabilityProps>
 * @returns {Object} Selected Expressions PCAGrid
 */
export let getConstraintsExpressionData = function( variabilityData ) {
    let topGridData = { ...variabilityData.topGrid.getAtomicData() };
    let bottomGridData = { ...variabilityData.bottomGrid.getAtomicData() };

    let updatedVariabilityProps = { ...variabilityData.variabilityProps.getAtomicData() };
    // Copy deep as we do not want to update actual businessObjectToSelectionMap. we just want to remove unedited constraints from selection maps for Save.s
    let topGridSelectionMap = _.cloneDeep( topGridData.businessObjectToSelectionMap );
    let bottomGridSelectionMap = _.cloneDeep( bottomGridData.businessObjectToSelectionMap );

    if( !_.isUndefined( topGridSelectionMap ) ) {
        // Object.keys( topGridSelectionMap ) contains all the constraints loaded in the Grid editor
        let uneditedConstraints =  _.difference( Object.keys( topGridSelectionMap ), updatedVariabilityProps.dirtyElements );

        // Remove now unedited constraints from selection maps and pass only those constraints for save who have some selection change.
        for( const index in uneditedConstraints ) {
            delete topGridSelectionMap[uneditedConstraints[ index ] ];
            delete bottomGridSelectionMap[uneditedConstraints[ index ] ];
        }
    }
    if ( _settingsCache.showSubjectInTopGrid ) {
        return pca0ExpressionGridService.getPCAGridWithMultipleSectionsFromSelectionMap( topGridSelectionMap, bottomGridSelectionMap );
    }
    return pca0ExpressionGridService.getPCAGridWithMultipleSectionsFromSelectionMap( bottomGridSelectionMap, topGridSelectionMap );
};

/**
 * API to handle Cancel Edits. It resets the businessObjectToSelectionMap using backup.
 * As we are updating variabilityProps.soaResponse, treedata will be reloaded.
 * @param {Object} vmGridData - View Model Atomic Data for view model
 */
export let handleCancel = function( vmGridData ) {
    let topGridData = { ...vmGridData.topGrid.getAtomicData() };
    let bottomGridData = { ...vmGridData.bottomGrid.getAtomicData() };
    let variabilityPropsData = { ...vmGridData.variabilityProps.getAtomicData() };
    let variabilityNodesFromResponse = [];
    let subjectChildrenDiff = [];
    let conditionChildrenDiff = [];
    let subjectGridData = {};
    let conditionGridData = {};
    let subjectNodeFromSoaResponse = {};
    let conditionNodeFromSoaResponse = {};
    // reset dirty elements.
    variabilityPropsData.dirtyElements = [];

    //update soaResponse to show recently added feature and family
    if ( !_.isUndefined( variabilityPropsData.soaResponse ) ) {
        variabilityNodesFromResponse = pca0CommonUtils.getVariabilityNodes( variabilityPropsData.soaResponse );
        if ( _settingsCache.showSubjectInTopGrid ) {
            subjectGridData = topGridData.viewModelObjectMap[veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID];
            conditionGridData = bottomGridData.viewModelObjectMap[veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID];
        } else {
            subjectGridData = topGridData.viewModelObjectMap[veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID];
            conditionGridData = bottomGridData.viewModelObjectMap[veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID];
        }
        subjectNodeFromSoaResponse = _.find( variabilityNodesFromResponse, ( nodeData ) => {
            return nodeData.nodeUid === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID;
        } );
        conditionNodeFromSoaResponse = _.find( variabilityNodesFromResponse, ( nodeData ) => {
            return nodeData.nodeUid === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID;
        } );

        // This will update changes in variabilityNodes of soaResponse
        if ( _.isUndefined( subjectNodeFromSoaResponse.childrenUids ) && subjectGridData ) {
            subjectChildrenDiff = subjectGridData.childrenUids;
            subjectNodeFromSoaResponse.childrenUids = subjectChildrenDiff ? [ ...subjectChildrenDiff ] : [];
        } else {
            subjectChildrenDiff = subjectGridData && subjectGridData.childrenUids ? _.difference( subjectGridData.childrenUids, subjectNodeFromSoaResponse.childrenUids ) : undefined;
            subjectNodeFromSoaResponse.childrenUids = subjectChildrenDiff ? [ ...subjectNodeFromSoaResponse.childrenUids, ...subjectChildrenDiff ] : subjectNodeFromSoaResponse.childrenUids;
        }

        if ( _.isUndefined( conditionNodeFromSoaResponse.childrenUids ) && conditionGridData ) {
            conditionChildrenDiff = conditionGridData.childrenUids;
            conditionNodeFromSoaResponse.childrenUids = conditionChildrenDiff ? [ ...conditionChildrenDiff ] : [];
        } else {
            conditionChildrenDiff = conditionGridData && conditionGridData.childrenUids ? _.difference( conditionGridData.childrenUids, conditionNodeFromSoaResponse.childrenUids ) : undefined;
            conditionNodeFromSoaResponse.childrenUids = conditionChildrenDiff ? [ ...conditionNodeFromSoaResponse.childrenUids, ...conditionChildrenDiff ] : conditionNodeFromSoaResponse.childrenUids;
        }
    }


    vmGridData.variabilityProps.setAtomicData( variabilityPropsData );

    // Maps: revert to backup Maps
    if( !_.isEqual( topGridData.businessObjectToSelectionMap, topGridData.backupOfBusinessObjectToSelectionMap ) ) {
        topGridData.businessObjectToSelectionMap = _.cloneDeep( topGridData.backupOfBusinessObjectToSelectionMap );
        vmGridData.topGrid.setAtomicData( topGridData );
        eventBus.publish( 'topConstraintsGrid.plTable.reload' );
    }
    if( !_.isEqual( bottomGridData.businessObjectToSelectionMap, bottomGridData.backupOfBusinessObjectToSelectionMap ) ) {
        bottomGridData.businessObjectToSelectionMap = _.cloneDeep( bottomGridData.backupOfBusinessObjectToSelectionMap );
        vmGridData.bottomGrid.setAtomicData( bottomGridData );
        eventBus.publish( 'bottomConstraintsGrid.plTable.reload' );
    }
    // reset IS_VARIANT_TREE_IN_EDIT_MODE
    appCtxService.updateCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false );
};

/**
 * Return custom save Handler (as per contribution saveHandlers.json)
 * @return {Object} save handler
 */
export let getSaveHandler = function() {
    return m_saveHandler;
};

/**
 * API to handle Start Edits.
 * Edit Handler editing state needs to be updated so as leaveConfirmation processes correct state
 * NOTE: this is not needed in VCV-grid (where auto edit mode is set) because there is no sync between PWA selection and SWA content
 * @param {Object} editHandler - instance of constraints edit handler
 */
export let handleStartEdits = function( editHandler ) {
    // Set Active Edit handler Context
    editHandlerService.setActiveEditHandlerContext( veConstants.GRID_CONSTANTS.CONSTRAINTS_EDITOR_TREE_CONTEXT );

    // Add to the appCtx about the editing state: alternative of setting editHandler.startEdit();
    // This way we are not using native edit mode template for cells
    editHandler._editing = true;
    appCtxService.updateCtx( 'editInProgress', true );
};

/**
 * API to do post processing of Save. It resets the backupOfBusinessObjectToSelectionMap using backup.
 * As we are updating variabilityProps.soaResponse, treedata will be reloaded.
 * @param {Object} vmGridData - View Model Atomic Data with respctive to top/bottom tree
 */
export let postProcessSaveEdits = function( vmGridData ) {
    let topGridData = { ...vmGridData.topGrid.getAtomicData() };
    let bottomGridData = { ...vmGridData.bottomGrid.getAtomicData() };

    // update Back up of selections with saved data.
    if( !_.isEqual( topGridData.businessObjectToSelectionMap, topGridData.backupOfBusinessObjectToSelectionMap ) ) {
        topGridData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( topGridData.businessObjectToSelectionMap );
        vmGridData.topGrid.setAtomicData( topGridData );
    }
    if( !_.isEqual( bottomGridData.businessObjectToSelectionMap, bottomGridData.backupOfBusinessObjectToSelectionMap ) ) {
        bottomGridData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( bottomGridData.businessObjectToSelectionMap );
        vmGridData.bottomGrid.setAtomicData( bottomGridData );
    }
    // reset dirty elements.
    let variabilityPropsData = { ...vmGridData.variabilityProps.getAtomicData() };
    variabilityPropsData.dirtyElements = [];

    vmGridData.variabilityProps.setAtomicData( variabilityPropsData );

    // reset IS_VARIANT_TREE_IN_EDIT_MODE
    appCtxService.updateCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false );
};

/**
 * Convert selected expression json object to selected expression json string array.
 * for ex.
 * {
 * objectUid1:  [ ConfigExprSet: [] ],
 * objectUid2: [ ConfigExprSet: [] ],
 * objectUid3: [ ConfigExprSet: [] ]
 * }
 * will be converted to
 *
 * [
 * { objectUid1: [ ConfigExprSet: [] ] },
 * { objectUid2: [ ConfigExprSet: [] ] },
 * { objectUid3: [ ConfigExprSet: [] ] }
 * ]
 * @param {Object} variabilityData - Variability Data
 * @returns {Array} Array of json string of selected expressions.
 */
export let convertConstraintsExpressionDataToJsonString = function( variabilityData ) {
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( exports.getConstraintsExpressionData( variabilityData ) );
};

/**
 * Add created variability data to SPLM table
 * @param {Object} eventData event data info container
 * @param {UwDataProvider} targetDataProvider  target DataProvider
 * @param {Object} gridData To update data w.r.t grids
 * @param {Object} variabilityProps atomic Data
 */
export let addVariabilityToConstraintTree = function( eventData, targetDataProvider, gridData, variabilityProps ) {
    let { parentNode, selected } = eventData;
    let gridProps = gridData.getValue ? gridData.getValue() : gridData.getAtomicData();
    let variabilityData =  { ...variabilityProps.getValue ? variabilityProps.getValue() : variabilityProps.getAtomicData() };
    let selectedObjects = gridProps.businessObjectToSelectionMap;
    let gridVMOs = gridProps.viewModelObjectMap;
    let gridNodes = gridProps.variabilityNodes;

    /*
    example:

    Consider subject grid containing following:
                Incl Rule1
    Fam1
        Feat1      TICK
        Feat2      TICK

    Consider I select Feat3 of Fam1 from Pick And Choose Panel

    The "selected" variable will contain VMOs of - Feat1, Feat2, Feat3
    The "selectedObjects" variable will contain selection map of Feat1 and Feat2
    */

    pca0ConfiguratorExplorerCommonUtils.removeSelectedObjects( selected, selectedObjects, true );
    if( !parentNode.isExpanded ) {
        eventBus.publish( targetDataProvider.name + '.expandTreeNode', {
            parentNode: parentNode
        } );
    }

    // Filter only features and families from the selection
    let sourceFeatureAndFamilyNodesSelectedToAdd = selected.filter( ( obj ) => {
        return Pca0Constants.CFG_FAMILY_FEATURES_TYPES.some( ( val ) => obj.modelType ? obj.modelType.typeHierarchyArray.includes( val ) : false );
    } );

    // Convert the user selection to a map
    // Key              Value
    // Parent Node      Array of child Nodes
    let sourceTreeMap = {};
    let sourceFamilyNodeList = [];
    let sourceFeatureNodeList = [];
    _.forEach( sourceFeatureAndFamilyNodesSelectedToAdd, ( node ) => {
        let isFamilyType = Pca0Constants.CFG_FAMILY_TYPES.some( ( val ) => node.modelType.typeHierarchyArray.includes( val ) );
        if( isFamilyType ) {
            sourceFamilyNodeList.push( node );
        } else {
            sourceFeatureNodeList.push( node );
        }
    } );

    _.forEach( sourceFamilyNodeList, ( familyNode ) => {
        let thisFamilyFeatureNodes = _.intersection( familyNode.children, sourceFeatureNodeList );
        sourceTreeMap[ familyNode.uid ] = thisFamilyFeatureNodes;
        //Remove the allocated features from the features list
        if( sourceFeatureNodeList.length > 0 ) {
            _.remove( sourceFeatureNodeList, ( feature ) => {
                return _.indexOf( thisFamilyFeatureNodes, feature ) !== -1;
            } );
        }
    } );

    // Pending features if any are the ones which are selected without selecting its parent, i.e family
    if( sourceFeatureNodeList.length > 0 ) {
        _.forEach( sourceFeatureNodeList, ( featureNode ) => {
            let { parentUID } = featureNode;
            if( parentUID in sourceTreeMap ) {
                let featureNodes = sourceTreeMap[ parentUID ];
                featureNodes.push( featureNode );
            } else {
                sourceTreeMap[ parentUID ] = [ featureNode ];
            }
        } );
    }

    let targetVMC = targetDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let expectedIndx = targetDataProvider.getViewModelCollection().findViewModelObjectById( parentNode.alternateID ) + 1;
    let familyIndx = 1;
    let featureIndx = familyIndx + 1;
    // Iterate over treemap and add to target dataprovider
    let familiesToAdd = Object.keys( sourceTreeMap );
    _.forEach( familiesToAdd, ( familyUid ) => {
        let featureNodesToAdd = sourceTreeMap[ familyUid ];
        // Check if family exists in target
        let targetFamilyNode = _.find( targetVMC, { alternateID: parentNode.nodeUid + ':' + familyUid } );
        let familyGridVMO = {};
        let familyGridNode = {};
        if( !targetFamilyNode ) {
            // Add family node
            let sourceFamilyNode = _.find( sourceFamilyNodeList, { uid: familyUid } );
            if( !sourceFamilyNode ) {
                // Load Family before proceeding
                sourceFamilyNode = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( familyUid ), 'EDIT' );
                sourceFamilyNode.displayName = _.get( sourceFamilyNode, 'props.object_name.uiValue' );
                sourceFamilyNode.iconURL = sourceFamilyNode.typeIconURL;
            }
            const result = _createConstraintTreeNode( sourceFamilyNode, parentNode, familyIndx, expectedIndx, targetVMC, false, selectedObjects, familyGridNode, parentNode.uid  );
            targetFamilyNode = result.targetNode;
            familyGridVMO = result.gridVMO;
            familyGridNode = result.gridNode;
            gridVMOs[ sourceFamilyNode.uid ] = familyGridVMO[ sourceFamilyNode.uid ];
            gridNodes.push( familyGridNode );
            if( parentNode.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID || parentNode.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ) {
                gridVMOs[parentNode.uid].childrenUids = [ ...parentNode.childrenUids ];
                gridVMOs[parentNode.uid].children = [ ...parentNode.children ];
            }
        }

        let featureExpectedIndx = targetVMC.indexOf( targetFamilyNode ) + 1;
        // Add features if they do no exist in target
        _.forEach( featureNodesToAdd, ( featureNode ) => {
            let targetFeatureNode = _.find( targetVMC, { alternateID: parentNode.nodeUid + ':' + familyUid + ':' + featureNode.uid } );
            if( !targetFeatureNode ) {
                const { targetFeatureNode, gridVMO, gridNode } = _createConstraintTreeNode( featureNode, targetFamilyNode, featureIndx,
                    featureExpectedIndx, targetVMC, true, selectedObjects, familyGridNode, parentNode.uid  );
                featureExpectedIndx += 1;
                gridVMOs[ featureNode.uid ] = gridVMO[ featureNode.uid ];
                gridNodes.push( gridNode );
            }
        } );
    } );

    let soaResponse = variabilityData.soaResponse;

    // update soaResponse variabilityTreeData and ViewModelObjectMap with the values present in gridProps
    _prepareSoaResponseForNewlyAddedVariability( gridProps /* gridProps can be topGridData or bottomGridData depending on for which table Pick and choose is selected for.*/, undefined, soaResponse );

    variabilityProps.setAtomicData ? variabilityProps.setAtomicData( { ...variabilityData } ) : variabilityProps.update( { ...variabilityData } );
    gridData.setAtomicData ? gridData.setAtomicData( { ...gridProps } ) : gridData.update( { ...gridProps } );
    // Finally update the target data provider
    targetDataProvider.update( targetVMC );
    closeAddVariabilityPanel( eventData.isPanelPinned );
};

/**
 * Open Pick&Choose command panel
 * @param {Object} commandContext Command context
 * @param {String} commandId panel id to activate the command panel
 * @param {String} location location name
 * @param {Object} config additional info container
 */
export let openPickAndChoosePanel = ( commandContext, commandId, location, config ) => {
    // TODO needs refactor
    // 1) selectedData is never initialized: do initialization here and avoid 'Pca0Constraints.launchAddVariabilityPanel'
    // also clean view model

    if( commandContext.selectedData ) {
        // Command invoked from grid cell
        config.selectedObjects = commandContext.selectedData;
        config.sidenavMode = 'desktop';
        commandPanelService.activateCommandPanel( commandId, location, commandContext, null, null, config );
    } else {
        let topGrid = true;
        //Command invoked from toolbar
        if ( _.get( commandContext, 'anchor' ) === 'aw_topGridEditor_splmTable_commandsMenu' ) {
            topGrid = true;
        } else if ( _.get( commandContext, 'anchor' ) === 'aw_bottomGridEditor_splmTable_commandsMenu' ) {
            topGrid = false;
        } else if ( _.get( commandContext, 'command.id' ) === 'Pca0SubjectGridActions' ) {
            topGrid = _settingsCache.showSubjectInTopGrid;
        } else {
            topGrid = !_settingsCache.showSubjectInTopGrid;
        }
        commandContext.isTopGrid = topGrid;
        let eventData = {
            commandContext,
            commandId,
            location,
            config
        };
        eventBus.publish( 'Pca0Constraints.launchAddVariabilityPanel', eventData );
    }
};

/**
 * Init CommandContext object dor "Add Variability" panel
 * @param {Object} eventData  event Data info container
 * @param {UwDataProvider} dataProvider tree data provider
 * @param {Object} gridData grid data to get selected or present data in grid editor
 * @returns {Object} commandContext
 */
export let populateCommandContextForAddVariabilityPanel = ( eventData, dataProvider, gridData ) => {
    let selectedData = new Set();
    _.forEach( gridData.backupOfBusinessObjectToSelectionMap, mapObject => {
        _.forEach( mapObject, selection => {
            selection.family && selection.nodeUid ? selectedData.add( selection.family + ':' + selection.nodeUid ) : false;
        } );
    } );
    let parentVMO;
    const vmos = dataProvider.getViewModelCollection().getLoadedViewModelObjects();
    _.forEach( vmos, ( vmoData ) => {
        if ( vmoData.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID || vmoData.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ) {
            parentVMO = vmoData;
        } else {
            // here we create id with family and feature uid only we don't require uid of subject to add into it
            const alternatedID =  vmoData.parentUID + ':' + vmoData.uid;
            selectedData.add( alternatedID );
        }
    } );

    // What if the features are collapsed in grid editor? We won't get those VMOS in dataProvider. Hence, those will not be shown as ticked in Pick and choose panel.
    // Fortunately, we have all the newly added features in gridData variabilityNodes.
    _.forEach( gridData.variabilityNodes, ( variabilityNode ) => {
        if( variabilityNode.nodeUid && variabilityNode.parent ) {
            const alternatedID =  variabilityNode.parent[ 0 ] + ':' + variabilityNode.nodeUid;
            selectedData.add( alternatedID );
        }
    } );
    eventData.commandContext.selectedData = [ ...selectedData ];
    eventData.commandContext.vmo = parentVMO;
    return eventData.commandContext;
};

/**
 * Open 'Add Constraint' fly-out panel
 * Build panelContext with relevant information to initialize sub-components
 * @param {Object} commandContext Command context
 * @param {String} commandId panel id to activate the command panel
 * @param {String} location location name
 * @param {Object} config additional configuration info container
 */
export let openAddConstraintPanel = ( commandContext, commandId, location, config ) => {
    let panelContext = {
        availableConstraintTypes: commandContext.variabilityProps.availableConstraintTypes,
        variabilityTreeData: commandContext.variabilityProps.getValue().soaResponse.variabilityTreeData,
        baseSelection: _.get( commandContext, 'context.baseSelection' ) ?
            _.get( commandContext, 'context.baseSelection' ) : _.get( commandContext, 'vmo' )
    };
    commandPanelService.activateCommandPanel( commandId, location, panelContext, null, null, config );
};

/**
 * Return list of available constraint types
 * If data is not cached, trigger event to load them from AW Server
 * @param {Object} panelContext 'Add Constraint' panel context
 * @returns {Array} list of loaded available constraint types
 */
export let initAddConstraintPanel = function( panelContext ) {
    if( panelContext.availableConstraintTypes.length === 0 ) {
        eventBus.publish( 'Pca0ConstraintsGridEditor.loadConstraintTypes' );
    }
    return panelContext.availableConstraintTypes;
};

/**
 * Update shared Constraint Data
 * This will avoid a SOA call if 'Add Constraint' panel is reopened in Constraints view
 * @param {Array} constraintTypes list of constraint types
 * @param {Object} vmData GridEditor ViewModel data
 */
export let cacheLoadedConstraintTypes = ( constraintTypes, vmData ) => {
    let updatedVariabilityProps = { ...vmData.variabilityProps.getAtomicData() };
    updatedVariabilityProps.availableConstraintTypes = [ ...constraintTypes ];
    vmData.variabilityProps.setAtomicData( updatedVariabilityProps );
};

/**
 * Get Property Policy for Constraint Rule being created
 * Dynamically build Policy based on Properties Information received from getVariantExpressionData3 SOA response
 * @param {String} selectedConstraintType selected constraint type
 * @param {Array} variabilityTreeData Variability Nodes
 * @returns {String} registered policy ID
 */
export let getConstraintGridEditorPolicyTypes = ( selectedConstraintType, variabilityTreeData ) => {
    let types = [ {
        name: selectedConstraintType,
        properties: []
    } ];

    // Get Properties Information nodes
    // They will be used to build policy
    let propInfoUIDs = pca0CommonUtils.getPropertiesInformationUIDs( variabilityTreeData );
    _.forEach( propInfoUIDs, propUID => {
        types[ 0 ].properties.push( { name: propUID } );
    } );
    return types;
};

/**
 * Prepare the SOA input to create a new Constraint
 * Add ProductItem to the input
 * @param {Object} data the ViewModel data of the Add Constraint Panel
 * @param {Object} panelContext panel context
 * @param {Object} editHandler for the fly-out panel
 * @returns {Object} createRelateAndSubmitObjects SOA input
 */
export let getConstraintCreateInput = ( data, panelContext, editHandler ) => {
    let input = addObjectUtils.getCreateInput(
        data,
        null, {
            props: {
                type_name: {
                    dbValues: [ data.selectedConstraintType.dbValue ]
                }
            }
        },
        editHandler );
    let productItem = _.get( panelContext, 'baseSelection.uid' );
    if( input && input.length > 0 ) {
        input[ 0 ].createData.propertyNameValues.cfg0ProductItems = [ productItem ];
    }
    return input;
};

/**
 * Get created constraint rule from SOA response
 * @param {Object} soaResponse - createRelateAndSubmitObjects SOA response
 * @returns {Object} created Constraint Rule
 */
export let getCreatedConstraint = ( soaResponse ) => {
    if( !_.isUndefined( soaResponse.ServiceData.created ) ) {
        var constraintUID = soaResponse.ServiceData.created[ 0 ];
        return soaResponse.ServiceData.modelObjects[ constraintUID ];
    }
};

/**
 * Post process created Constraint, update maps
 * @param {Object} constraintModelObject created constraint
 * @param {Object} vmData GridEditor ViewModel data
 */
export var postProcessCreatedConstraint = ( constraintModelObject, vmData ) => {
    // Clone current status for VM data and fields (atomic data)
    let variability = { ...vmData.variabilityProps.getAtomicData() };
    let topGridData = { ...vmData.topGrid.getAtomicData() };
    let bottomGridData = { ...vmData.bottomGrid.getAtomicData() };

    let soaResponse = variability.soaResponse;
    _prepareSoaResponseForNewlyAddedVariability( topGridData, bottomGridData, soaResponse );

    // Update list of new constraints
    variability.newConstraints.push( constraintModelObject );

    // Create new Column Property
    // Add custom properties to column definitions:
    // 1) columnWidth property as per Settings Cache (already initialized)
    // 2) rowBackgroundRender
    let objectName = _.get( constraintModelObject, 'props.object_string.uiValues[0]' );
    let constraintUID = constraintModelObject.uid;

    let columnWidth = pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH;
    if( _settingsCache.useCompactColumnWidth ) {
        columnWidth = pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH;
    } else {
        columnWidth = _settingsCache.columnWidth;
    }
    let newColumnProperties = {
        gridID: pca0CommonConstants.GRID_CONSTANTS.CONSTRAINTS_GRID,
        columnWidth: columnWidth,
        cellRenderers: [ _rowBackgroundRenderer ],
        originalColumnName: constraintUID,
        propertyDisplayName: objectName,
        propertyName: constraintUID,
        propertyUid: constraintUID,
        enableColumnMenu: false,
        isSplitColumn: false,
        newConstraintColumnProps: {}
    };

    // Build column properties:
    // 1. get the list of properties needed (query the available 'Properties Information' nodes from getVariantExpressionData3 'viewModelObjectMap')
    // 2. Query created constraint for such properties
    // This way, other props returned in ServiceData are filtered
    // Build locale Text bundle for 'Properties Information'
    let localePropInfoMap = pca0GridAuthoringService.getPropInfoFromSOAResponse( variability.soaResponse );

    let propInfoNode = _.find( variability.soaResponse.variabilityTreeData, { nodeUid: veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID } );
    if( !_.isUndefined( propInfoNode ) && !_.isUndefined( propInfoNode.childrenUids ) ) {
        _.forEach( propInfoNode.childrenUids, internalPropKey => {
            // Not all constraints contain all properties requested (e.g. DefaultRule has no message/severity)
            if( Object.keys( constraintModelObject.props ).includes( internalPropKey ) ) {
                newColumnProperties.newConstraintColumnProps[ internalPropKey ] = {
                    // response.ServiceData contains Properties Information [internalKey + localized uiValue], e.g.:
                    // object_type: {dbValues: ["Cfg0DefaultRule"], uiValues: ["Localized Constraint Type"]}
                    // Re-arrange structure to accommodate localized Property Display Name, e.g.:
                    // {object_type: {propDisplayName: 'Type', propDisplayValue: 'Localized Constraint Type', sourceType:'Cfg0DefaultRule'}}
                    propDisplayName: localePropInfoMap[ internalPropKey ],
                    propDisplayValue: constraintModelObject.props[ internalPropKey ].uiValues[ 0 ],
                    sourceType: constraintModelObject.props[ internalPropKey ].dbValues[ 0 ]
                };
            }
        } );
    }

    let columnProperties = [ ...variability.columnProperties ];
    columnProperties.splice( 0, 0, newColumnProperties );

    // Update selection maps
    topGridData.businessObjectToSelectionMap[ constraintUID ] = {};
    topGridData.backupOfBusinessObjectToSelectionMap[ constraintUID ] = {};
    bottomGridData.businessObjectToSelectionMap[ constraintUID ] = {};
    bottomGridData.backupOfBusinessObjectToSelectionMap[ constraintUID ] = {};

    variability.columnProperties = columnProperties;
    vmData.variabilityProps.setAtomicData( variability );
    vmData.topGrid.setAtomicData( topGridData );
    vmData.bottomGrid.setAtomicData( bottomGridData );
    exports.updateTopTableHeight( 0 ); // To set top table height as inherit
};

/**
 * Update ViewModel Collection for the Data Provider
 * Add new Constraint in the props list of each ViewModel Object node
 * @param {String} constraintUID UID of created constraint
 * @param {UwDataProvider} treeDataProvider DataProvider to be initialized/loaded
 */
export let addNewConstraintToVMC = function( constraintUID, treeDataProvider ) {
    var vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let updatedVMOs = [ ...vmos ];
    _.forEach( updatedVMOs, vmo => {
        vmo.props[ constraintUID ] = pca0VariabilityTreeDisplayService.getViewModelProperty( constraintUID, vmo.parentUID, 0, {} );
    } );
};

/**
 * Update tree Data provider for properties section
 * which are received in eventData when we make changes in properties through Info Panel
 * NOTE: This function will be called when
 * 1. Tooltip is not visible
 * 2. Tooltip is visible. Why are we calling this function even while tooltip is visible?
 *  We don't want treeProvider's columnConfig ( which contains props ) and variabilityData to get out of sync when tooltip is updated
 * @param {Object} eventData eventData
 * @param {UwDataProvider} treeDataProvider DataProvider to be initialized/loaded
 * @param {Object} variabilityProps atomic tree data
 *
 */
export let updateGridPropertiesSectionFromInfoPanel = function( eventData, treeDataProvider, variabilityProps ) {
    let xrtVMO = eventData.getValue().xrtVMO;
    let constraintUidToBeUpdated = xrtVMO.uid;

    let variabilityData = { ...variabilityProps.getValue() };
    let variabilityTreeData = variabilityData.soaResponse.variabilityTreeData;
    let viewModelObjectMap = variabilityData.soaResponse.viewModelObjectMap;

    if( _.isUndefined( constraintUidToBeUpdated ) || _.isUndefined( viewModelObjectMap[ constraintUidToBeUpdated ] ) ) {
        return;
    }

    // Following properties will be updated which we receive as children of __Pca0_Constraints_Properties_Section__
    let propertyUids = _.find( variabilityTreeData, ( variabilityNode ) => _.isEqual( variabilityNode.nodeUid, veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID ) ).childrenUids;


    // update view model object map with latest values which we receive from Info panel
    _.forEach( propertyUids, ( propertyUid ) => {
        if( xrtVMO.props[ propertyUid ] && viewModelObjectMap[ constraintUidToBeUpdated ] ) {
            viewModelObjectMap[ constraintUidToBeUpdated ].props[ propertyUid ] = xrtVMO.props[ propertyUid ].displayValues;
        }
    } );

    //We update variabilityData with the latest values which we receive from info panel even if we are showing tooltip.
    //Reason - When we switch the properties section visibility from Settings, we have to show updated value there as well
    variabilityProps.update( variabilityData );
    // update props of columnConfig with the props value of eventData
    if( treeDataProvider.columnConfig && treeDataProvider.columnConfig.columns ) {
        let colToBeUpdated = _.find( treeDataProvider.columnConfig.columns, ( col ) => _.isEqual( col.uid, constraintUidToBeUpdated ) );
        _.forOwn( colToBeUpdated.props, ( value, property ) => {
            if( xrtVMO.props[ property ] ) {
                colToBeUpdated.props[ property ].propDisplayValue = xrtVMO.props[ property ].displayValues[ 0 ];
            }
        } );
    }

    // update the VMOs with values we received in eventData.
    if( _settingsCache.showPropsInfoInGrid ) {
        let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
        let updatedVMOs = [ ...vmos ];
        _.forEach( updatedVMOs, vmo => {
            if( propertyUids.includes( vmo.uid ) ) {
                let cloneVmo = _.cloneDeep( vmo );
                cloneVmo.props[ constraintUidToBeUpdated ].prevDisplayValues = xrtVMO.props[ vmo.uid ].prevDisplayValues;
                cloneVmo.props[ constraintUidToBeUpdated ].displayValues = xrtVMO.props[ vmo.uid ].displayValues;
                cloneVmo.props[ constraintUidToBeUpdated ].dbValue = xrtVMO.props[ vmo.uid ].displayValues;
                cloneVmo.props[ constraintUidToBeUpdated ].value = xrtVMO.props[ vmo.uid ].value;
                cloneVmo.props[ constraintUidToBeUpdated ].uiValue = xrtVMO.props[ vmo.uid ].uiValue;
                let nodeIndex = treeDataProvider.getViewModelCollection().findViewModelObjectById( vmo.uid );
                updatedVMOs[ nodeIndex ] = cloneVmo;
            }
        } );
        treeDataProvider.update( updatedVMOs );
    }
};

/**
 * Update Tooltip for properties section
 * which are received in eventData from Info panel
 * @param {Object} eventData eventData
 * @param {UwDataProvider} column The column of table
 */
export let updateGridPropertiesTooltipFromInfoPanel = function( eventData, column ) {
    if( _.isUndefined( eventData ) || _.isUndefined( column ) ) {
        return;
    }

    let xrtVMO = eventData.getValue().xrtVMO;
    if( !_.isEqual( xrtVMO.uid, column.uid ) ) {
        return;
    }

    let colToBeUpdated = column.props;
    // update the column property with eventData values.
    _.forOwn( colToBeUpdated, ( value, property ) => {
        if( xrtVMO.props[ property ] ) {
            colToBeUpdated[ property ].propDisplayValue = xrtVMO.props[ property ].displayValues[ 0 ];
        }
    } );

    if( !_settingsCache.showPropsInfoInGrid ) {
        eventBus.publish( 'Pca0ConstraintsGrid.RefreshTopHeader' );
    }
};

/**
 * This function helps to update variability selected in feature and model tab
 * @param {Object} updatedSelection - Collection of VMOs selected in specific tab
 * @param {Object} variabilitySelected - Collection of VMOs selected in feature and model tab
 * @param {String} tabKey - Have details of active tab features or models
 */
export let updateVariabilitySelection = ( updatedSelection, variabilitySelected, tabKey ) => {
    const newSelection = updatedSelection.selected;
    let variabilityData = variabilitySelected.getValue();
    if ( tabKey === 'tc_xrt_Models' ) {
        variabilityData.modelsSelected = newSelection;
    } else {
        variabilityData.featureSelected = newSelection;
    }
    variabilityData.vmoSelected = [ ...variabilityData.modelsSelected, ...variabilityData.featureSelected ];
    variabilitySelected.update( variabilityData );
};

/**
 * Helps to get selected expressions ids from gridEditor
 * @param {Object} constraintsData - Constrains context object
 * @param {Object} variabilitySelected - To
 * @returns {Array} Returns collection with familyUid:nodeUid
 */
export const getVariabilitySelectedInGridEditor = ( constraintsData, variabilitySelected ) => {
    if ( constraintsData.selectedData ) {
        let variability = variabilitySelected.getValue();
        variability.vmoSelected = []; // setting to empty
        variabilitySelected.update( variability );
        return constraintsData.selectedData;
    }
};

/*
* API to display error message to the user when number of constraints selected are greater than 500.
  There are performance reasons like Server can take lot of time to return expressions if number of constraints selected are really huge.
  AW client can also go out of memory while rendering response in this case. Hence we are restricting.
* Once this message is shown , we set ConfiuratorContext as Selected object and show empty grid.
*/
export let showMessageIfLargeNumberOfConstraintsSelected = function(  ) {
    var configContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    let configuratorContextUID = configContext.configPerspective.props.cfg0ProductItems.dbValues[0];
    var configContextVmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( configuratorContextUID ), 'EDIT' );

    let selectedVmos = [];
    selectedVmos.push( configContextVmo );

    appCtxService.updateCtx( 'selected', selectedVmos );
    appCtxService.updateCtx( 'mselected', selectedVmos );

    configuratorUtils.showNotificationMessage( localeService.getLoadedText( 'ConfiguratorExplorerMessages' ).Pca0NoOfConstraintsInGridEditor, 'ERROR' );
};

export default exports = {
    initConstraintsGridEditor,
    initSettingsCache,
    registerScrollSync,
    gridUnmount,
    populateTopGridHeader,
    handleColumnArrange,
    prepareSOAInputToGetConstraints,
    initializeSettingsPanel,
    applySettings,
    handleExpandCollapseAllAction,
    updateSummary,
    handleShowPropertiesInformationChanged,
    getVariabilityData,
    loadBottomGridDataProvider,
    updateTopTableHeight,
    updateAllColumnsWidth,
    updateColumnWidth,
    getConstraintsExpressionData,
    handleCancel,
    getSaveHandler,
    handleStartEdits,
    postProcessSaveEdits,
    convertConstraintsExpressionDataToJsonString,
    addVariabilityToConstraintTree,
    openPickAndChoosePanel,
    populateCommandContextForAddVariabilityPanel,
    openAddConstraintPanel,
    initAddConstraintPanel,
    cacheLoadedConstraintTypes,
    getConstraintGridEditorPolicyTypes,
    getConstraintCreateInput,
    getCreatedConstraint,
    postProcessCreatedConstraint,
    addNewConstraintToVMC,
    updateGridPropertiesSectionFromInfoPanel,
    updateGridPropertiesTooltipFromInfoPanel,
    updateVariabilitySelection,
    getVariabilitySelectedInGridEditor,
    showMessageIfLargeNumberOfConstraintsSelected,
    initGridData
};

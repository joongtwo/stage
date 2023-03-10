// <TODO> remove below complexity ignore lines and address the issue
// Complexity check is temporarily commented to ease readability
/* eslint-disable complexity */
/* eslint-disable sonarjs/cognitive-complexity */

// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0VariabilityTreeDisplayService
 */
import actionService from 'js/actionService';
import { getBaseUrlPath } from 'app';
import appCtxService from 'js/appCtxService';
import assert from 'assert';
import awIconSvc from 'js/awIconService';
import awTableService from 'js/awTableService';
import configuratorUtils from 'js/configuratorUtils';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import declUtils from 'js/declUtils';
import enumFeature from 'js/pca0EnumeratedFeatureService';
import eventBus from 'js/eventBus';
import iconSvc from 'js/iconService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import Pca0VariabilityTreeEditService from 'js/Pca0VariabilityTreeEditService';
import Pca0VCAUtils from 'js/pca0VCAUtils';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';
import tableSvc from 'js/published/splmTablePublishedService';

const _selectedString = configuratorUtils.getCustomConfigurationLocaleTextBundle().selected;
const _excludedString = configuratorUtils.getCustomConfigurationLocaleTextBundle().excluded;


/*
 *   Internal functions
 */

/**
 * Build Column Definition for TreeNavigation column, including renderers.
 * @param {String} contextKey - context key
 * @param {String} propertyName - Name of property for TreeNavigation column
 * @param {String} propertyDisplayName - Display Name of property for TReeNavigation column
 * @param {Number} width - width for the column
 * @param {Boolean} enableColumnMenu - true if columnMenu is enabled
 * @param {UwDataProvider} treeDataProvider - Tree data provider
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 * @return {Object} Column Definition
 */
let _createVariabilityColumnDef = function( contextKey, propertyName, propertyDisplayName, width, enableColumnMenu, treeDataProvider, vmGridSelectionState ) {
    var columnInfo = {
        name: propertyName,
        displayName: propertyDisplayName,
        minWidth: width,
        width: width,
        enableColumnMenu: enableColumnMenu, // Menu can be disabled, i.e. hidden header in Constraints Grid Editor
        pinnedLeft: true,
        enableColumnHiding: false, // disable command "Hide Column",
        isTreeNavigation: true
    };

    // Add cell renderer for "Variability Content" (previously "Filter") column
    if( propertyName === Pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT ) {
        columnInfo.cellRenderers = [ exports.filterCellRenderer( Pca0VariabilityTreeEditService.handleCellClick, contextKey, treeDataProvider, vmGridSelectionState ) ];
    }
    return columnInfo;
};

/**
 * Generate Property Map for the ViewModel TreeNode
 * @param {ViewModelTreeNode} vmTreeNode - the treeNode to attach the map to.
 * @param {Object} soaResponse - cached SOA response
 * @param {Object} backupSelectionMap - backup SelectionMap (Used when creating nodes in Edit Mode)
 * @param {Object} gridData -  [Constraints Grid editor only] Subject Or Condition selection map
 * @param {Array} additionalColumns - [Constraints Grid editor only] additional Columns added after loading (not available in soaResponse)
 * @return {Object} propertyMap - map of ViewModelProperty objects for the treeNode
 */
let _generatePropertyMap = function( vmTreeNode, soaResponse, backupSelectionMap, gridData, additionalColumns ) {
    let propertyMap = {
        object_string: {
            uiValue: vmTreeNode.displayName,
            dbValue: [ 5 ]
        }
    };

    // 'VariabilityContent' is the first column and this property needs to be populated in order to display
    // a cell command within that column for e.g command to pick and choose variability for "Subject" node in
    // Constraint grid.
    propertyMap[ Pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT ] = propertyMap.object_string;

    if( !vmTreeNode.isParentFreeForm && !vmTreeNode.isParentEnumerated ) {
        let viewModelObject = soaResponse.viewModelObjectMap[ vmTreeNode.nodeUid ];
        propertyMap[ Pca0Constants.GRID_CONSTANTS.SOURCE_TYPE ] = exports.getViewModelProperty( Pca0Constants.GRID_CONSTANTS.SOURCE_TYPE, vmTreeNode.parentUID, viewModelObject.sourceType );
        _.forEach( soaResponse.variabilityPropertiesToDisplay, propertyName => {
            let propertyValue = '';
            if( viewModelObject.props ) {
                propertyValue = viewModelObject.props[ propertyName ][ 0 ];
            }
            propertyMap[ propertyName ] = exports.getViewModelProperty( propertyName, vmTreeNode.parentUID, propertyValue );
        } );
    }

    // Get list of 'Properties Information' UIDs
    let propInfoUIDs = pca0CommonUtils.getPropertiesInformationUIDs( soaResponse.variabilityTreeData );

    // Create PropertyMap looping through businessObjectToSelectionMap
    // Note: businessObjectToSelectionMap has all column indexes, even in case no selections are set
    let selectionMap = pca0CommonUtils.getExpressionMap( gridData, soaResponse );
    let businessObjectKeys = Object.keys( selectionMap );
    _.forEach( businessObjectKeys, key => {
        let propertyVal = 0;
        let searchUid = vmTreeNode.alternateID;
        let selectedObject = _.get( selectionMap[ key ], searchUid ) ? _.get( selectionMap[ key ], searchUid ) : _.get( selectionMap[ key ], vmTreeNode.nodeUid );
        let exprVal = '';

        if( !_.isUndefined( selectedObject ) ) {
            propertyVal = selectedObject.selectionState;
            exprVal = selectedObject.expressionType;
            propertyMap.expressionType = {
                uiValue: exprVal,
                dbValue: [ exprVal ]
            };
        } else if( _isConstraintsEditorPropInfoNode( vmTreeNode.nodeUid, propInfoUIDs ) ) {
            // For 'Properties Information' subset
            // get properties from ViewModelObjectMap
            // In case of new constraint: viewModelObjectMap is not populated
            if( !_.isUndefined( _.get( soaResponse, 'viewModelObjectMap[' + key + '].props["' + vmTreeNode.nodeUid + '"][0]' ) ) ) {
                propertyVal = soaResponse.viewModelObjectMap[ key ].props[ vmTreeNode.nodeUid ][ 0 ];
            } else if( !_.isUndefined( additionalColumns ) ) {
                let newConstraintColumn = _.find( additionalColumns, { uid: key } );
                if( !_.isUndefined( newConstraintColumn ) &&
                    !_.isUndefined( _.get( newConstraintColumn, 'props["' + vmTreeNode.nodeUid + '"].uiValues[0]' ) ) ) {
                    propertyVal = newConstraintColumn.props[ vmTreeNode.nodeUid ].uiValues[ 0 ];
                }
            }
        }
        let props = _.get( selectedObject, 'props' );
        propertyMap[ key ] = exports.getViewModelProperty( key, vmTreeNode.parentUID, propertyVal, props );

        // Scenario: VMO is being re-created while Edit Mode is active
        // This can happen when:
        // 1- Whole tree is reloaded after an SVR was unloaded
        // 2- A node is expanded
        // There might be uncommitted changes for that node.
        // VMO Original value must be set from backup, not from updated selection Map
        // --> This will restore the style for changed values
        // Also, in case of Split Columns just created, the Key is not present in backup map
        if( appCtxService.getCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE ) ) {
            let originalPropertyVal = 0;

            if( !_.isUndefined( backupSelectionMap[ key ] ) &&
                !_.isUndefined( backupSelectionMap[ key ][ searchUid ] ) ) {
                originalPropertyVal = _.get( backupSelectionMap[ key ][ searchUid ], 'selectionState' );
                if( _.isUndefined( originalPropertyVal ) ) {
                    originalPropertyVal = 0;
                }
            }
            propertyMap[ key ].originalValue = originalPropertyVal;
            propertyMap[ key ].dirty = propertyMap[ key ].dbValue[ 0 ] !== propertyMap[ key ].originalValue;
            propertyMap[ key ].valueUpdated = propertyMap[ key ].dbValue[ 0 ] !== propertyMap[ key ].originalValue;
        }
    } );
    return propertyMap;
};

/**
 * Format Display Name property for Free Form - Date type VMO
 * @param {Object} viewModelObject - View Model Object
 */
let _formatFreeFormDateDisplayName = function( viewModelObject ) {
    let displayName = viewModelObject.displayName;
    const result = displayName.split( ' ' );
    if( result.length > 1 ) {
        const fromOp = result[ 0 ];
        const fromDate = result[ 1 ];
        const toOp = result[ 3 ];
        const toDate = result[ 4 ];
        const fromDateStr = pca0CommonUtils.getFormattedDateFromUTC( fromDate );
        displayName = fromOp + ' ' + fromDateStr;
        if( result[ 3 ] && result[ 4 ] ) {
            const toDateStr = pca0CommonUtils.getFormattedDateFromUTC( toDate );
            displayName += ' & ' + toOp + ' ' + toDateStr;
        }
    } else {
        displayName = pca0CommonUtils.getFormattedDateFromUTC( displayName );
    }
    viewModelObject.displayName = displayName;
};

/**
 * Create View Model Object for Free Form\Enumerated node
 * @param {String} parentNodeUid - UID of parent Node
 * @param {Boolean} isParentFreeForm - true if parent is Free Form
 * @param {Boolean} isParentEnumerated - true if parent is Enumerated
 * @param {String} nodeUid - UID of Node
 * @param {Number} levelNdx - The # of levels down from the 'root' of the tree-table for the Node.
 * @param {Number} childNdx - The index to this Node ('child') within the immediate 'parent'.
 * @return {ViewModelTreeNode} Newly created wrapper initialized with properties from the given inputs.
 */
let _createFreeFormEnumeratedVMO = function( parentNodeUid, isParentFreeForm, isParentEnumerated, nodeUid, levelNdx, childNdx ) {
    // We fall here when creating a new freeForm/enumerated value node
    var parentPrefix = parentNodeUid + ':';
    var valueText = nodeUid.replace( parentPrefix, '' );
    let vmTreeNode = awTableService.createViewModelTreeNode( valueText, undefined, valueText, levelNdx, childNdx, undefined );

    // Force "feature" icon for Free Form and Enumerated features
    let iconURL = iconSvc.getTypeIconURL( Pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE );
    vmTreeNode.typeIconURL = iconURL;
    vmTreeNode.isParentFreeForm = isParentFreeForm;
    vmTreeNode.isParentEnumerated = isParentEnumerated;
    vmTreeNode.valueText = valueText;
    vmTreeNode.isLeaf = true;

    return vmTreeNode;
};

/**
 * Format Display Name property for Free Form - Date type VMO
 * @param {Object} viewModelObject - View Model Object
 * @param {Object} node - Node from soaResponse variability Nodes
 * @param {Boolean} isParentFreeFormOrEnumerated - true if parent is either Free Form or Enumerated
 * @param {Boolean} isPropInfoNode - true if node is a 'Properties Information' node
 * @return {String} icon URL
 */
let _getIconURL = function( viewModelObject, node, isParentFreeFormOrEnumerated, isPropInfoNode ) {
    let iconURL = iconSvc.getTypeIconURL( viewModelObject.sourceType );
    if( _.isUndefined( iconURL ) || _.isNull( iconURL ) ) {
        var isUnconfigured = node.props && node.props.isUnconfigured && node.props.isUnconfigured[ 0 ];
        if( isUnconfigured ) {
            iconURL = iconSvc.getTypeIconURL( Pca0Constants.CFG_OBJECT_TYPES.TYPE_UNCONFIGURE_OBJ );
        } else if( isParentFreeFormOrEnumerated ) {
            // Force "feature" icon for Free Form and Enumerated features
            iconURL = iconSvc.getTypeIconURL( Pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE );
        } else if( isPropInfoNode ) {
            // Force no image for 'Properties Information' nodes
            iconURL = '';
        } else {
            // Display image if source type is not defined and if not free family.
            iconURL = iconSvc.getTypeIconURL( Pca0Constants.CFG_OBJECT_TYPES.TYPE_MISSING );
        }
    }
    return iconURL;
};

/**
 * Set isLeaf property on view model tree node
 * In case of Variability explorer the column properties are listed in UiConfigCots file and are fetched by "getTableViewModelProperties" SOA
 * This SOA is invoked from framework code ( treeTableDataService.js ) and it assumes node not to have any properties.
 * @param {Object} node -Node from soaResponse variability Nodes
 * @param {ViewModelTreeNode} vmTreeNode - View Model Tree node created for node
 */
let _setIsLeafProperty = function( node, vmTreeNode ) {
    // In Variability explorer a node is a Leaf if "isLeaf" property is populated in SOA response
    if( node.props && node.props.isLeaf && node.props.isLeaf.length > 0 ) {
        vmTreeNode.isLeaf = node.props.isLeaf[ 0 ] === 'true';
    }
};

/**
 * Get Display Name for Business Object to use for column header text
 * @param {Object} soaResponse - the Cached SOA response
 * @param {String} businessObjectUid - UID of the Business Object
 * @return {String} Display Name for the Business Object
 */
let _getDisplayNameForBusinessObject = function( soaResponse, businessObjectUid ) {
    let viewModelObject = soaResponse.viewModelObjectMap[ businessObjectUid ];
    return viewModelObject && viewModelObject.displayName ? viewModelObject.displayName : businessObjectUid;
};

/**
 * Utility to remove treeNode from tree structure
 * Removes node itself and its references from parent node (children and childrenUids)
 * @param {Array} treeNodes - list of tree nodes
 * @param {Object} treeNode - tree to be removed
 */
let _removeNodeFromTree = function( treeNodes, treeNode ) {
    _.remove( treeNodes, { nodeUid: treeNode.nodeUid } );
    var parentNode = _.find( treeNodes, function( node ) {
        return node.levelNdx === treeNode.levelNdx - 1 && !_.isUndefined( node.childrenUids ) &&
            node.childrenUids.includes( treeNode.nodeUid );
    } );
    if( parentNode ) {
        _.remove( parentNode.children, { nodeUid: treeNode.nodeUid } );
        parentNode.childrenUids.splice( parentNode.childrenUids.indexOf( treeNode.nodeUid ), 1 );
    }
};

/**
 * Creates container for rendering image in table cell
 * @returns {Object} CellContainer with icon
 */
let _getCellImageContainer = function() {
    let cellImageContainer = document.createElement( 'img' );
    cellImageContainer.classList.add( 'aw-base-icon' );
    cellImageContainer.classList.add( 'aw-splm-tableIcon' );
    return cellImageContainer;
};

/**
 * Return image Container for the Cell
 * @param {Integer} selectionState - VMO selection state
 * @returns {Object} - Cell Image container
 */
let _getSelectionStateImageContainer = function( selectionState ) {
    let imageBasePath = getBaseUrlPath() + '/image/';
    var cellImageContainer = document.createElement( 'div' );

    let customClassName;
    var imagePath1 = imageBasePath;
    var imagePath2 = imageBasePath;
    let image1Container;
    switch ( selectionState ) {
        case 1:
        case 5:
        case 9:
            image1Container = _getCellImageContainer();
            image1Container.classList.add( 'cfg-select' );
            imagePath1 += Pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_TICK;
            image1Container.alt = _selectedString;
            if( selectionState === 5 ) {
                imagePath2 += Pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_DEFAULT_SELECTION;
                customClassName = 'cfg-default';
            } else if( selectionState === 9 ) {
                imagePath2 += Pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_SYSTEM_SELECTION;
                customClassName = 'cfg-system';
            }
            break;
        case 2:
        case 6:
        case 10:
            image1Container = _getCellImageContainer();
            image1Container.classList.add( 'cfg-deselect' );
            imagePath1 += Pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_NOT;
            image1Container.alt = _excludedString;
            if( selectionState === 6 ) {
                imagePath2 += Pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_DEFAULT_SELECTION;
                customClassName = 'cfg-default';
            } else if( selectionState === 10 ) {
                imagePath2 += Pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_SYSTEM_SELECTION;
                customClassName = 'cfg-system';
            }
            break;
        default:
            break;
    }

    if( image1Container ) {
        image1Container.src = imagePath1;
        cellImageContainer.appendChild( image1Container );
    }
    if( imagePath2 !== imageBasePath ) {
        let image2Container = _getCellImageContainer();
        image2Container.classList.add( 'aw-cfg-img-gridcell' );
        image2Container.classList.add( customClassName );
        image2Container.src = imagePath2;
        cellImageContainer.appendChild( image2Container );
    }

    return cellImageContainer;
};

/**
 * Helps to check criteria with sourceString
 * @param {String} sourceStr - Src string to check with filter
 * @param {String} filter - string to check
 * @param {String} criteria - criteria selected to filter data
 * @returns {boolean} - true if matched with criteria else false
 */
let _isFilterCriteriaSatisfied = function( sourceStr, filter, criteria ) {
    let dataStr = sourceStr.toLowerCase();
    let filterStr = filter.toLowerCase();
    switch ( criteria ) {
        case 'contains':
            return dataStr.includes( filterStr );
        case 'notContains':
            return !dataStr.includes( filterStr );
        case 'startsWith':
            return dataStr.startsWith( filterStr );
        case 'endsWith':
            return dataStr.endsWith( filterStr );
        case 'equals':
            return dataStr === filterStr;
        case 'notEquals':
            return dataStr !== filterStr;
        default:
            return 0;
    }
};

/**
 * Build tree structure matching active filter.
 * Get updated treeLoadResult to display
 * @param {Object} loadedTreeLoadResult - the currently loaded TreeLoadResult (loaded VMOs)
        we need it as filtering action is reloading the whole structure, and we need to access loaded VMOs
 * @param {String} filter - the filter string
 * @param {String} filterCriteria - the filter criteria
 * @return {Object} TreeLoadResult for nodes matching filter
 */
let _getFilteredTreeLoadResult = function( loadedTreeLoadResult, filter, filterCriteria ) {
    var loadedObjects = [ ...loadedTreeLoadResult.childNodes ];
    var clonedObjects = [ ...loadedObjects ];

    for( var idx = 0; idx < clonedObjects.length; idx++ ) {
        // If a parent node is filtered, add it to filteredNodes list with all its children
        // If a parent node is not filtered, apply filtering on children
        var treeNode = clonedObjects[ idx ];

        if( treeNode.levelNdx !== 0 ) {
            // Process Level 0 only
            continue;
        }

        if( _isFilterCriteriaSatisfied( treeNode.displayName, filter, filterCriteria ) ) {
            continue;
        }

        // Recursion will take care of filtering and removing nodes from tree structure pertaining to that given node.
        var tNode = _.find( loadedObjects, { nodeUid: treeNode.nodeUid } );
        _recursiveApplyFilter( loadedObjects, tNode, filter, filterCriteria );

        // If no result is matching filter, remove node
        if( tNode.children && tNode.children.length === 0 ) {
            _removeNodeFromTree( loadedObjects, tNode );
        }
    }
    return loadedObjects;
};

/**
 * Find and return a node in the Expansion Map, given its ID
 * @param {Object} expansionMap expansion Map
 * @param {String} nodeID - UID for the Tree Node
 * @return {ViewModelTreeNode} View Model Tree Node from map, null if not found
 */
let _recursiveFindNodeInExpansionMap = function( expansionMap, nodeID ) {
    for( var idx = 0; idx < expansionMap.length; idx++ ) {
        var node = expansionMap[ idx ];
        if( node.id === nodeID ) {
            return node;
        }

        var childNodes = node.childNodes;
        if( node.childNodes ) {
            var childNode = _recursiveFindNodeInExpansionMap( childNodes, nodeID );
            if( childNode ) {
                return childNode;
            }
        }
    }
    return null;
};

/**
 * Recursive util to create treeNodes according to expansion map provided
 * @param {Object} rootNode - Root Node for the structure to be created recursively
 * @param {Number} expandingLevel - Level # for the node being created
 * @param {Object} expansionMap - expansion Map
 * @param {Array} treeNodes - list of tree nodes
 * @param {Array} nodeBeingExpandedChildren - List of children for the node being created (and expanded recursively)
 * @param {Object} soaResponse - SOA response
 * @param {Object} backupSelectionMap - backup SelectionMap (Used when creating nodes in Edit Mode)
 * @param {String} alternateID - alternate ID
 */
let _recursiveCreateTreeNodeWithMap = function( rootNode, expandingLevel, expansionMap, treeNodes, nodeBeingExpandedChildren, soaResponse, backupSelectionMap, alternateID ) {
    _.forEach( rootNode.childrenUids, id => {
        var nodeInExpansionMap = _recursiveFindNodeInExpansionMap( expansionMap, id );
        if( nodeInExpansionMap ) {
            var tNode = exports.createViewModelTreeNode(
                id, expandingLevel, rootNode.nodeUid, alternateID, rootNode.childrenUids.indexOf( id ), soaResponse,
                backupSelectionMap );

            tNode.children = [];
            treeNodes.push( tNode );

            // Iterate through children if present in expansionMap
            if( nodeInExpansionMap.childNodes && nodeInExpansionMap.childNodes.length !== 0 ) {
                tNode.isExpanded = true;
                var newStartNode = _.find( pca0CommonUtils.getVariabilityNodes( soaResponse ), { nodeUid: id } );
                _recursiveCreateTreeNodeWithMap( newStartNode, expandingLevel + 1, expansionMap, treeNodes, tNode.children, soaResponse, backupSelectionMap, tNode.alternateID );
            }
            if( expandingLevel !== 0 ) {
                nodeBeingExpandedChildren.push( tNode );
            }
        }
    } );
};

/**
 * Recursive util to create treeNodes and expanding them all, except leaf nodes.
 * @param {Object} rootNode - Root Node for the structure to be created recursively
 * @param {Number} expandingLevel - Level # for the node being created
 * @param {Array} treeNodes - list of tree nodes
 * @param {Array} nodeBeingExpandedChildren - List of children for the node being created (and expanded recursively)
 * @param {Object} soaResponse - SOA response
 * @param {Object} backupSelectionMap - backup SelectionMap (Used when creating nodes in Edit Mode)
 * @param {Array} specialBackgroundCells - list of cells that need a special header-like background style
 * @param {Integer} stopExpansionLevel - leveNdx where we need to stop recursive expansion
 * @param {Integer} showSummaryForLevelNdx - leveNdx where summary of childrenUids selections must be displayed
 * @param {Object} gridData - To get selection of constraints grid as topGrid/bottomGrid
 * @param {Array} additionalColumns - additional Columns added after loading (not available in soaResponse)
 * @param {Array} gridEditorSelections - Array of alternate ids for VMO visible in constraints grid with familyUid:featureUid
 */
let _recursiveCreateTreeNode = function( rootNode, expandingLevel, treeNodes, nodeBeingExpandedChildren, soaResponse, backupSelectionMap,
    specialBackgroundCells, stopExpansionLevel, showSummaryForLevelNdx, gridData, additionalColumns, gridEditorSelections ) {
    _.forEach( rootNode.childrenUids, id => {
        var treeNode = exports.createViewModelTreeNode(
            id, // nodeUid
            expandingLevel, // levelNdx
            rootNode.nodeUid, // parentNodeUid
            rootNode.alternateID,
            rootNode.childrenUids.indexOf( id ), //childNdx
            soaResponse, // soaResponse
            backupSelectionMap, // backupSelectionMap
            !_.isUndefined( specialBackgroundCells ) && specialBackgroundCells.includes( id ), // isSpecialBackgroundCell
            gridData, // selection map for constraints grid
            additionalColumns // additional columns to insert in propertyMap
        );
        if ( gridEditorSelections && !_.isEmpty( gridEditorSelections ) && !treeNode.isLeaf ) {
            treeNode.isPreselected = true;
        }
        treeNode.children = [];
        treeNodes.push( treeNode );
        // Iterate through children if iteration can continue
        if( !treeNode.isLeaf && !_.isUndefined( treeNode.childrenUids ) && treeNode.childrenUids.length > 0 ) { // Stop iteration if parentUid is in stopExpansionParentNodeUIDs
            treeNode.isExpanded = _.isUndefined( stopExpansionLevel ) || stopExpansionLevel !== treeNode.levelNdx;
            // Update Summary if needed
            if( gridData && !_.isUndefined( showSummaryForLevelNdx ) && showSummaryForLevelNdx === expandingLevel ) {
                pca0CommonUtils.updateViewModelTreeNodeSummary(
                    gridData.businessObjectToSelectionMap, // only for constraints grid
                    treeNode, // viewModelTreeNode,
                    soaResponse.viewModelObjectMap
                );
            }
            if( treeNode.isExpanded ) {
                _recursiveCreateTreeNode( treeNode, expandingLevel + 1, treeNodes, treeNode.children,
                    soaResponse, backupSelectionMap, specialBackgroundCells, stopExpansionLevel, showSummaryForLevelNdx, gridData, additionalColumns, gridEditorSelections );
            }
        }

        if( expandingLevel !== 0 ) {
            nodeBeingExpandedChildren.push( treeNode );
        }
    } );
};

/**
 * This method filters the tree nodes based on a user entered search filter
 * @param {Object} allLoadedObjects loaded view model objects in the tree structure
 * @param {Object} treeNode - node to recursively apply filtering
 * @param {String} filter - filter string
 * @param {String} filterCriteria - filter criteria
 */
let _recursiveApplyFilter = function( allLoadedObjects, treeNode, filter, filterCriteria ) {
    // If treeNode has no children, we have reached the end of the tree and no filter matched so far
    // children object could even be undefined if node has been expanded by user.
    if( !treeNode.children || treeNode.children.length === 0 ) {
        return;
    }

    var clonedTreeChildren = _.cloneDeep( treeNode.children );
    for( var idx = 0; idx < clonedTreeChildren.length; idx++ ) {
        var tNode = clonedTreeChildren[ idx ];

        if( _isFilterCriteriaSatisfied( tNode.displayName, filter, filterCriteria ) ) {
            continue;
        }
        _recursiveApplyFilter( allLoadedObjects, tNode, filter, filterCriteria );

        // If no result is matching filter, remove node
        if( !tNode.children || tNode.children.length === 0 ) {
            _removeNodeFromTree( allLoadedObjects, tNode );
            _removeNodeFromTree( treeNode.children, tNode );
        }
    }
};

/**
 * Invoke callback upon cell click event
 * @param {String} contextKey  context Key
 * @param {String} callbackName callback name to handle cell click event
 * @param {Object} cell cell
 * @param {Object} vmo View Model Object for the cell
 * @param {Object} column column for the cell
 * @param {Object} treeDataProvider data provider
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 */
let _handleCellClick = function( contextKey, callbackName, cell, vmo, column, treeDataProvider, vmGridSelectionState ) {
    // Enforce row selection for Tree Navigation column
    if( column.isTreeNavigation ) {
        treeDataProvider.selectionModel.setSelection( vmo );
    }

    if( callbackName ) {
        let cellDetails = {
            cell: cell,
            vmo: vmo,
            column: column,
            treeDataProvider: treeDataProvider
        };
        callbackName( contextKey, cellDetails, vmGridSelectionState );
    }
};

/**
 * Validate if parentObject is FreeForm
 * @param {Object} parentObject VMO for parent object
 * @returns {Boolean} true if parent is Free Form
 */
let _isParentFreeForm = ( parentObject ) => {
    return parentObject.props && parentObject.props.isFreeForm && parentObject.props.isFreeForm[ 0 ] === 'true';
};

/**
 * Validate if parentObject is Enumerated
 * @param {Object} parentObject VMO for parent object
 * @param {Boolean} isParentFreeForm true if parent object is Free Form
 * @returns {Boolean} true if parent is Enumerated
 */
let _isParentEnumerated = ( parentObject, isParentFreeForm ) => {
    return Pca0VariabilityTreeEditService.isEnumeratedFamily( parentObject ) && !isParentFreeForm;
};

/**
 * Get properties FreeForm/Enumerated for parent object and set properties on node VMO
 * @param {String} parentNodeUid parentNode UID
 * @param {Object} parentObject parent VMO
 * @param {Object} viewModelObject node VMO
 * @returns {Object} container of booleans for parent FreeForm/Enumerated properties
 */
let _validateFreeFormAndEnumeratedParentVMO = ( parentNodeUid, parentObject, viewModelObject ) => {
    let isParentFreeForm = false;
    let isParentEnumerated = false;
    if( parentNodeUid !== '' && !_isConstraintsEditorPropInfoNode( parentNodeUid ) ) {
        assert( parentObject, 'Parent Node is missing in the response' );
        isParentFreeForm = _isParentFreeForm( parentObject );
        isParentEnumerated = _isParentEnumerated( parentObject, isParentFreeForm );
        if( isParentFreeForm && parentObject.props.cfg0ValueDataType && parentObject.props.cfg0ValueDataType[ 0 ] === 'Date' && viewModelObject ) {
            _formatFreeFormDateDisplayName( viewModelObject );
        } else if( isParentEnumerated && viewModelObject ) {
            /**
             * This block is called for enumerated feature to get UI name set in cfg0DisplayNames for respective cfg0Ids
             */
            const ids = parentObject.props.cfg0ChildrenIDs;
            const displayNames = parentObject.props.cfg0ChildrenDisplayNames;
            let serverDisplayName = viewModelObject.displayName;
            viewModelObject.displayName = enumFeature.getDisplayNamesForEnumeratedFeature( serverDisplayName, ids, displayNames );
        }
    }
    return { isParentFreeForm, isParentEnumerated };
};

/**
 * Validate if node is part of 'Properties Information' subset of Constraints Grid Editor
 * @param {String} nodeUid node UID
 * @param {propInfoUIDs} propInfoUIDs additinal list of 'Properties Information' nodeUIDs
 * @returns {Boolean} true if node UID is part of 'Properties Information' subset of Constraints Grid Editor
 */
let _isConstraintsEditorPropInfoNode = ( nodeUid, propInfoUIDs ) => {
    let propInfoNodesSubset = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID ];
    if( !_.isUndefined( propInfoUIDs ) && propInfoUIDs instanceof Array && propInfoUIDs.length !== 0 ) {
        propInfoNodesSubset = [ ...propInfoUIDs ];
    }
    return propInfoNodesSubset.includes( nodeUid );
};

/**
 * This method changes the height of the text container of 'aw-cfg-variantgridHeader' with respect to column header height of the grid for VCV or VCA
 * @param {String} contextKey This parameter tells us whether we are in VCV or VCA view.
 */
let _setContainerHeight = function( contextKey ) {
    let prefHeightValue;
    let defaultHeight = Pca0Constants.VCA_VCV_GRID_HEIGHT_CONSTANTS.DEFAULT_HEIGHT;
    let gridEditorPreference = appCtxService.getCtx( 'preferences' );
    let elements = document.getElementsByClassName( 'aw-cfg-variantgridHeader' );
    if( _.isEqual( contextKey, Pca0Constants.VCA_CONTEXT ) ) {
        prefHeightValue = gridEditorPreference.PCA_variant_conditions_grid_header_height === undefined ?  defaultHeight : Number( gridEditorPreference.PCA_variant_conditions_grid_header_height[0] );
        prefHeightValue = prefHeightValue > Pca0Constants.VCA_VCV_GRID_HEIGHT_CONSTANTS.MAXIMUM_HEIGHT ? Pca0Constants.VCA_VCV_GRID_HEIGHT_CONSTANTS.MAXIMUM_HEIGHT : prefHeightValue;
    } else if ( _.isEqual( contextKey, Pca0Constants.FSC_CONTEXT )  ) {
        prefHeightValue = gridEditorPreference.PCA_variant_configuration_grid_header_height === undefined ? defaultHeight : Number( gridEditorPreference.PCA_variant_configuration_grid_header_height[0] );
        prefHeightValue = prefHeightValue >  Pca0Constants.VCA_VCV_GRID_HEIGHT_CONSTANTS.MAXIMUM_HEIGHT ? Pca0Constants.VCA_VCV_GRID_HEIGHT_CONSTANTS.MAXIMUM_HEIGHT : prefHeightValue;
    }else{
        //Do nothing for grids other than VCA and VCV
    }
    _.forEach( elements, element => {
        element.style.height = prefHeightValue * 0.0625 + 'rem';
    } );
};

/*
 *   Export APIs section starts
 */
let exports = {};

/**
 * Build Column Definition, including renderers.
 * @param {Array} columnProperties - column information array
 * @param {String} currentContextKey - context key
 * @param {UwDataProvider} treeDataProvider - Tree data provider
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 * @return {Object} Column Definition
 */
export let createColumnDef = function( columnProperties, currentContextKey, treeDataProvider, vmGridSelectionState ) {
    // Note: in order to have "Hide Column" disabled for the whole table:
    // <Thomas Stark> have your columnProvider return false from the "isArrangeSupported" function

    // Set columnWidth if specified for the column
    // Also set Maximum Width for Constraints Grid Editor columns
    let _columnWidth;
    let _maxWidth;
    if( columnProperties.gridID === pca0CommonConstants.GRID_CONSTANTS.CONSTRAINTS_GRID ) {
        _columnWidth = columnProperties.columnWidth;
        _maxWidth = pca0CommonConstants.GRID_CONSTANTS.MAX_COLUMN_WIDTH;
    } else {
        _columnWidth = pca0CommonConstants.GRID_CONSTANTS.BUSINESS_OBJECT_COLUMN_WIDTH;
        _maxWidth = _columnWidth;
    }

    // setting isTableCommand along with a commandsAnchor on data provider will enable commands on the first column
    if( columnProperties.isTreeNavigation ) {
        columnProperties.isTableCommand = true;
    }

    // Add custom cell Renderers if specified for the column
    let cellRenderers = [];
    if( !_.isUndefined( columnProperties.cellRenderers ) ) {
        cellRenderers = [ ...columnProperties.cellRenderers ];
    }
    cellRenderers.push( exports.iconCellRenderer( Pca0VariabilityTreeEditService.handleCellClick, currentContextKey,
        treeDataProvider, vmGridSelectionState ) );
    const colDisplayName = treeDataProvider.name === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP ? '' : columnProperties.propertyDisplayName;

    return {
        name: columnProperties.propertyName,
        displayName: colDisplayName,
        uid: columnProperties.propertyUid,
        originalColumnName: columnProperties.originalColumnName,
        minWidth: pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH,
        width: _columnWidth,
        maxWidth: _maxWidth,
        isSplitColumn: columnProperties.isSplitColumn,
        newConstraintColumnProps: { ...columnProperties.newConstraintColumnProps },
        cellRenderers: cellRenderers,
        menuItems: [],
        isFilteringEnabled: false,
        enableColumnHiding: false, // disable command "Hide Column"
        enableColumnMenu: columnProperties.enableColumnMenu // Menu can be disabled, i.e. hidden header in Constraints Grid Editor
    };
};

/**
 * Create ViewModelProperty for ViewModelTreeNode property map
 * calling uwPropertyService.createViewModelProperty (propertyName, propertyDisplayName, dataType, dbValue, displayValuesIn )
 * @param {String} propertyName - the name/id of the property (Column - for VCA: designElement, for VCV: variant rule)
 * @param {String} parentUid - the name/id of the parent VMO
 * @param {String} propertyValue - Value for the property
 * @param {Object} props - additional properties from attached ViewModel object (from SOA response)
 * @return {ViewModelProperty} A new instance of this class.
 */
export let getViewModelProperty = function( propertyName, parentUid, propertyValue, props ) {
    // Create VM Property and initialize additional properties needed
    var vmProp = uwPropertyService.createViewModelProperty( propertyName, propertyName,
        'STRING', [ propertyValue ], [ propertyValue ] );

    // Initialize properties for the ViewModelProperty that were not created by uwPropertyService.createViewModelProperty
    vmProp.propertyDescriptor = {
        displayName: propertyName
    };
    vmProp.name = propertyName;
    vmProp.value = propertyValue; // re-definition (uwPropertyService.createViewModelProperty creates array)
    vmProp.originalValue = propertyValue;
    vmProp.parentUid = parentUid;
    vmProp.props = props;
    return vmProp;
};

/**
 * Create the View Model Tree Node
 * @param {String} nodeUid  - UID for the node in the tree table
 * @param {Number} levelNdx - The # of levels down from the Root of the tree-table
 * @param {String} parentNodeUid - UID of parent node in the tree table
 * @param {String} parentNodeAlternateUid - alternate UID of parent node in the tree table
 * @param {Number} childNdx - The index to this 'child' within the immediate 'parent'
 * @param {Object} soaResponse - the Cached SOA response
 * @param {Object} backupSelectionMap - backup SelectionMap (Used when creating nodes in Edit Mode)
 * @param {Boolean} isSpecialBackgroundCell - true if cell needs a special header-like background style
 * @param {Object} gridData - [Constraints Grid editor only] To get selection map with respective to constraints grid topGrid/bottomGrid
 * @param {Array} additionalColumns - [Constraints Grid editor only] additional Columns added after loading (not available in soaResponse)
 * @return {ViewModelTreeNode} View Model Tree Node
 */
export let createViewModelTreeNode = function( nodeUid, levelNdx, parentNodeUid, parentNodeAlternateUid, childNdx, soaResponse, backupSelectionMap, isSpecialBackgroundCell, gridData, additionalColumns ) {
    let node = _.find( pca0CommonUtils.getVariabilityNodes( soaResponse ), { nodeUid: nodeUid } );
    let viewModelObject = soaResponse.viewModelObjectMap[ nodeUid ];

    var vmPropsDelete = false;
    let parentObject = soaResponse.viewModelObjectMap[ parentNodeUid ];
    let { isParentFreeForm, isParentEnumerated } = _validateFreeFormAndEnumeratedParentVMO( parentNodeUid, parentObject, viewModelObject );

    var vmTreeNode;
    if( !_.isUndefined( node ) && !_.isUndefined( viewModelObject ) ) {
        // Get list of 'Properties Information' UIDs
        let propInfoUIDs = pca0CommonUtils.getPropertiesInformationUIDs( soaResponse.variabilityTreeData );

        let iconURL = !isSpecialBackgroundCell ? _getIconURL(
            viewModelObject, // viewModelObject
            node, // node
            isParentFreeForm || isParentEnumerated, // isParentFreeFormOrEnumerated
            _isConstraintsEditorPropInfoNode( nodeUid, propInfoUIDs ) // isPropInfoNode
        ) : '';

        // Create node and initialize additional properties needed
        var type = _.get( viewModelObject, 'props.cfg0ValueDataType[0]' );
        if( !type ) {
            type = viewModelObject.sourceType;
        }
        vmTreeNode = awTableService.createViewModelTreeNode( nodeUid, type, viewModelObject.displayName, levelNdx, childNdx, iconURL );
        vmTreeNode.isFreeForm = _.get( viewModelObject, 'props.isFreeForm[0]' ) === 'true';
        vmTreeNode.isEnumerated = Pca0VariabilityTreeEditService.isEnumeratedFamily( viewModelObject );
        vmTreeNode.isSingleSelect = _.get( viewModelObject, 'props.isSingleSelect[0]' ) === 'true';
        vmTreeNode.isOptional = _.get( viewModelObject, 'props.cfg0IsDiscretionary[0]' ) === 'true';
        vmTreeNode.isUnconfigured = node.props && node.props.isLeaf && node.props.isUnconfigured && node.props.isUnconfigured[ 0 ] === 'true';

        // Add flag for special header-like background style if needed
        vmTreeNode.isSpecialBackgroundCell = isSpecialBackgroundCell;

        // Create childrenUids if defined.
        // In GridEditor, VCA2 and VCV the node is a Leaf if it has children
        vmTreeNode.isLeaf = true;
        if( !_.isUndefined( node.childrenUids ) && node.childrenUids.length > 0 ) {
            vmTreeNode.childrenUids = node.childrenUids;
            vmTreeNode.isLeaf = false;
        } else if( nodeUid === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID || nodeUid === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID
            && _.get( gridData.viewModelObjectMap[nodeUid], 'childrenUids' ) ) {
            vmTreeNode.childrenUids = gridData.viewModelObjectMap[nodeUid].childrenUids;
            vmTreeNode.isLeaf = false;
        }
        vmTreeNode.typeIconURL = iconURL;

        if( viewModelObject && viewModelObject.props && viewModelObject.props.cfg0ChildrenDisplayNames ) {
            vmTreeNode.childrenDispValues = viewModelObject.props.cfg0ChildrenDisplayNames;
        }
        if( viewModelObject && viewModelObject.props && viewModelObject.props.cfg0ChildrenIDs ) {
            vmTreeNode.cfg0ChildrenIDs = viewModelObject.props.cfg0ChildrenIDs;
        }

        // Handle Variability Explorer scenario
        if( soaResponse.resetColumnProperties ) {
            _setIsLeafProperty( node, vmTreeNode );
            vmPropsDelete = true;
        }
    } else if( ( isParentFreeForm || isParentEnumerated ) && _.isUndefined( viewModelObject ) ) {
        vmTreeNode = _createFreeFormEnumeratedVMO( parentNodeUid, isParentFreeForm, isParentEnumerated, nodeUid, levelNdx, childNdx );
    }

    if( vmTreeNode ) {
        // Initialize properties for the ViewModelTreeNode that were not created by awTableService.createViewModelTreeNode
        vmTreeNode.nodeUid = nodeUid;
        vmTreeNode.parentUID = parentNodeUid; // needed when creating VM properties

        // Expansion state is evaluated when rendering the tree nodes (default is false)
        vmTreeNode.isExpanded = false;

        // AW6.0 - Add dummy property on unassigned group object to ensure that framework doesn't invoke recursive server calls to fetch properties
        // Refer LCS-541819
        if( Object.values( Pca0Constants.PSUEDO_GROUPS_UID ).includes( vmTreeNode.nodeUid ) ) {
            vmTreeNode.props = {
                dummy_property: []
            };
        }
        // Following are used by framework to differentiate common uid used in multiple family
        // Also, we use alternateID to differentiate common features
        vmTreeNode.alternateID = pca0CommonUtils.prepareUniqueId( parentNodeAlternateUid ? parentNodeAlternateUid : parentNodeUid, nodeUid );
        vmTreeNode.getId = function() {
            return vmTreeNode.alternateID;
        };
        if( !vmPropsDelete ) {
            vmTreeNode.props = _generatePropertyMap(
                vmTreeNode, // vmTreeNode
                soaResponse, // soaResponse
                backupSelectionMap, // backupSelectionMap,
                gridData, // for Constraints Grid editor only
                additionalColumns // for Constraints Grid editor only
            );
        }
    }
    return vmTreeNode;
};

/**
 * Table Icon/Selection Cell Renderer for PL Table
 * @param {Function} handleCellClick - callback for handlick click events on cell
 * @param {String} contextKey - context key
 * @param {UwDataProvider} treeDataProvider - the Tree Data provider
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 * @return {Object} cell renderer
 */
export let iconCellRenderer = function( handleCellClick, contextKey, treeDataProvider, vmGridSelectionState ) {
    return {
        action: function( column, vmo ) {
            // Create root element
            var cell = document.createElement( 'div' );
            cell.classList.add( 'aw-cfg-variantgridCell' );

            let columnCell = column.field;
            if( !( columnCell in vmo.props ) && vmo.props.expressionType && vmo.props.expressionType.dbValue[ 0 ] ) {
                columnCell = column.field + ':' + vmo.props.expressionType.dbValue[ 0 ];
            }

            // Get element selection state
            if( columnCell in vmo.props ) {
                let selectionState = vmo.props[ columnCell ].dbValue[ 0 ];
                let summaryText = '';
                if( !vmo.isExpanded && !vmo.isLeaf && vmo.childrenUids && vmo.childrenUids.length >= 1 ) {
                    summaryText = vmo.props[ columnCell ].uiValue;

                    if( summaryText !== '' && summaryText !== 0 && summaryText !== '0' ) {
                        // Note: title is allowing for tooltip top appear in case of longer text with ellipsis
                        cell.innerText = summaryText;
                        cell.setAttribute( 'title', summaryText );
                        cell.classList.add( 'aw-cfg-variantgridTextCell' ); // align text with some margin
                    }
                } else if( _.isNumber( selectionState ) ) {
                    cell.classList.add( 'aw-cfg-fscIndicatorContainer' ); // adds flex property to align icon center
                    var cellImageContainer = _getSelectionStateImageContainer( selectionState );
                    if( cellImageContainer ) {
                        cell.appendChild( cellImageContainer );
                    }
                } else {
                    // TODO: This is need to remove every text should be part of uiValue we never use selectionState to store text value
                    // Scenario for 'Properties Information' subset
                    // Note: title is allowing for tooltip top appear in case of longer text with ellipsis
                    cell.setAttribute( 'title', selectionState );
                    cell.innerText = selectionState;
                }
            }

            // React to VMO changes
            eventBus.subscribe( 'Pca0VariabilityTreeEditService.vmoUpdated', function( eventData ) {
                if( !_.isEqual( eventData.vmo.alternateID, vmo.alternateID ) || eventData.columnField !== columnCell ) {
                    return;
                }

                if( columnCell in vmo.props ) {
                    // Delete children of current cell and reset style
                    cell.innerHTML = '';
                    var newSelectionState = eventData.vmo.props[ columnCell ].dbValue[ 0 ];
                    var cellImageContainer = _getSelectionStateImageContainer( newSelectionState );
                    if( cellImageContainer ) {
                        cell.appendChild( cellImageContainer );
                    }
                    cell.classList.remove( 'changed' );

                    // Validate if VMO contains unsaved edits
                    if( vmo.props[ columnCell ].valueUpdated ) {
                        cell.classList.add( 'changed' );
                    }
                }
            } );

            // Apply onClick listener to handle editing
            cell.onclick = function() {
                _handleCellClick( contextKey, handleCellClick, cell, vmo, column, treeDataProvider, vmGridSelectionState );
            };
            return cell;
        },

        condition: function( column, vmo ) {
            if( column.isTreeNavigation ) {
                return false;
            }

            let columnCell = column.field;
            if( !( columnCell in vmo.props ) && vmo.props.expressionType && vmo.props.expressionType.dbValue[ 0 ] ) {
                columnCell = column.field + ':' + vmo.props.expressionType.dbValue[ 0 ];
            }
            if( vmo && vmo.isUnconfigured && vmo.props && vmo.props[ columnCell ] ) {
                return vmo.props[ columnCell ].originalValue !== 0; // some selection state then allow editing. Allow editing if the value was <> 0.
            }
            return true;
        },
        name: 'iconCellRenderer'
    };
};

/**
 * Table Command Cell Renderer for PL Table
 * Apply onClick listener to handle "FreeForm" selection
 * @param {Function} handleCellClick - callback for handlick click events on cell
 * @param {String} contextKey - context key
 * @param {UwDataProvider} treeDataProvider - the Tree Data provider
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 * @return {Object} cell renderer
 */
export let filterCellRenderer = function( handleCellClick, contextKey, treeDataProvider, vmGridSelectionState ) {
    return {
        action: function( column, vmo, tableElem ) {
            var cell = tableSvc.createElement( column, vmo, tableElem );
            if( vmo.isSpecialBackgroundCell ) {
                cell.classList.add( 'aw-cfg-headerBackgroundCell' );
            }

            cell.onclick = function() {
                _handleCellClick( contextKey, handleCellClick, cell, vmo, column, treeDataProvider, vmGridSelectionState );
            };
            return cell;
        },
        condition: function( column ) {
            return column.isTreeNavigation;
        },
        name: 'filterCellRenderer'
    };
};

/**
 * Returns the icon to apply on column header
 * @param {Object} column - the column object
 * @return {String} icon url
 */
export let populateHeaderIcon = function( column ) {
    const uid = column.uid;
    let newVMO = undefined;
    if( uid ) {
        newVMO = viewModelObjectService.createViewModelObject( uid, 'Edit' );
    }
    if( column.contextKey  ) {
        // set the column container height according to preference value according to VCA/VCV view
        _setContainerHeight( column.contextKey );
        // delete contextKey so that this if block is entered only once for complete tree.
        delete column.contextKey;
    }
    return awIconSvc.getTypeIconFileUrl( newVMO );
};

export let checkViolations = function( eventData, column ) {
    if( !_.isUndefined( eventData.column ) && eventData.column.field !== column.field ) {
        return;
    }

    let tooltipDetails = {};
    let columnToValidationMap = eventData.columnToValidationMap;
    let violationsInColumn = !_.isUndefined( columnToValidationMap ) && Object.keys( columnToValidationMap ).length > 0 &&
        columnToValidationMap.hasOwnProperty( column.field ) && !_.isUndefined( columnToValidationMap[ column.field ] );
    let errorIconUrl = getBaseUrlPath() + '/image/' + Pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_ERROR;
    // Clear childNodes for iconRow

    if( violationsInColumn ) {
        // Create tooltip element
        tooltipDetails = {
            dispValue: columnToValidationMap[ column.field ]
        };
    }

    return { violationsInColumn, tooltipDetails, errorIconUrl };
};

/**
 * Launch action to populate splm grid data provider
 * @param {Object} viewModel - ViewModel data
 * @param {String} viewModelAction - ViewModel Action Name for performing SOA call
 * @param {String} contextKey - context key
 * @param {Object} fscState - FSC state atomic data (VCV grid only)
 * @param {Object} variantRuleData - VariantRule atomic data (VCV grid only)
 * @returns {Object} TreeLoadResult and updated view model data/atomic data to dispatch
 */
export let loadTreeProviderData = function( viewModel, viewModelAction, contextKey, fscState, variantRuleData ) {
    // Clone current status for VM data and fields (atomic data)

    let variabilityPropsFromAtomicData = viewModel.atomicDataRef.variabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropsFromAtomicData };

    var treeMaps = { ...viewModel.data.treeMaps };

    var nodeBeingExpanded = viewModel.treeLoadInput.parentNode;
    let treeDataProvider = viewModel.dataProviders.treeDataProvider;
    var treeLoadResult;
    // Check for active filters
    let columnFilters = viewModel.columnProviders.treeColumnProvider.columnFilters;
    if( columnFilters && columnFilters.length > 0 ) {
        var columnFilter = _.filter( columnFilters, function( filter ) {
            return filter.columnName === Pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT;
        } );
        if( columnFilter.length > 0 ) {
            variabilityProps.activeFilter = columnFilter[ 0 ];
        }
    } else {
        delete variabilityProps.activeFilter;
    }

    // For Variability Browsing, server call is made for each expand action except when it was already expanded.
    // For VCA, "childrenUids" attribute will always be pre-populated if node has child elements. Server call should be avoided in such case.
    // Hence added a check on "childrenUids" element to verify that if node was already expanded.
    // However in case of free form family, server call needs to be skipped regardless of view i.e. VCA or Variability Browsing
    if( nodeBeingExpanded.id === Pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY || !nodeBeingExpanded.hasOwnProperty( 'childrenUids' ) && !nodeBeingExpanded.isFreeForm ) {
        if( variabilityProps.useCachedData ) {
            // Refresh grid content
            // SelectionMap doesn't need to be recalculated
            // Scenarios:
            // - refreshing grid after a variant Rule has been unloaded from VCV grid view
            // - switching display mode, e.g.: from "Show All Families" to "Show All Features"
            // No need for a new SOA call.
            treeLoadResult = exports.getTreeLoadResult( nodeBeingExpanded, treeMaps, variabilityProps, treeDataProvider );

            // Cache TreeLoadResult for filtering purposes
            treeMaps.cachedTreeLoad = treeLoadResult;

            variabilityProps.useCachedData = undefined;
        } else if( ( variabilityProps.activeFilter || !_.isUndefined( variabilityProps.filterApplied ) ) &&
            ( !viewModel.data.operation || !_.isEqual( viewModel.data.operation, Pca0Constants.GRID_EDIT_OPERATION.SAVE_COMPLETE ) ) ) {
            // Refresh grid content using filters or reset filters
            // Use cached SOA Response
            // Do no reload columns
            treeLoadResult = exports.getTreeLoadResult( nodeBeingExpanded, treeMaps, variabilityProps, treeDataProvider );

            variabilityProps.filterApplied = true;

            // In case filter is being reset
            if( !variabilityProps.activeFilter ) {
                variabilityProps.filterApplied = undefined;
            }
        } else {
            // Make Server call
            let evaluationCtx = {
                data: viewModel,
                ctx: appCtxService.ctx,
                props: {
                    fscstate: fscState,
                    variant: variantRuleData
                }
            };
            let svrAction = viewModel.getAction( viewModelAction );
            if( svrAction.deps ) {
                return declUtils.loadDependentModule( svrAction.deps ).then(
                    function( debModuleObj ) {
                        return actionService.executeAction( viewModel, svrAction, evaluationCtx, debModuleObj ).then( function( actionResult ) {
                            // Add context key only to 1st column so that populateHeaderIcon function calls _setContainerHeight only once for complete tree.
                            if ( actionResult.columnConfig && actionResult.columnConfig.columns[ 0 ] ) {
                                actionResult.columnConfig.columns[0].contextKey = contextKey;
                            }

                            // ***NOTE: Temporary solution***
                            // ExecuteAction will return:
                            // - a SOA response for Variability Explorer
                            // - a JS object for VCA\VCV grids containing soaResponse plus configParams (containsConfigData is set to true)
                            // VCA\VCV is a special case where soaResponse needs post-processing before calling exports.loadDataInTree
                            let soaResponse;
                            let operation;
                            if( actionResult.containsConfigData ) {
                                // Update Load params array with dynamic configuration data coming from soaResponse post-processing
                                variabilityProps = { ...actionResult.variabilityProps };
                                let cachedTreeLoad = { ...treeMaps.cachedTreeLoad };
                                treeMaps = { ...actionResult.treeMaps };
                                // cachedTreeLoad is needed to create treeNodes in getTreeLoadResult function in case filter on column is applied
                                treeMaps.cachedTreeLoad = cachedTreeLoad;
                                soaResponse = variabilityProps.soaResponse;
                            } else {
                                // Update Load params array with soaResponse
                                soaResponse = actionResult;
                                if( viewModel._internal.viewId === 'pca0VariabilityExplorerTree' && variabilityProps.soaResponse ) {
                                    variabilityProps.soaResponse.ServiceData = soaResponse.ServiceData;
                                    variabilityProps.soaResponse.configPerspective = soaResponse.configPerspective;
                                    variabilityProps.soaResponse.resetColumnProperties = soaResponse.resetColumnProperties;
                                    //merge the new response onto the existing variability data
                                    const map = new Map();
                                    variabilityProps.soaResponse.variabilityTreeData.forEach( item => map.set( item.nodeUid, { ...map.get( item.nodeUid ), ...item } ) );
                                    soaResponse.variabilityTreeData.forEach( item => map.set( item.nodeUid, item ) );
                                    const mergedArr = Array.from( map.values() );
                                    variabilityProps.soaResponse.variabilityTreeData = mergedArr;
                                    variabilityProps.soaResponse.viewModelObjectMap = { ...variabilityProps.soaResponse.viewModelObjectMap, ...soaResponse.viewModelObjectMap };
                                } else {
                                    variabilityProps.soaResponse = soaResponse;
                                }
                            }
                            // Process Partial Errors
                            let partialErrors = _.get( soaResponse, 'ServiceData.partialErrors' );
                            if( partialErrors ) {
                                pca0CommonUtils.processPartialErrors( soaResponse.ServiceData );
                                return;
                            }

                            // Update Load params array with static configuration data
                            if( !_.isUndefined( variabilityProps.resetColumnProperties ) ) {
                                variabilityProps.soaResponse.resetColumnProperties = variabilityProps.resetColumnProperties;
                            }

                            if( viewModel.data && viewModel.data.operation ) {
                                operation = viewModel.data.operation;
                                // Delete operation to avoid its persistence so next time we don't use old operation
                                delete viewModel.data.operation;
                            }

                            // Load tree result according to config parameters specific for each variability tree service
                            var treeLoadResult = exports.getTreeLoadResult( nodeBeingExpanded, treeMaps, variabilityProps, treeDataProvider, operation,
                                undefined, undefined, viewModel.gridEditorSelections );

                            if( !variabilityProps.activeFilter ) {
                                // Cache TreeLoadResult for filtering purposes
                                treeMaps.cachedTreeLoad = treeLoadResult;
                            }
                            //do not replace the treeDataProvider.columnConfig with the action result columnConfig if undefined
                            let colCfg = actionResult.columnConfig ? actionResult.columnConfig : treeDataProvider.columnConfig;
                            return {
                                treeLoadResult: treeLoadResult,
                                columnConfig: colCfg,
                                treeLoadParentNode: nodeBeingExpanded,
                                treeMaps: treeMaps,
                                variabilityProps: variabilityProps
                            };
                        }, function( err ) {
                            // Display error message
                            messagingService.showError( String( err ) );
                            return {
                                treeLoadResult: [],
                                treeLoadParentNode: nodeBeingExpanded
                            };
                        } );
                    } );
            }
        }
    } else {
        // Load intermediate nodes
        // Notes:
        // 1- do not update expandAll. If set to false, it can prevent tree reloading when a filter is cleared
        // 2- do not update cached treeLoadResult used for filtering: in this case treeLoadResult is the list of childNodes for the node being expanded
        treeLoadResult = exports.getTreeLoadResult( nodeBeingExpanded, treeMaps, variabilityProps, treeDataProvider );
    }
    // Delete operation to avoid its persistence so next time we don't use old operation
    if( viewModel.data && viewModel.data.operation ) {
        delete viewModel.data.operation;
    }

    return {
        treeLoadResult: treeLoadResult,
        columnConfig: treeDataProvider.columnConfig,
        treeLoadParentNode: nodeBeingExpanded,
        treeMaps: treeMaps,
        variabilityProps: variabilityProps
    };
};

/**
 * Build Column Properties and Selection Map
 * This process is not depending on tree DataProvider and columns creation
 * @param {String} gridID Grid Identifier
 * @param {Object} soaResponse SOA response
 * @returns {Object} Info container for list of column properties and Selection Map
 */
export let getColumnPropsAndSelectionMap = ( gridID, soaResponse ) => {
    let columnProperties = [];
    let columnSplitIDsMap = {};
    let businessObjectToSelectionMap = {};
    let subjectSelectionMap = {};
    let conditionSelectionMap = {};

    let boKeys = Object.keys( soaResponse.selectedExpressions );
    _.forEach( boKeys, boKey => {
        // NOTE: for Constraints Authoring, 'selectedExpressions' structure is different from VCA
        // VCA comes with one 'configExpressionSections' for each BO
        // Constraints Authoring comes with multiple 'configExpressionSections' (one for each family)
        // Hence:
        // - when building the selectionMap we need to make sure we don't overwrite selectionMap
        // - Build columns once selectionMap is complete, to avoid duplicates
        columnSplitIDsMap[ boKey ] = [];
        let displayName = _getDisplayNameForBusinessObject( soaResponse, boKey );

        let businessObjects = soaResponse.selectedExpressions[ boKey ];
        let configExpressionSections = _.get( businessObjects, '[0].configExpressionSet[0].configExpressionSections' );
        if( !_.isUndefined( configExpressionSections ) && configExpressionSections.length > 0 ) {
            _.forEach( configExpressionSections, configExprSection => {
                const subExpressions = configExprSection.subExpressions;
                if( _.isUndefined( subExpressions ) ) {
                    return; // continue
                }

                let familyToGroupMap = {};
                // create Map of family to group for creation of unique UID ( group:family:feature ) for VCV Grid.
                if( gridID === Pca0Constants.GRID_CONSTANTS.VARIANT_CONFIGURATION ) {
                    familyToGroupMap = createFamilyToGroupMap( soaResponse );
                }
                _.forEach( subExpressions, ( subExpression, idx ) => {
                    // Process selections
                    if( !subExpression.expressionGroups ) {
                        return;
                    }

                    // Process Unique Key and update split column Map
                    let uniqueKey = boKey;
                    if( idx !== 0 ) {
                        uniqueKey = Pca0VCAUtils.instance.generateSplitColumnKey( boKey );
                        columnSplitIDsMap[ boKey ].push( uniqueKey );
                    }

                    let nodeIDToObject = {};
                    Object.values( subExpression.expressionGroups ).forEach( selections => {
                        _.forEach( selections, selection => {
                            let uid = selection.nodeUid;
                            let uniqueUID = '';
                            if( configExprSection.expressionType === Pca0Constants.EXPRESSION_TYPES.SUBJECT_EXPRESSION ) {
                                uniqueUID = veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID + ':';
                            } else if( configExprSection.expressionType === Pca0Constants.EXPRESSION_TYPES.CONDITION_EXPRESSION ) {
                                uniqueUID = veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID + ':';
                            }
                            // Process FreeForm/Enumerated/Unconfigured properties
                            if( !uid && !_.isUndefined( selection.props ) ) {
                                if( selection.props.isFreeFormSelection && selection.props.isFreeFormSelection[ 0 ] ||
                                    selection.props.isEnumeratedRangeExpressionSelection && selection.props.isEnumeratedRangeExpressionSelection[ 0 ] ) {
                                    uniqueUID = selection.family + ':' + selection.valueText;
                                } else if( selection.props.isUnconfigured && selection.props.isUnconfigured[ 0 ] ) {
                                    if( !selection.family ) { // Family is Configure-out
                                        uniqueUID = selection.familyNamespace + ':' + selection.familyId + ':' + selection.valueText;
                                    } else {
                                        uniqueUID = selection.family + ':' + selection.valueText;
                                    }
                                }
                            } else if( gridID === Pca0Constants.GRID_CONSTANTS.VARIANT_CONFIGURATION ) {
                                if( selection.nodeUid === selection.family ) /* family level selection */ {
                                    uniqueUID = familyToGroupMap[ selection.family ] + ':' + selection.family;
                                } else /*feature level selection */ {
                                    uniqueUID = pca0CommonUtils.prepareUniqueId( familyToGroupMap[ selection.family ] + ':' + selection.family, selection
                                        .nodeUid );
                                }
                            } else {
                                // This is for normal features which have nodeUid from TC DB
                                uniqueUID += pca0CommonUtils.prepareUniqueId( selection.family, selection.nodeUid );
                            }
                            nodeIDToObject[ uniqueUID ] = selection;
                        } );
                    } );

                    if( _.isUndefined( businessObjectToSelectionMap[ uniqueKey ] ) ) {
                        businessObjectToSelectionMap[ uniqueKey ] = {};
                        subjectSelectionMap[ uniqueKey ] = {};
                        conditionSelectionMap[ uniqueKey ] = {};
                    }
                    _.assign( businessObjectToSelectionMap[ uniqueKey ], nodeIDToObject );
                    if( configExprSection.expressionType === Pca0Constants.EXPRESSION_TYPES.SUBJECT_EXPRESSION ) {
                        _.assign( subjectSelectionMap[ uniqueKey ], nodeIDToObject );
                    } else if( configExprSection.expressionType === Pca0Constants.EXPRESSION_TYPES.CONDITION_EXPRESSION ) {
                        _.assign( conditionSelectionMap[ uniqueKey ], nodeIDToObject );
                    }
                } );
            } );

            // Create column
            let columnProps = {
                gridID: gridID,
                propertyName: boKey,
                propertyDisplayName: displayName,
                propertyUid: boKey,
                originalColumnName: boKey,
                isSplitColumn: false
            };
            columnProperties.push( columnProps );

            // Add split columns
            _.forEach( columnSplitIDsMap[ boKey ], splitColumnKey => {
                columnProps = {
                    gridID: gridID,
                    propertyName: splitColumnKey,
                    propertyDisplayName: '',
                    propertyUid: splitColumnKey,
                    originalColumnName: boKey,
                    isSplitColumn: true
                };
                columnProperties.push( columnProps );
            } );
        } else {
            // This is for business object with no expression authored yet
            businessObjectToSelectionMap[ boKey ] = {};
            subjectSelectionMap[ boKey ] = {};
            conditionSelectionMap[ boKey ] = {};
            let columnProps = {
                gridID: gridID,
                propertyName: boKey,
                propertyDisplayName: displayName,
                propertyUid: boKey,
                originalColumnName: boKey,
                isSplitColumn: false
            };
            columnProperties.push( columnProps );
        }
    } );

    return { columnProperties, columnSplitIDsMap, businessObjectToSelectionMap, subjectSelectionMap, conditionSelectionMap };
};

/**
 * Create a map of family to its group
 * @param {Object} soaResponse - response of the SOA
 * @returns {Object} family to group map
 */
let createFamilyToGroupMap = function( soaResponse ) {
    let familyGroups = [];
    let familyToGroupMap = {};
    _.forEach( soaResponse.viewModelObjectMap, viewModelObjectNode => {
        if( viewModelObjectNode.sourceType === 'Cfg0FamilyGroup' ||
            viewModelObjectNode.sourceType === Pca0Constants.PSUEDO_GROUPS_UID.PRODUCTS_GROUP_UID ||
            viewModelObjectNode.sourceType === Pca0Constants.PSUEDO_GROUPS_UID.UNASSIGNED_GROUP_UID ) {
            familyGroups.push( viewModelObjectNode.sourceUid );
        }
    } );

    _.forEach( soaResponse.variabilityTreeData, variabilityNode => {
        if( familyGroups.includes( variabilityNode.nodeUid ) ) {
            _.forEach( variabilityNode.childrenUids, family => {
                familyToGroupMap[ family ] = variabilityNode.nodeUid;
            } );
        }
    } );

    return familyToGroupMap;
};

/**
 * Load columns and selections map
 * @param {Array} columnProperties - list of Column Properties
 * @param {Object} variabilityColumnProps - data container for Variability columns properties
 * @param {String} contextKey - Context Key
 * @param {UwDataProvider} treeDataProvider - Data Provider instance
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 * @returns {Object} Column Definitions
 */
export let loadColumns = function( columnProperties, variabilityColumnProps, contextKey, treeDataProvider, vmGridSelectionState ) {
    let columnInfos = [];

    // Render Variability properties as columns
    let columnList = [ Pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT, ...variabilityColumnProps.variabilityPropertiesToDisplay ];
    _.forEach( columnList, ( columnName, indx ) => {
        let width = indx === 0 ? 250 : 100;
        var localeTextBundle = configuratorUtils.getCustomConfigurationLocaleTextBundle();
        let displayName;
        if( columnName === Pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT &&
            !variabilityColumnProps.displayTreeNavigationText ) {
            displayName = '';
        } else {
            switch ( contextKey ) {
                case veConstants.CONFIG_CONTEXT_KEY:
                    localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
                    displayName = localeTextBundle[ veConstants.GRID_CONSTANTS.CONSTRAINTS ] ?
                        localeTextBundle[ veConstants.GRID_CONSTANTS.CONSTRAINTS ] : veConstants.GRID_CONSTANTS.CONSTRAINTS;
                    break;
                default:
                    // Default behavior: 'Variability Content'
                    localeTextBundle = configuratorUtils.getCustomConfigurationLocaleTextBundle();
                    displayName = localeTextBundle[ Pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT ] ?
                        localeTextBundle[ Pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT ] : Pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT;
                    break;
            }
        }
        columnInfos.push( _createVariabilityColumnDef( contextKey, columnName, displayName, width, variabilityColumnProps.enableColumnMenu, treeDataProvider, vmGridSelectionState ) );
    } );

    // Build BO columns
    _.forEach( columnProperties, columnProps => {
        columnInfos.push( exports.createColumnDef( columnProps, contextKey, treeDataProvider, vmGridSelectionState ) );
    } );

    return {
        columnInfos: columnInfos
    };
};

/**
 * Get Tree Load result to populate grid data provider
 * @param {ViewModelTreeNode} nodeBeingExpanded - View Model Tree Node being expanded
 * @param {Object} treeMaps - View Model data property treeMaps
 * @param {Object} variabilityProps - View Model Atomic Data
 * @param {UwDataProvider} treeDataProvider - Tree Data Provider
 * @param {String} operation - The command action that is performed
 * @param {Array} subsetUIDs - UIDs for the subset rootNodes to be displayed
 * @param {Object} gridData - For constraints purpose to expand or collapse
 * @param {Array} gridEditorSelections - Array of alternate ids for VMO visible in constraints grid with familyUid:featureUid
 * @returns {Object} - The Tree Load Result
 */
export let getTreeLoadResult = function( nodeBeingExpanded, treeMaps, variabilityProps, treeDataProvider, operation, subsetUIDs, gridData, gridEditorSelections ) {
    let parentNode = nodeBeingExpanded;
    let soaResponse = variabilityProps.soaResponse;
    let treeNodes = [];
    let variabilityNodes = pca0CommonUtils.getVariabilityNodes( soaResponse );
    let inputNode = _.find( variabilityNodes, { nodeUid: parentNode.nodeUid } );
    let selectionModel = gridEditorSelections ? treeDataProvider.selectionModel : {};
    let presentSelections = gridEditorSelections ? selectionModel.getSelection() : [];
    if( _.isUndefined( treeMaps ) ) {
        // Constraints Grid scenario: we do NOT use treeMaps --> need to remove this dependency from VCV and VCA
        treeMaps = {
            columnSplitIDsMap: soaResponse.columnSplitIDsMap,
            backupOfBusinessObjectToSelectionMap: gridData.backupOfBusinessObjectToSelectionMap
        };

        let parentGridNode = _.find( gridData.variabilityNodes, ( variabilityNode ) => {
            return variabilityNode.nodeUid === nodeBeingExpanded.uid &&
            _.every( variabilityNode.props.parentTree, ( parent ) =>  subsetUIDs.includes( parent ) );
        } );

        if( inputNode ) {
            // Constraints grid: There may be more than 1 input nodes present in SoaResponse's variabilityTreeData.
            // For ex. Fuel family may be present in Subject as well as condition. The differentiation between these 2 nodes
            // is done via props ( parentTree property ).
            // The below logic is written to select the correct input node based on subsetUID ex. select Fuel family node of Condition table
            // from SoaResponse variabilityTreeData if subsetUID is condition table.

            // below array contains the children Node already present in NodeBeingExpanded. Make sure we don't
            // add those elements in childrenUids of inputNode otherwise it may cause duplication of nodes.
            let childrenNodesInNodeBeingExpanded = [];
            if( nodeBeingExpanded.children ) {
                childrenNodesInNodeBeingExpanded = _.map( nodeBeingExpanded.children, ( child ) => {
                    return child.nodeUid;
                } );
            }

            // find variabilityNode which is expanded in tree. But this find should only take that node
            // that belongs to the tree in which the node is expanded. Because there may be case that same family
            // may be present in condition and subject table as well.
            inputNode = _.cloneDeep( _.find( variabilityNodes, ( variabilityNode ) => {
                return variabilityNode.nodeUid === parentNode.nodeUid &&
                _.every( variabilityNode.props.parentTree, ( parent ) => subsetUIDs.includes( parent ) );
            } ) );

            // parentGridNode will be defined only if family is newly added in table using Pick And choose.
            if( parentGridNode ) {
                inputNode.childrenUids = _.union( inputNode.childrenUids, parentGridNode.childrenUids && _.filter( parentGridNode.childrenUids, ( child ) => {
                    return !childrenNodesInNodeBeingExpanded.includes( child );
                } ) );
            } else {
                // This is the case where family is not newly added but features are newly added in table using pick and choose.
                let childrenUids = _.reduce( gridData.variabilityNodes, ( childUids, variabilityNode ) => {
                    if( variabilityNode.parent && _.isEqual( nodeBeingExpanded.uid, variabilityNode.parent[ 0 ] )
                        && !childrenNodesInNodeBeingExpanded.includes( variabilityNode.nodeUid ) ) {
                        childUids.push( variabilityNode.nodeUid );
                    }
                    return childUids;
                }, [] );

                inputNode.childrenUids = _.union( inputNode.childrenUids, childrenUids );
            }

            // filter childrenUids in such a way that there is no duplication of nodes in nodeBeingExpanded and inputNodes's childrenUids.
            inputNode.childrenUids = _.filter( inputNode.childrenUids, ( childUid ) => {
                return !childrenNodesInNodeBeingExpanded.includes( childUid );
            } );
        } else {
            inputNode = _.find( variabilityNodes, { nodeUid: parentNode.nodeUid } );
        }
    }

    // Tree Structure reload
    // recursive tree load operation starting from Root Node
    if( nodeBeingExpanded.id === Pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ) { // First level
        let variantTreeData = soaResponse[ Pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ].variabiltyNodes ?
            soaResponse[ Pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ].variabiltyNodes : soaResponse[ Pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ];
        let rootElement = variantTreeData.filter( treeNode => treeNode.nodeUid === '' );
        assert( rootElement, 'RootElement is missing in the response' );
        parentNode = rootElement[ 0 ];

        // Process active filters
        // Note: filter operation can be done once tree load is complete
        // if user switches display mode, any active filter is reset.
        // if( data.activeFilter && data.activeFilter.operation === 'contains' ) {
        if( variabilityProps.activeFilter ) {
            // In case of active filters, tree nodes is rendered already
            // Use cached treeLoad information to apply filter
            var filter = '';
            filter = variabilityProps.activeFilter.values[ 0 ];
            const treeData = _.cloneDeep( treeMaps.cachedTreeLoad );
            treeNodes = _getFilteredTreeLoadResult( treeData, filter, variabilityProps.activeFilter.operation );
            // If the operation is save in VCA and filter is applied on column, update the props value of each treeNode
            // with the latest soaResponse, so that correct selection states are shown in grid view
            if( _.isEqual( operation, Pca0Constants.GRID_EDIT_OPERATION.SAVE_COMPLETE ) ) {
                _.forEach( treeNodes, ( treeNode ) => {
                    treeNode.props = _generatePropertyMap( treeNode, soaResponse );
                } );
            }

            variabilityProps.filterApplied = true;
        } else {
            // This is the main entry point: dataProvider objects initialization
            // Tree is being loaded for the first time, OR
            // any user action triggered data reload (e.g. change of display mode)
            if( variabilityProps.multiGrid ) {
                let filteredSoaResponse = _.cloneDeep( soaResponse );

                // based on subsetUID, filter out variabilityNode from variabilityTreeData using props ( parentTree : condition/ subject )
                if( subsetUIDs && subsetUIDs.length > 0 ) {
                    let filteredVariabilityTreeData = _.filter( filteredSoaResponse.variabilityTreeData, ( variabilityNode ) => {
                        return variabilityNode.nodeUid === '' // top tree node
                        || variabilityNode.props && variabilityNode.props.parentTree && subsetUIDs.includes( variabilityNode.props.parentTree[ 0 ] ); // nodes belong to subsetUID table
                    } );
                    filteredSoaResponse.variabilityTreeData = [ ...filteredVariabilityTreeData ];
                }
                let rootNode = { ...parentNode };
                // Filter SOA response: remove from rootNode.childrenUids all non matching UIDs
                rootNode.childrenUids = rootNode.childrenUids.filter( id => subsetUIDs.includes( id ) );

                if( gridData.expandAll ) {
                    _recursiveCreateTreeNode(
                        rootNode, // rootNode
                        nodeBeingExpanded.levelNdx + 1, // expandingLevel
                        treeNodes, // treeNodes
                        [], // nodeBeingExpandedChildren
                        filteredSoaResponse, // soaResponse
                        treeMaps.backupOfBusinessObjectToSelectionMap, // backupSelectionMap
                        subsetUIDs, // isSpecialBackgroundCell: for Constraints GridEditor, use special background for root nodes of subsets
                        undefined,
                        undefined,
                        gridData, // for constraint grids
                        variabilityProps.newConstraints // for constraint grids
                    );
                } else {
                    // When collapsing all, look for expand option for each dataProvider
                    _recursiveCreateTreeNode(
                        rootNode, // rootNode
                        nodeBeingExpanded.levelNdx + 1, // expandingLevel
                        treeNodes, // treeNodes
                        [], // nodeBeingExpandedChildren
                        filteredSoaResponse, // soaResponse
                        treeMaps.backupOfBusinessObjectToSelectionMap, // backupSelectionMap
                        subsetUIDs, // isSpecialBackgroundCell: for Constraints GridEditor, use special background for root nodes of subsets
                        gridData.expandOptions.collapseAllLevel, // stopExpansion level
                        gridData.expandOptions.summaryLevel, // for Constraints GridEditor, show Family Summary (level 1) when structure is not expanded
                        gridData, // for constraint grids
                        variabilityProps.newConstraints // for constraint grids
                    );
                }
            } else if( variabilityProps.expansionMap ) {
                _recursiveCreateTreeNodeWithMap( parentNode, nodeBeingExpanded.levelNdx + 1, variabilityProps.expansionMap, treeNodes, [], soaResponse, treeMaps.backupOfBusinessObjectToSelectionMap );
            } else if( variabilityProps.expandAll ) {
                _recursiveCreateTreeNode( parentNode, nodeBeingExpanded.levelNdx + 1, treeNodes, [], soaResponse, treeMaps.backupOfBusinessObjectToSelectionMap, undefined,
                    undefined, undefined, undefined, undefined, gridEditorSelections );
            }
        }
    } else if( inputNode ) {
        let filteredSoaResponse = _.cloneDeep( soaResponse );

        // based on subsetUID, filter out variabilityNode from variabilityTreeData using props ( parentTree : condition/ subject ). Only valid for constraints tab
        if( subsetUIDs && subsetUIDs.length > 0 ) {
            let filteredVariabilityTreeData = _.filter( filteredSoaResponse.variabilityTreeData, ( variabilityNode ) => {
                return variabilityNode.nodeUid === '' // top tree node
                || variabilityNode.props && variabilityNode.props.parentTree && subsetUIDs.includes( variabilityNode.props.parentTree[ 0 ] ); // nodes belonging to subsetUID table
            } );
            filteredSoaResponse.variabilityTreeData = [ ...filteredVariabilityTreeData ];
        }
        // Manual expansion of a tree node
        // Note: when expanding a node, ignore any active filters:
        // If node is present, this means node is filtered -> children are filtered by default
        var childIDs = inputNode.childrenUids;

        // If there are no child elements, update isLeaf property based on SOA response
        if( !childIDs && inputNode.hasOwnProperty( 'props' ) && inputNode.props.hasOwnProperty( 'isLeaf' ) ) {
            _setIsLeafProperty( inputNode, nodeBeingExpanded );
        }

        // For Free Form Values add nodes from freeFormMap
        // which also includes free form option values recently added by user
        var parentUID = parentNode.nodeUid;
        var parentObject = soaResponse.viewModelObjectMap[ parentUID ];
        var loadedObjects = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
        var parentVMO = _.find( loadedObjects, { nodeUid: parentUID } );
        if( ( _isParentFreeForm( parentObject ) || Pca0VariabilityTreeEditService.isEnumeratedFamily( parentObject ) ) &&
            treeMaps.freeFormAndEnumeratedValuesMap && !_.isUndefined( treeMaps.freeFormAndEnumeratedValuesMap[ parentUID ] ) && treeMaps.freeFormAndEnumeratedValuesMap[
            parentUID ].length !== 0 ) {
            // Get list of values from local map, containing all free form values for that parent
            var freeFormChildIDs = treeMaps.freeFormAndEnumeratedValuesMap[ parentUID ];

            // Add childIDs that are not loaded yet
            childIDs = _.filter( freeFormChildIDs, function( childID ) {
                return _.isUndefined( _.find( parentVMO.children, { nodeUid: childID } ) );
            } );

            // isLeaf property is being re-evaluated to include future possibility to remove freeForm
            nodeBeingExpanded.isLeaf = freeFormChildIDs.length === 0;
        }
        _.forEach( childIDs, id => {
            var loadedChildrenNo = parentVMO.children ? parentVMO.children.length : 0;
            var childNdx = loadedChildrenNo + childIDs.indexOf( id );

            // For multiGrid, validate if cell summary is needed
            let expandingLevel = nodeBeingExpanded.levelNdx + 1;
            let treeNode = exports.createViewModelTreeNode(
                id, // nodeUid
                expandingLevel, // levelNdx
                nodeBeingExpanded.nodeUid, // parentNodeUid,
                nodeBeingExpanded.alternateID, // parentNode alternateID,
                childNdx, // childNdx
                filteredSoaResponse, // soaResponse
                treeMaps.backupOfBusinessObjectToSelectionMap, // backupSelectionMap
                !_.isUndefined( subsetUIDs ) && subsetUIDs.includes( id ), // isSpecialBackgroundCell
                gridData
            );

            // Update Summary if needed
            let showSummary = variabilityProps.multiGrid ?
                expandingLevel === gridData.expandOptions.summaryLevel : false;
            if( showSummary ) {
                pca0CommonUtils.updateViewModelTreeNodeSummary(
                    gridData.businessObjectToSelectionMap, // selectionMap
                    treeNode, // viewModelTreeNode
                    soaResponse.viewModelObjectMap
                );
            }
            if ( gridEditorSelections && !_.isEmpty( gridEditorSelections ) && treeNode.isLeaf ) {
                _.find( gridEditorSelections, gridEditorData => {
                    if( treeNode.alternateID.includes( gridEditorData ) ) {
                        presentSelections.push( treeNode.alternateID );
                        treeNode.isPreselected = true;
                        return true;
                    }
                } );
            }
            treeNodes.push( treeNode );
        } );
    }

    return {
        parentNode: nodeBeingExpanded,
        childNodes: treeNodes,
        totalChildCount: treeNodes.length,
        startChildNdx: 0
    };
};
/**
 * Create a split column
 * Add new column, update BusinessOjects selection map and internal ID maps
 * @param {String} contextKey - Current Context Key
 * @param {Object} eventData - data carried by validate trigger event
 * @param {Object} vmTreeMaps - View Model data property treeMaps
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} vmGridSelectionState - View Model Atomic Data <gridSelectionState>
 * @returns {Object} - Collection of data to be dispatched
 */
export let createSplitColumn = function( contextKey, eventData, vmTreeMaps, vmVariabilityProps, vmGridSelectionState ) {
    // Clone current status for VM data and fields (atomic data)
    var treeMaps = { ...vmTreeMaps };
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };
    let treeDataProvider = eventData.treeDataProvider;
    let columnDef = eventData.columnDef;
    columnDef.enableColumnMenu = true;

    let splitColumnDef = exports.createColumnDef( columnDef, contextKey, treeDataProvider, vmGridSelectionState );
    let cols = treeDataProvider.columnConfig.columns;
    cols.splice( eventData.newColumnIndexToInsert, 0, splitColumnDef );

    // Update Map of Split Columns
    if( !treeMaps.columnSplitIDsMap[ splitColumnDef.originalColumnName ] ) {
        treeMaps.columnSplitIDsMap[ splitColumnDef.originalColumnName ] = [];
    }
    treeMaps.columnSplitIDsMap[ splitColumnDef.originalColumnName ].push( splitColumnDef.name );

    var vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    _.forEach( vmos, vmo => {
        vmo.props[ columnDef.propertyUid ] = exports.getViewModelProperty( columnDef.propertyUid, vmo.parentUID, 0, {} );
    } );

    // Add entry to selection map
    variabilityProps.soaResponse.businessObjectToSelectionMap[ columnDef.propertyUid ] = {};

    return {
        columnConfig: {
            columns: [ ...cols ]
        },
        treeMaps: treeMaps,
        variabilityProps: variabilityProps
    };
};

export default exports = {
    createColumnDef,
    getViewModelProperty,
    createViewModelTreeNode,
    iconCellRenderer,
    filterCellRenderer,
    loadTreeProviderData,
    getColumnPropsAndSelectionMap,
    loadColumns,
    getTreeLoadResult,
    createSplitColumn,
    populateHeaderIcon,
    checkViolations
};

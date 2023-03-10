// <TODO> remove below complexity ignore lines and address the issue
// Complexity check is temporarily commented to ease readability
/* eslint-disable complexity */
/* eslint-disable sonarjs/cognitive-complexity */

// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0VariabilityTreeEditService
 */
import appCtxService from 'js/appCtxService';
import commonUtils from 'js/pca0CommonUtils';
import editHandlerService from 'js/editHandlerService';
import enumFeature from 'js/pca0EnumeratedFeatureService';
import eventBus from 'js/eventBus';
import Pca0Constants from 'js/Pca0Constants';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import pca0ConstraintsGridService from 'js/pca0ConstraintsGridService';
import Pca0ExpressionGridService from 'js/Pca0ExpressionGridService';
import Pca0VariantConditionAuthoringGridService from 'js/Pca0VariantConditionAuthoringGridService';
import pca0VariantFormulaEditorService from 'js/pca0VariantFormulaEditorService';
import Pca0VCAUtils from 'js/pca0VCAUtils';
import _ from 'lodash';

/**
 * Validate Edit Action is allowed on clicked cell
 * @param {Object} cellDetails - cell details
 * @return {Boolean} True if edit action is allowed on clicked cell
 */
let _isCellEditingAllowed = ( cellDetails ) => {
    if( cellDetails.column.isTreeNavigation ) {
        return false;
    }

    // Disable editing on Summarized cells.
    if( !_.isUndefined( cellDetails.vmo.props ) && !_.isUndefined( cellDetails.vmo.props[ cellDetails.column.field ].isSummarized ) &&
        cellDetails.vmo.props[ cellDetails.column.field ].isSummarized === true ) {
        return false;
    }

    // Editing is disabled in Constraints Grid Editor for <Properties Information, Subject, Condition> nodes
    if( cellDetails.vmo.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID || cellDetails.vmo.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ||
        cellDetails.vmo.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ) {
        return false;
    }

    // Editing is disabled in Constraints Grid Editor for childNodes of <Properties Information>
    if( cellDetails.vmo.parentUID === veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID ) {
        return false;
    }
    return true;
};

/**
 * Update the cell click on VMO and SOA structure.
 * Fire event to trigger UI VMO update - necessary after removing the $watch from code
 * Fire event to update selection map
 * @param {String} gridId - Grid Identifier
 * @param {Object} vmo - View Model Object to be updated
 * @param {String} columnField - Column Identifier
 * @param {Boolean} isVMOReset - true if VMO selection state needs to be reset
 * @param {Number} isSingleClick - CLick number to identify progress in dbValue change
 */
let updateCellData = function( gridId, vmo, columnField, isVMOReset, isSingleClick ) {
    var dbValue = 0;

    // Scenario: family selection. Update on childVMOs is called with isVMOReset set to true
    if( isVMOReset ) {
        vmo.props[ columnField ].dbValue = [ dbValue ];
        if( vmo.props[ columnField ].originalValue === dbValue ) {
            vmo.props[ columnField ].dirty = false;
            vmo.props[ columnField ].valueUpdated = false;
            vmo.props[ columnField ].displayValueUpdated = false;
        } else {
            vmo.props[ columnField ].dirty = true;
            vmo.props[ columnField ].valueUpdated = true;
            vmo.props[ columnField ].displayValueUpdated = true;
        }
    } else {
        if( vmo.props[ columnField ].dbValue.length > 0 ) {
            dbValue = vmo.props[ columnField ].dbValue[ 0 ];
        }
        // If click value is 3 don't change value as it is updated in clear/paste operation
        if( isSingleClick === 3 ) {
            dbValue = vmo.props[ columnField ].dbValue[ 0 ];
        } else if( isSingleClick ) {
            dbValue = ( dbValue + 1 ) % 3;
        }
        vmo.props[ columnField ].dbValue = [ dbValue ];

        if( vmo.props[ columnField ].originalValue === dbValue ) {
            vmo.props[ columnField ].dirty = false;
            vmo.props[ columnField ].valueUpdated = false;
            vmo.props[ columnField ].displayValueUpdated = false;
        } else {
            vmo.props[ columnField ].dirty = true;
            vmo.props[ columnField ].valueUpdated = true;
            vmo.props[ columnField ].displayValueUpdated = true;
        }

        // Prepare event data to trigger logic to update selection map
        var eventData = {
            gridId: gridId,
            vmo: vmo,
            columnField: columnField,
            dbValue: dbValue
        };

        // Trigger logic to update selection map
        eventBus.publish( 'Pca0VariabilityTreeEditService.populateUserEdits', eventData );
    }

    // Fire event to update VMO rendering
    // This call is necessary to inform on the value changed (after $watch removal)
    eventBus.publish( 'Pca0VariabilityTreeEditService.vmoUpdated', { vmo: vmo, columnField: columnField } );
};

/**
 * Format Date string
 * @param {String} dateString - input Date String
 * @returns {String} formatted expression
 */
let _getFormattedDateString = function( dateString ) {
    let expStr = '';
    const result = dateString.split( ' ' );

    if( result.length > 1 ) {
        const fromOp = result[ 0 ];
        const fromDate = result[ 1 ];
        const toOp = result[ 3 ];
        const toDate = result[ 4 ];

        expStr = fromOp + ' ' + commonUtils.getFormattedDateString( new Date( fromDate ) );
        if( result[ 3 ] && result[ 4 ] ) {
            const toDateStr = commonUtils.getFormattedDateString( new Date( toDate ) );
            expStr += ' & ' + toOp + ' ' + toDateStr;
        }
    } else {
        expStr = commonUtils.getFormattedDateString( new Date( dateString ) );
    }
    return expStr;
};

/**
 * Create entry in selection map
 * @param {String} parentUID - UID of parent Node
 * @param {Object} parentObject - Parent Node from viewModelObjectMapin soaResponse
 * @param {String} nodeID - UID of Node
 * @param {Object} variabilityNode - Node from variabiltyNodes collection in soaResponse
 * @param {Object} eventData - eventData
 * @param {Object} selectionMap - selectionMap
 * @param {Object} freeFormEnumeratedValuesMap - Map of Free Form and Enumerated Values
 * @returns {Object} selection map entry
 */
let _createEntryInSelectionMap = function( parentUID, parentObject, nodeID, variabilityNode, eventData, selectionMap, freeFormEnumeratedValuesMap ) {
    // Scenario: FreeForm/Enumerated selection
    let isRangeExpr = false;
    let textForRangeExpr = '';
    let isFreeFormFamily = parentObject ? _.get( parentObject, 'props.isFreeForm[0]' ) : parentObject;
    let enumMap = parentObject ? _.get( freeFormEnumeratedValuesMap, parentUID ) : parentObject;
    if( parentObject && ( isFreeFormFamily || exports.isEnumeratedFamily( parentObject ) ) && enumMap && enumMap.length !== 0 ) {
        // Scenario: FreeForm/Enumerated family selection
        if( parentUID === nodeID ) {
            selectionMap[ nodeID ] = {
                family: parentUID,
                nodeUid: nodeID,
                selectionState: eventData.dbValue,
                props: {
                    isFamilyLevelSelection: [ 'true' ]
                }
            };
            // Scenario: FreeForm/Enumerated feature selection
        } else {
            // valueText should be added if nodeID is part of rangeExpression of freeForm or enumerated family
            // e.g. of range expr as ' familyUID:<= 2 ' or 'familyUID:>3.4 & <5.6'
            const nodeIDValues = nodeID.split( ':' );
            if( nodeIDValues && nodeIDValues.length > 1 &&
                nodeIDValues[ 0 ] === parentUID && nodeIDValues[ 1 ] === eventData.vmo.displayName ) {
                isRangeExpr = true;
                if( eventData.vmo.isParentEnumerated ) {
                    textForRangeExpr = enumFeature.getServerNamesForEnumeratedFeature( eventData.vmo.displayName,
                        parentObject.props.cfg0ChildrenIDs,
                        parentObject.props.cfg0ChildrenDisplayNames );
                } else {
                    textForRangeExpr = eventData.vmo.displayName;
                }
            }

            let enumeratedFeatureUID = '';
            if( !isRangeExpr ) {
                //keep node uid
                enumeratedFeatureUID = nodeID;
            }
            selectionMap[ nodeID ] = {
                family: parentUID,
                familyId: '',
                nodeUid: enumeratedFeatureUID,
                props: {},
                selectionState: eventData.dbValue,
                valueText: textForRangeExpr
            };
        }
        if( parentObject.props.isFreeForm && parentObject.props.isFreeForm[ 0 ] === 'true' ) {
            selectionMap[ nodeID ].props.isFreeFormSelection = [ 'true' ];
        }
        if( isRangeExpr && eventData.vmo.isParentEnumerated ) {
            selectionMap[ nodeID ].props.isEnumeratedRangeExpressionSelection = [ 'true' ];
        }

        if( parentObject && parentObject.props && parentObject.props.cfg0ValueDataType[ 0 ] === 'Date' && parentObject.props.isFreeForm[ 0 ] === 'true' ) {
            selectionMap[ nodeID ].valueText = _getFormattedDateString( selectionMap[ nodeID ].valueText );
        }
        return selectionMap[ nodeID ];
    } else if( !_.isUndefined( variabilityNode ) && variabilityNode.props && variabilityNode.props.isUnconfigured && variabilityNode.props.isUnconfigured[ 0 ] ) {
        // Scenario: Unconfigured selection
        selectionMap[ nodeID ] = {
            family: parentUID,
            familyId: '',
            nodeUid: '',
            props: {
                isUnconfigured: [ 'true' ]
            },
            selectionState: eventData.dbValue,
            valueText: eventData.vmo.valueText ? eventData.vmo.valueText : eventData.vmo.displayName
        };
        return selectionMap[ nodeID ];
    } else if( parentUID === nodeID ) {
        // Scenario: Family selection
        selectionMap[ nodeID ] = {
            family: parentUID,
            nodeUid: nodeID,
            selectionState: eventData.dbValue,
            props: {
                isFamilyLevelSelection: [ 'true' ]
            }
        };
        return selectionMap[ nodeID ];
        // Scenario: Feature selection
    }
    selectionMap[ eventData.vmo.alternateID ] = {
        family: parentUID,
        nodeUid: nodeID,
        props: {},
        selectionState: eventData.dbValue
    };
    return selectionMap[ eventData.vmo.alternateID ];
};

/**
 * API to know if parant is a familyGroup or a Subject or a Condition node. This is required in a VCV Matrix view and in a Constraints Grid to know if currect selection
 * is a family level selection.
 * @param {Object} parentUID - UID of a parent.
 * @param {Object} viewModelObjectMap - View Model Object Map from SOAResponse.
 * @returns {Boolean} True if parentUID is of group type or Subject Or Condition to know it is a family level selection.
 */
let _isParentIsOfTypeGroup = ( parentUID, viewModelObjectMap ) => {
    if( parentUID === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID || parentUID === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ||
        parentUID === Pca0Constants.PSUEDO_GROUPS_UID.PRODUCTS_GROUP_UID || parentUID === Pca0Constants.PSUEDO_GROUPS_UID.UNASSIGNED_GROUP_UID ) {
        return true;
    }
    let parentObject = viewModelObjectMap[ parentUID ];
    if( parentObject && parentObject.sourceType === 'Cfg0FamilyGroup' ) {
        return true;
    }
    return false;
};

/*
 *   Export APIs section starts
 */
let exports = {};

/**
 * Update ViewModelObject for cell
 * Dispatch Data Provider changes
 * @param {Object} cellDetails - cell details
 */
export let updateVMO = function( cellDetails ) {
    let treeDataProvider = cellDetails.treeDataProvider;
    let gridId = treeDataProvider.json.gridId;

    // Prevent any further actions for VMO with no edits allowed.
    if( !_.isUndefined( treeDataProvider.json.minEditLevelNdx ) && cellDetails.vmo.levelNdx < treeDataProvider.json.minEditLevelNdx ) {
        return;
    }

    var vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    var updatedVMOs = [ ...vmos ];
    let vmo = _.find( updatedVMOs, { alternateID: cellDetails.vmo.alternateID } );

    // Leaf changes: update VMO only if parentNode has no selections
    // parentUID is different for Leaf nodes in VCV and VCA: analyze isLeaf property instead of parentUID value
    if( vmo.isLeaf && vmo.parentUID !== '' ) {
        let parentVMO = _.find( vmos, { nodeUid: vmo.parentUID } );
        if( parentVMO.props[ cellDetails.column.field ].dbValue.length === 0 ||
            parentVMO.props[ cellDetails.column.field ].dbValue[ 0 ] === 0 ) {
            updateCellData( gridId, vmo, cellDetails.column.field, false, cellDetails.isSingleClick );
        }
        // If family is not boolean, optional ( cfg0IsDiscretionary = true ) and isSingleSelect then only family level selection is allowed.
        // Uncomment isOptional, after issues in family level selection while updating selection map are fixed.(createEntryInSelectionMap )
    } else if( vmo.type !== 'Boolean' && vmo.isSingleSelect /* && vmo.isOptional */ ) {
        // If VMO is not a leaf, update VMO and reset children VMOs
        updateCellData( gridId, vmo, cellDetails.column.field, false, cellDetails.isSingleClick );
        if( !vmo.children ) {
            vmo.children = [];
        }
        for( var cIDx = 0; cIDx < vmo.children.length; cIDx++ ) {
            updateCellData( gridId, vmo.children[ cIDx ], cellDetails.column.field, true );
        }
    }

    // Call dispatch on data provider
    // this is a temporary solution, as DataProvider.update is not working in React - fix is in progress
    // TODO: revisit me: contact Radhika
    treeDataProvider.vmCollectionDispatcher( {
        type: 'COLLECTION_REPLACE',
        viewModelObjects: updatedVMOs,
        totalFound: updatedVMOs.length
    } );

    // Fire event to trigger post actions
    eventBus.publish( 'Pca0VariabilityTreeEdit.selectionMapChanged', { gridId: cellDetails.treeDataProvider.json.gridId } );
};

/**
 * Handle click event on the cell
 * @param {String} contextKey - the Context key
 * @param {Object} cellDetails - cell details
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 */
export let handleCellClick = function( contextKey, cellDetails, vmGridSelectionState ) {
    // Close Add panel if open
    var eventData = {
        source: 'toolAndInfoPanel'
    };
    eventBus.publish( 'complete', eventData );

    var isFreeForm = false;
    if( cellDetails.vmo ) {
        isFreeForm = cellDetails.vmo.isFreeForm;
    }

    // Update Atomic Data with Grid Selection State
    // Dispatch atomic data changes
    let newGridSelectionState = {
        selectionInfo: cellDetails.vmo,
        isFreeFormOptionValueSelected: isFreeForm
    };
    vmGridSelectionState.setAtomicData( newGridSelectionState );

    if( event ) {
        event.stopPropagation();
    }

    if( !_isCellEditingAllowed( cellDetails ) ) {
        return;
    }

    // Get edit mode state
    var isVariantTableEditing = appCtxService.getCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE );

    // Get context and see if edit mode is automatically activated
    var context = appCtxService.getCtx( contextKey );
    if( !isVariantTableEditing && context.autoEditMode ) {
        appCtxService.updateCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, true );

        // Notify Edit mode is now active.
        // This will allow subscribers to take care of synchronizing own editHandler states
        eventBus.publish( 'Pca0VariabilityTree.editModeActivated', { editingContext: contextKey } );

        isVariantTableEditing = true;
    }

    if( isVariantTableEditing ) {
        cellDetails.isSingleClick = true;
        exports.updateVMO( cellDetails );
    }
};

/**
 * Update Selection Map
 * @param {Object} vmTreeMaps - View Model data property treeMaps
 * @param {Object} vmVariabilityProps - View Model Atomic Data
 * @param {Object} eventData - Event Data
 * @param {Object} gridData - This is useful to update gridData with respective to constraints grid only.
 * @return {Object} atomic data to be dispatched
 */
export let populateUserEdits = function( vmTreeMaps, vmVariabilityProps, eventData, gridData ) {
    // Clone current status for VM data and fields (atomic data)
    var treeMaps = { ...vmTreeMaps };
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };

    let nodeID = eventData.vmo.nodeUid;
    let businessObjectToSelectionMap = variabilityProps.soaResponse.businessObjectToSelectionMap;
    let gridProps = undefined;
    if( gridData ) {
        treeMaps = {};
        gridProps = gridData.getAtomicData();
        treeMaps.backupOfBusinessObjectToSelectionMap = { ...gridProps.backupOfBusinessObjectToSelectionMap }; // in case of constraints grid we need to update,
        businessObjectToSelectionMap = gridProps.businessObjectToSelectionMap;
    }
    let variabilityNodes = commonUtils.getVariabilityNodes( variabilityProps.soaResponse );
    let variabilityNode = _.find( variabilityNodes, { nodeUid: nodeID } );
    let selectionMap = businessObjectToSelectionMap[ eventData.columnField ];
    let node = !_.isUndefined( selectionMap[ eventData.vmo.alternateID ] ) ? selectionMap[ eventData.vmo.alternateID ] : selectionMap[ nodeID ];
    if( node ) {
        node.selectionState = eventData.dbValue;
    } else if( eventData.dbValue !== 0 ) {
        let parentUID = eventData.vmo.parentUID !== '' ? eventData.vmo.parentUID : eventData.vmo.nodeUid;
        // if parentUID is of group type or Subject Or Condition i.e means it is a family level selection.Set parentUID = nodeID.
        // _createEntryInSelectionMap() takes care of family level selection if parentUID = nodeID.
        if( _isParentIsOfTypeGroup( parentUID, variabilityProps.soaResponse.viewModelObjectMap ) ) {
            parentUID = nodeID;
        }
        let parentObject = variabilityProps.soaResponse.viewModelObjectMap[ parentUID ];
        // Create node only if selection state is not 0 (blank)
        node = _createEntryInSelectionMap( parentUID, parentObject, nodeID, variabilityNode, eventData, selectionMap, treeMaps.freeFormAndEnumeratedValuesMap );
    }

    // For family selections, make sure to clear all feature selections for that family
    if( node && node.props && node.props.isFamilyLevelSelection && node.props.isFamilyLevelSelection[ 0 ] ) {
        var featureSelections = _.filter( selectionMap, { family: nodeID } );
        _.forEach( featureSelections, featureSelection => {
            if( featureSelection.family !== featureSelection.nodeUid ) {
                featureSelection.selectionState = 0;
            }
        } );
    }

    // Remove all zero-selections: clean up right after a selection change happens
    Pca0ExpressionGridService.removeZeroSelections( businessObjectToSelectionMap );
    if( gridData ) {
        gridData.setAtomicData ? gridData.setAtomicData( { ...gridProps } ) : gridData.update( { ...gridProps } );
    }

    if( gridData ) { // For top and bottom grid selection changes, keep on collecting updated constraints.
        let newDirtyElements = exports.markElementsDirtyOnUserEdit( businessObjectToSelectionMap, treeMaps );
        variabilityProps.dirtyElements = [ ...variabilityProps.dirtyElements, ...newDirtyElements  ];
    } else {
        variabilityProps.dirtyElements = exports.markElementsDirtyOnUserEdit( businessObjectToSelectionMap, treeMaps );
    }
    // Return AtomicData (containing updated selection map) to be dispatched
    return variabilityProps;
};

/**
 * This function will keep a track of dirty elements that contain unsaved user edits in a tree.
 * @param {Object} businessObjectToSelectionMap - Businessobject to selction map
 * @param {Object} treeMaps - View Model data property treeMaps
 * @returns {Array} Array containing list of elements containing user edits
 */
export let markElementsDirtyOnUserEdit = function( businessObjectToSelectionMap, treeMaps ) {
    let clonedSelectionMap = _.cloneDeep( businessObjectToSelectionMap );
    let dirtyElements = [];
    let backupOfBusinessObjectToSelectionMap = treeMaps.backupOfBusinessObjectToSelectionMap;
    if( !_.isEqual( clonedSelectionMap, backupOfBusinessObjectToSelectionMap ) ) {
        let keys = Object.keys( clonedSelectionMap );
        keys.forEach( key => {
            let originalSelectionMap = backupOfBusinessObjectToSelectionMap[ key ];
            let newSelectionMap = clonedSelectionMap[ key ];
            if( !_.isEqual( originalSelectionMap, newSelectionMap ) ) {
                key = Pca0VCAUtils.instance.getOriginalColumnKeyFromSplitColumnKey( key );
                if( !dirtyElements.includes( key ) ) {
                    dirtyElements.push( key );
                }
            }
        } );
    }
    return dirtyElements;
};

/**
 * Validate if family is enumerated
 * @param {Object} parentObject - parent object
 * @returns {Boolean} true/false if family is enumerated
 */
export let isEnumeratedFamily = function( parentObject ) {
    if( parentObject.props && parentObject.props.cfg0ValueDataType ) {
        let valueType = parentObject.props.cfg0ValueDataType[ 0 ];
        return [ 'Integer', 'Floating Point', 'Date' ].includes( valueType );
    }
};

/**
 * Return Save Handler for active Edit Context
 * @return {Object} Save Handler
 */
export let getSaveHandler = () => {
    var activeEditHandler = editHandlerService.getActiveEditHandler();
    if( activeEditHandler && activeEditHandler.getEditHandlerContext ) {
        var activeEditContext = activeEditHandler.getEditHandlerContext();
        switch ( activeEditContext ) {
            case 'variantConditionContext':
                return Pca0VariantConditionAuthoringGridService.getSaveHandler();
            case 'FORMULA_EDIT_CONTEXT':
                return pca0VariantFormulaEditorService.getSaveHandler();
            case 'ConfiguratorCtx':
                return pca0ConstraintsGridService.getSaveHandler();
            default:
                return null;
        }
    }
};

/**
 * Clear selections for the given column
 * @param {Object} treeDataProvider - Tree Data Provider
 * @param {Object} vmVariabilityProps - View Model Atomic Data
 * @param {Object} eventData - data carried by validate trigger event
 * @returns {Object} - Collection of data to be dispatched
 */
export let clearColumnSelections = function( treeDataProvider, vmVariabilityProps, eventData ) {
    // Clone current status for atomic data
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };

    let columnUid = eventData.column.field;

    // Update the backend selection map with the view model data
    variabilityProps.soaResponse.businessObjectToSelectionMap[ columnUid ] = {};

    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let tableColumn = _.find( treeDataProvider.cols, col => col.uid === columnUid );

    _.forEach( vmos, vmo => {
        let dbVal = vmo.props[ columnUid ].dbValue instanceof Array ? vmo.props[ columnUid ].dbValue[ 0 ] : vmo.props[ columnUid ].dbValue;
        //performance enhancement: only updateVMO for values that are not already clear
        if( dbVal !== 0 ) {
            vmo.props[ columnUid ].dbValue = [ 0 ];
            let cellDetails = {
                vmo: vmo,
                column: tableColumn,
                treeDataProvider: treeDataProvider,
                isSingleClick: 3
            };
            exports.updateVMO( cellDetails );
        }
    } );

    return {
        variabilityProps: variabilityProps
    };
};

/**
 * Copy selections for the given column
 * @param {Object} vmVariabilityProps - View Model Atomic Data
 * @param {Object} eventData - data carried by validate trigger event
 */
export let copyColumnSelections = function( vmVariabilityProps, eventData ) {
    // Clone current status for atomic data
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };
    let businessObjectToSelectionMap = variabilityProps.soaResponse.businessObjectToSelectionMap;
    let columnUid = eventData.column.field;
    let columnSelections = { ...businessObjectToSelectionMap[ columnUid ] };
    let copiedSelectionCache = undefined;
    if( Object.keys( columnSelections ).length > 0 ) {
        copiedSelectionCache = columnSelections;
    }
    appCtxService.updatePartialCtx( 'variantConditionContext.copiedSelectionsCache', copiedSelectionCache );
};

/**
 * Paste copied selections on given column
 * @param {Object} treeDataProvider - Tree Data Provider
 * @param {Object} vmVariabilityProps - View Model Atomic Data
 * @param {Object} eventData - data carried by validate trigger event
 * @returns {Object} - Collection of data to be dispatched
 */
export let pasteSelectionsOnColumn = function( treeDataProvider, vmVariabilityProps, eventData ) {
    // Clone current status for atomic data
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };

    let columnUid = eventData.column.field;
    let copiedSelections = appCtxService.getCtx( 'variantConditionContext.copiedSelectionsCache' );

    // Update the backend selection map with the view model data
    variabilityProps.soaResponse.businessObjectToSelectionMap[ columnUid ] = { ...copiedSelections };

    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let tableColumn = _.find( treeDataProvider.cols, col => col.uid === columnUid );

    _.forEach( vmos, vmo => {
        var selectionState = 0;
        if( Object.keys( copiedSelections ).includes( vmo.alternateID ) ) {
            selectionState = copiedSelections[ vmo.alternateID ].selectionState;
        }

        // Update VMO only if selectionState is different
        if( vmo.props[ columnUid ].dbValue[ 0 ] !== selectionState ) {
            vmo.props[ columnUid ].dbValue[ 0 ] = selectionState;

            let cellDetails = {
                vmo: vmo,
                column: tableColumn,
                treeDataProvider: treeDataProvider,
                isSingleClick: 3
            };
            exports.updateVMO( cellDetails );
        }
    } );

    return {
        variabilityProps: variabilityProps
    };
};

export default exports = {
    updateVMO,
    handleCellClick,
    populateUserEdits,
    markElementsDirtyOnUserEdit,
    isEnumeratedFamily,
    getSaveHandler,

    // Column Menu actions
    clearColumnSelections,
    copyColumnSelections,
    pasteSelectionsOnColumn
};

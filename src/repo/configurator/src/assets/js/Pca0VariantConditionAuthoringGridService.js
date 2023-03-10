// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0VariantConditionAuthoringGridService
 */
import appCtxService from 'js/appCtxService';
import configuratorUtils from 'js/configuratorUtils';
import dataSourceService from 'js/dataSourceService';
import editHandlerFactory from 'js/editHandlerFactory';
import editHandlerService from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import pca0ExpressionGridService from 'js/Pca0ExpressionGridService';
import Pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import Pca0VCAUtils from 'js/pca0VCAUtils';
import _ from 'lodash';

/**
 * Event listeners
 */
var _vcaTableReloadListener = null;

/**
 * Grid Event Handlers
 * splm edit/save handlers help detect unsaved edits
 * (when changing selection in primary workarea or navigating to another tab)
 * and handle cancel/save actions
 */
var m_editHandler;
var m_saveHandler;

/**
 * TODO REMOVE AND USE pca0CommonUtils
 * Return Selection Objects for getVariantExpressionData3 SOA Input
 * Handle the scenario when consumer apps have set selections
 * @returns {Object} Selected Objects
 */
let _getSelectedObjectsForSOA = function() {
    var allowConsumerAppsToLoadData = appCtxService.getCtx( 'variantConditionContext.allowConsumerAppsToLoadData' );
    if( allowConsumerAppsToLoadData ) {
        var selectedObjectsFromConsumerApps = appCtxService.getCtx( 'variantConditionContext.selectedObjectsFromConsumerApps' );
        if( selectedObjectsFromConsumerApps ) {
            return selectedObjectsFromConsumerApps;
        }
    }

    // Send selectedModelObjects as per primary work area if defined.
    // mselected might have been overwritten by manual selection change in dataprovider selectionModel
    let vcaContext = appCtxService.getCtx( 'variantConditionContext' );
    if( !_.isUndefined( vcaContext.selectedModelObjects ) ) {
        // getVariantExpressionData3 SOA only accepts 'type' and 'uid' props for selectedObjects
        // as it internally converts each MO to a tag_t -> we need to omit other properties
        var selectedObjects = [];
        _.forEach( [ ...vcaContext.selectedModelObjects ], function( mo ) {
            var filteredMO = _.pick( mo, [ 'type', 'uid' ] );
            selectedObjects.push( filteredMO );
        } );
        return selectedObjects;
    }
    return appCtxService.getCtx( 'mselected' );
};

/**
 * Return filter string for VCA2 SOA call
 * @returns {String} filter string
 */
let _getGridOptionFiltersForVca = function() {
    let configuratorContext = appCtxService.getCtx( 'configuratorContext' );
    if( configuratorContext.vcaVariabilityDisplayModeInGrid === Pca0Constants.GRID_DISPLAY_MODE.CURRENT ) {
        return 'pca0_show_current';
    }
    return 'pca0_show_all';
};

/**
 * Trigger save actions
 * @param {Object} soaResponse - SOA response
 */
let _triggerSaveVariantExpressions = function( soaResponse ) {
    // Integration MFG has override for Save behavior
    if( appCtxService.getCtx( 'variantConditionContext.consumerAppsOverrideSave' ) ) {
        var expressions = [];
        let selectionMap = soaResponse.businessObjectToSelectionMap;
        let boKeys = Object.keys( selectionMap );
        _.forEach( boKeys, boKey => {
            var elementExpressions = {
                affectedObject: Pca0VCAUtils.instance.getOriginalColumnKeyFromSplitColumnKey( boKey ),
                familySelections: {},
                userSelections: {}
            };

            // Get displayName
            var viewModelObject = soaResponse.viewModelObjectMap[ boKey ];
            elementExpressions.displayValue = viewModelObject && viewModelObject.displayName ? viewModelObject.displayName : boKey;

            let selections = selectionMap[ boKey ];
            let selectionKeys = Object.keys( selections );
            _.forEach( selectionKeys, selectionKey => {
                let selection = selections[ selectionKey ];

                // Family selection, format:
                // familySelections:
                //   isRh2P2YI7h15C: 1
                if( selection.props && selection.props.isFamilyLevelSelection && selection.props.isFamilyLevelSelection[ 0 ] ) {
                    elementExpressions.familySelections[ selection.nodeUid ] = selection.selectionState;
                } else {
                    // User selection, format:
                    // userSelections:
                    //  iwTh2P2YI7h15C:
                    //    0: {optionValue: "30", selectionState: 1}
                    if( !elementExpressions.userSelections.hasOwnProperty( selection.family ) ) {
                        elementExpressions.userSelections[ selection.family ] = [];
                    }

                    var optionValue = '';
                    if( !selection.nodeUid && selection.props && selection.props.isFreeFormSelection && selection.props.isFreeFormSelection[ 0 ] ) {
                        optionValue = selection.valueText;
                    } else {
                        optionValue = selection.nodeUid;
                    }
                    elementExpressions.userSelections[ selection.family ].push( {
                        optionValue: optionValue,
                        selectionState: selection.selectionState
                    } );
                }
            } );

            expressions.push( elementExpressions );
        } );
        eventBus.publish( 'vcagrid.save', expressions );
        return;
    }
    eventBus.publish( 'Pca0VariantConditionAuthoringGrid.SaveExpressions', {} );
};

/**
 * Set VMOs properties
 * - to original values from DB OR
 * - to status-quo value
 * In both cases, reset dirty flags and trigger events to update cell 'changed' style
 * @param {Object} treeDataProvider - Tree Data Provide
 * @param {Boolean} reset - True if values need to be reset to original value (i.e. Cancel operation), false to set to current value (i.e. Save operation)
 * @returns {Object} vmos - Returns updated VMOS
 */
let _setPropertiesToValue = function( treeDataProvider, reset ) {
    var vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    for( var iDx = 0; iDx < vmos.length; iDx++ ) {
        var properties = vmos[ iDx ].props;
        for( var property in properties ) {
            if( properties[ property ].originalValue !== properties[ property ].dbValue[ 0 ] ) {
                if( reset ) {
                    properties[ property ].dbValue = [ properties[ property ].originalValue ];
                } else {
                    properties[ property ].originalValue = properties[ property ].dbValue[ 0 ];
                }
                properties[ property ].dirty = false;
                properties[ property ].valueUpdated = false;
                properties[ property ].displayValueUpdated = false;
                eventBus.publish( 'Pca0VariabilityTreeEditService.vmoUpdated', { vmo: vmos[ iDx ], columnField: property } );
            }
        }
    }
    return vmos;
};

/**
 * Remove Split Columns with no authored conditions.
 * @param {Object} businessObjectToSelectionMap - selection Map
 * @param {Array} columns - Tree DataProvider Columns
 */
let _removeEmptySplitColumns = function( businessObjectToSelectionMap, columns ) {
    let selectionMap = businessObjectToSelectionMap;
    let boKeys = Object.keys( selectionMap );
    //  let boKeysToRemove = [];
    _.forEach( boKeys, boKey => {
        if( _.find( columns, { uid: boKey, isSplitColumn: true } ) && Object.keys( selectionMap[ boKey ] ).length === 0 ) {
            delete businessObjectToSelectionMap[ boKey ];
        }
    } );
};

/**
 * Checks whether variant condition authoring grid contains unsaved edits.
 * @param {Object} backupSelectionMap - businessObjectToSelectionMap [ Backup value initialized on Start Edit Mode]
 * @param {Object} activeSelectionMap - businessObjectToSelectionMap current value updated with edits by user in Edit Mode
 * @return {Boolean} true if variant condition authoring grid is dirty, false otherwise.
 */
let _isVCADirty = function( backupSelectionMap, activeSelectionMap ) {
    var isVCAInEdit = appCtxService.getCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE );
    return isVCAInEdit && !_.isEqual( backupSelectionMap, activeSelectionMap );
};

/**
 * Set the Visibility of Edit command in Primary work area
 * @param {Boolean} visible - true to set the edit command in PWA as visible and false otherwise
 */
let _setVisibilityOfEditCommandInPWA = ( visible ) => {
    appCtxService.updatePartialCtx( 'NONE[\'_editing\']', !visible );
};

/**
 * Reset Edit Mode
 * @param {Object} vcaEditState - Atomic data which stores the state of edit for VCA table
 *
 */
let _resetEditMode = ( vcaEditState ) => {
    Pca0VCAUtils.instance.resetContextOfTableOrTree( vcaEditState, false );
};

/*
 *   Export APIs section starts
 */
let exports = {};

/**

 * Initialize context and edit handler with respect to VM DATA
 * @param {Object} declViewModel VM Data to initialize view
 */
let _contextInitialization = function( declViewModel ) {
    // Reset Edit Mode
    _resetEditMode( declViewModel.atomicDataRef.vcaEditState );
    exports.toggleFilterCriteriaSettingsState( declViewModel.data.subPanelContextInfo.isConfigurationReadOnly, false );

    // Reset selection state for FreeForm families: dispatch atomic data changes
    let gridSelectionState = declViewModel.atomicDataRef.gridSelectionState.getAtomicData();
    let newGridSelectionState = { ...gridSelectionState };
    newGridSelectionState.isFreeFormOptionValueSelected = false;
    declViewModel.atomicDataRef.gridSelectionState.setAtomicData( newGridSelectionState );

    // Edit Handler
    m_editHandler = editHandlerFactory.createEditHandler( dataSourceService
        .createNewDataSource( {
            declViewModel: declViewModel
        } ) );

    // Add new method to identify editing context
    m_editHandler.getEditHandlerContext = function() {
        return 'variantConditionContext';
    };

    editHandlerService.setEditHandler( m_editHandler, Pca0Constants.GRID_CONSTANTS.VARIANT_TREE_CONTEXT );
    editHandlerService.setActiveEditHandlerContext( Pca0Constants.GRID_CONSTANTS.VARIANT_TREE_CONTEXT );

    // Save Handler
    m_saveHandler = {
        isDirty: function( datasource ) {
            var vmData = datasource.getDeclViewModel().data;
            let treeMaps = vmData.treeMaps;
            let atomicDataRef = declViewModel.atomicDataRef;
            var variabilityProps = atomicDataRef.variabilityProps.getAtomicData();
            return _isVCADirty( treeMaps.backupOfBusinessObjectToSelectionMap, variabilityProps.soaResponse.businessObjectToSelectionMap );
        },
        saveEdits: function( /*datasource, inputs*/ ) {
            let atomicDataRef = declViewModel.atomicDataRef;
            var atomicData = atomicDataRef.variabilityProps.getAtomicData();

            // Clone current status for atomic data
            var variabilityProps = { ...atomicData };
            var soaResponse = variabilityProps.soaResponse;

            // Remove Split columns with no authored conditions.
            _removeEmptySplitColumns( soaResponse.businessObjectToSelectionMap, declViewModel.dataProviders.treeDataProvider.cols );

            // Dispatch atomic data changes
            atomicDataRef.variabilityProps.setAtomicData( variabilityProps );

            // Trigger Save actions
            _triggerSaveVariantExpressions( soaResponse );

            _setVisibilityOfEditCommandInPWA( true );
        },
        cancelEdits: () => {
            _setVisibilityOfEditCommandInPWA( true );
        }
    };
};

/**
 * Return Perspective information for getVariantExpressionData3 SOA Input
 * @returns {Object} Perspective Object
 */
export let getConfigPerspective = function() {
    let variantConditionContext = appCtxService.getCtx( 'variantConditionContext' );
    var allowConsumerAppsToLoadData = appCtxService.getCtx( 'variantConditionContext.allowConsumerAppsToLoadData' );
    if( allowConsumerAppsToLoadData && variantConditionContext.configPerspectiveFromConsumerApps && variantConditionContext.configPerspectiveFromConsumerApps.length > 0 ) {
        return {
            uid: variantConditionContext.configPerspectiveFromConsumerApps,
            type: 'Cfg0ConfiguratorPerspective'
        };
    }
    return pca0CommonUtils.getConfigPerspective( 'variantConditionContext' );
};

/**
 * Handle Initialization actions
 * Initialize context
 * [consumerApps] Setup listeners for Primary Work Area selection changes
 * @param {Object} subPanelContext - SubPanelContext
 * @param {Object} declViewModel - VM Object
 */
export let handleInitActions = function( subPanelContext, declViewModel ) {
    // Initialize and register Context
    let variantConditionContext = {};
    appCtxService.registerCtx( 'variantConditionContext', variantConditionContext );

    // Handling of events from/to other projects using VCA table
    // MBSE - attrtargetmgmt, using VCA as "Param Variants"
    // MFG - EasyPlan, using VCA as popup
    // Initialize subscriber to event fired from external project
    // (Event handling from viewModel.json does not work in this case)
    // Event handling is firing the event to trigger data provider update
    _vcaTableReloadListener = eventBus.subscribe( 'configuratorVcaTable.reload', function() {
        eventBus.publish( 'Pca0VariantConditionAuthoringGrid.initialized' );
    } );
    eventBus.publish( 'configuratorVcaTable.gridLoaded', subPanelContext );

    const activeEditHandler = editHandlerService.getActiveEditHandler();
    if( _.isNull( activeEditHandler ) || !activeEditHandler._editing ) {
        _contextInitialization( declViewModel );
    } else {
        eventBus.subscribe( 'editHandlerStateChange', function( eventData ) {
            const key = _.get( eventData, 'dataSource.contextKey' );
            if( eventData.state === 'canceling' && key !== 'variantConditionContext' ) {
                _contextInitialization( declViewModel );
            }
        } );
    }
};

/**
 * Initialize display mode: set "current" as default if not already set
 */
export let initializeDisplayMode = function() {
    let configuratorContext = appCtxService.getCtx( 'configuratorContext' );
    if( !configuratorContext ) {
        configuratorContext = {
            vcaVariabilityDisplayModeInGrid: Pca0Constants.GRID_DISPLAY_MODE.CURRENT
        };
        appCtxService.registerCtx( 'configuratorContext', configuratorContext );
    } else {
        if( _.isUndefined( configuratorContext.vcaVariabilityDisplayModeInGrid ) ) {
            configuratorContext.vcaVariabilityDisplayModeInGrid = Pca0Constants.GRID_DISPLAY_MODE.CURRENT;
            appCtxService.updateCtx( 'configuratorContext', configuratorContext );
        }
    }
};

/**
/**
 * Close actions
 * Unregister variantConditionContext, all event listeners and publish events to handle grid unMount
 */
export let doVcaGridUnmount = function() {
    eventBus.unsubscribe( _vcaTableReloadListener );

    // Unregister variantConditionContext on unload of view. This is required to clear the perspective object and other data.
    // Without this, even when the loaded structure is different, the old variability data was shown since perspsctive object was not cleared.
    appCtxService.unRegisterCtx( 'variantConditionContext' );
    eventBus.publish( 'Pca0VariantsGrid.GridUnloaded' ); // For MFG integration
    eventBus.publish( 'configuratorVcaTable.gridUnloaded' ); // For MBSE integration and other generic listeners
};

/**
 * Perform post processing after getVariantExpressionData3 SOA response is returned
 * @param {Object} vmVariabilityProps - VM atomic data
 * @returns {Object} updated view model atomic data to dispatch
 */
export let postProcessGetVariantExpressionData = function( vmVariabilityProps ) {
    // Clone current status for atomic data
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };
    let soaResponse = variabilityProps.soaResponse;

    // In case of empty Variant Conditions, force "Show All Features" as selected display mode
    var emptyVCs = true;
    let elemKeys = Object.keys( soaResponse.selectedExpressions );
    _.forEach( elemKeys, elemKey => {
        let businessObjects = soaResponse.selectedExpressions[ elemKey ];

        // Empty Variant Condition can come either as empty selectedExpressions for that element
        // or as empty configExpressionSections arrary []
        if( businessObjects.length !== 0 &&
            !_.isUndefined( businessObjects[ 0 ].configExpressionSet ) &&
            !_.isUndefined( businessObjects[ 0 ].configExpressionSet[ 0 ].configExpressionSections ) &&
            businessObjects[ 0 ].configExpressionSet[ 0 ].configExpressionSections.length !== 0 ) {
            emptyVCs = false; // Element has variant conditions defined
        }
    } );
    eventBus.publish( 'pca0VariantFormulaEditor.refresh' );

    if( emptyVCs ) {
        variabilityProps.expandAll = true;
        let configuratorContext = appCtxService.getCtx( 'configuratorContext' );
        let updatedConfiguratorContext = { ...configuratorContext };
        updatedConfiguratorContext.vcaVariabilityDisplayModeInGrid = Pca0Constants.GRID_DISPLAY_MODE.FEATURES;
        appCtxService.updateCtx( 'configuratorContext', updatedConfiguratorContext );
    }
    return variabilityProps;
};

/**
 * Handle Edit Mode change
 * @param {Object} treeDataProvider - Tree Data Provider
 * @param {String} editOperation - start/cancel/save
 * @param {Object} vmTreeMaps - View Model data property treeMaps
 * @param {Object} vmVariabilityProps - View Model Atomic Data
 * @param {Object} isConfigurationReadOnly - VM data 'isConfigurationReadOnly'
 * @returns {Object} updated VM data and atomic data
 */
export let handleEditModeChanged = function( treeDataProvider, editOperation, vmTreeMaps, vmVariabilityProps, isConfigurationReadOnly ) {
    // Clone current status for VM data and fields (atomic data)
    var treeMaps = { ...vmTreeMaps };
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };

    // Operations on Maps
    switch ( editOperation ) {
        case Pca0Constants.GRID_EDIT_OPERATION.START:
            // Create backup maps: Create backup copies of selections and column splits
            treeMaps.backupOfBusinessObjectToSelectionMap = { ...variabilityProps.soaResponse.businessObjectToSelectionMap };
            treeMaps.backupOfColumnSplitIDsMap = { ...treeMaps.columnSplitIDsMap };

            // Adjust FilterCriteria component layout
            exports.toggleFilterCriteriaSettingsState( isConfigurationReadOnly, true );
            break;
        case Pca0Constants.GRID_EDIT_OPERATION.CANCEL:
            // Restore VMOs to original DB values
            _setPropertiesToValue( treeDataProvider, true );

            // Maps: revert to backup Maps
            variabilityProps.soaResponse.businessObjectToSelectionMap = { ...treeMaps.backupOfBusinessObjectToSelectionMap };

            // In case of split columns added, reload table and populate columns
            var splitChanges = !_.isEqual( treeMaps.backupOfColumnSplitIDsMap, treeMaps.columnSplitIDsMap );
            if( splitChanges ) {
                eventBus.publish( 'Pca0VariantConditionAuthoringGrid.initialized' );
            }
            // Adjust FilterCriteria component layout
            exports.toggleFilterCriteriaSettingsState( isConfigurationReadOnly, false );

            variabilityProps.dirtyElements = [];
            break;
        case Pca0Constants.GRID_EDIT_OPERATION.SAVE_COMPLETE: {
            // Set VMOs to current DB values
            const vmos = _setPropertiesToValue( treeDataProvider, false );
            if( treeMaps.cachedTreeLoad && treeMaps.cachedTreeLoad.childNodes && vmos ) {
                for( var iDx = 0; iDx < vmos.length; iDx++ ) {
                    let properties = vmos[ iDx ].props;
                    let alternateID = pca0CommonUtils.prepareUniqueId( vmos[ iDx ].parentUID, vmos[ iDx ].nodeUid );
                    let treeNode = _.find( treeMaps.cachedTreeLoad.childNodes, { alternateID: alternateID } );
                    treeNode.props = properties;
                }
            }
            // Adjust FilterCriteria component layout
            exports.toggleFilterCriteriaSettingsState( isConfigurationReadOnly, false );
            variabilityProps.dirtyElements = [];
        }
            break;
    }

    return { treeMaps: treeMaps, variabilityProps: variabilityProps, editOperation: editOperation };
};

/**
 * Start Edit Mode for VCA2 grid
 * @param {Object} vcaEditState - Atomic data of VCA table edit state
 */
export let startEditVCA2Table = function( vcaEditState ) {
    editHandlerService.setActiveEditHandlerContext( Pca0Constants.GRID_CONSTANTS.VARIANT_TREE_CONTEXT );

    // Add to the appCtx about the editing state: alternative of setting m_editHandler.startEdit();
    // This way we are not using native edit mode template for cells
    m_editHandler._editing = true;
    appCtxService.updateCtx( 'editInProgress', true );

    // Set Edit Mode for atomic data vcaEditState to edit in progress
    Pca0VCAUtils.instance.setVcaEditState( vcaEditState, true );

    _setVisibilityOfEditCommandInPWA( false );

    // Set edit state in the app context
    appCtxService.updateCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, true );

    // Reset cache for copied selections
    appCtxService.updatePartialCtx( 'variantConditionContext.copiedSelectionsCache', undefined );
};

/**
 * Return custom save Handler (as per contribution saveHandlers.json)
 * @return {Object} save handler
 */
export let getSaveHandler = function() {
    return m_saveHandler;
};

/**
 * Launch actions to save authored Variant Expressions
 */
export let saveEditVCA2Table = function() {
    m_saveHandler.saveEdits();
};

/**
 * Post processing of setVariantExpression SOA - for successful SOA response
 * @param {Object} vcaEditState - edit state atomic data
 */
export let postProcessSetVariantExpressionData = function( vcaEditState ) {
    // Reset edit state in the app context
    _resetEditMode( vcaEditState );

    // Fire event to trigger tree reload
    eventBus.publish( 'Pca0VariantConditionAuthoringGrid.initialized' );
};

/**
 * Cancel Edit Mode for VCA2 grid
 */
export let cancelEditVCA2Table = function( vcaEditState ) {
    // Reset edit state in the app context
    _resetEditMode( vcaEditState );

    // Notify edit handler to cancel edits
    m_saveHandler.cancelEdits();
};

/**
 * Reset Edit Mode status: update app context, PWA and toggle Filter Criteria to editable status
 * @param {Object} readOnlyProperty - The ViewModel readOnlyProperty
 * @param {Object} vcaEditState - Atomic data of VCA table edit state
 */
export let resetEditModeStatus = ( readOnlyProperty, vcaEditState ) => {
    _resetEditMode( vcaEditState );

    // Notify edit handler to cancel edits
    m_saveHandler.cancelEdits();

    exports.toggleFilterCriteriaSettingsState( readOnlyProperty, false );
};

/**
 * Get PCA grid from selections
 * @param {Object} variabilityProps - VM atomic data
 * @returns {Object} PCA Grid
 */
export let getExpressionData = function( variabilityProps ) {
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( pca0ExpressionGridService.getPCAGridFromSelectionMap( variabilityProps.soaResponse.businessObjectToSelectionMap ) );
};

/**
 * Get PCA grid from selections for Validation
 * Send individual expressions instead of bulk subExpressions in case of split columns
 * @param {Object} validationProps - Validation Properties container
 * @param {Object} businessObjectToSelectionMap - Selection Map
 * @returns {Object} PCA Grid for validation purposes
 */
export let getExpressionDataForValidation = function( validationProps, businessObjectToSelectionMap ) {
    if( !_.isUndefined( validationProps.columnValidation ) ) {
        return configuratorUtils.convertSelectedExpressionJsonObjectToString( pca0ExpressionGridService.getColumnValidationPCAGrid( validationProps.columnValidation.field,
            businessObjectToSelectionMap ) );
    }
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( pca0ExpressionGridService.getValidationPCAGrid( businessObjectToSelectionMap ) );
};

/**
 * Get RequestInfo for Validation according to requested type of Validation (Initial vs Column)
 * @param {Object} validationProps - Validation Properties container
 * @returns {String} RequestInfo with RequestType string for Product Configuration Validation
 */
export let getRequestInfoForValidation = function( validationProps ) {
    if( _.isUndefined( validationProps.columnValidation ) ) {
        return { requestType: [ Pca0Constants.REQ_TYPE_INITIAL_VALIDATION ] };
    }
    return {};
};

/**
 * Handle Display Mode change
 * Update context and trigger grid refresh
 * @param {Object} commandContext - the command context (atomicData: variabilityProps)
 * @param {String} displayMode - selected display mode: "Show Current Expressions"/"Show All Families"/"Show All Features"
 */
export let handleDisplayModeChange = function( commandContext, displayMode ) {
    let configuratorContext = appCtxService.getCtx( 'configuratorContext' );

    // Do nothing if user selects active Display Mode
    if( configuratorContext.vcaVariabilityDisplayModeInGrid === displayMode ) {
        return;
    }

    var variabilityProps = { ...commandContext.variabilityProps.value };

    switch ( displayMode ) {
        case Pca0Constants.GRID_DISPLAY_MODE.CURRENT:
            // Transition to "Show Current Expressions" always requires a SOA call.
            variabilityProps.useCachedData = false;
            delete variabilityProps.expansionMap;
            variabilityProps.expandAll = true; // Expand all nodes, leaf nodes excluded
            break;
        case Pca0Constants.GRID_DISPLAY_MODE.FAMILIES:
            // Transition between Families-Features doesn't require a SOA call. Use cached data.
            variabilityProps.useCachedData = configuratorContext.vcaVariabilityDisplayModeInGrid === Pca0Constants.GRID_DISPLAY_MODE.FEATURES;
            // if Cache data is used, create expansionMap if needed
            if( variabilityProps.useCachedData && _.isUndefined( variabilityProps.expansionMap ) ) {
                variabilityProps.expansionMap = pca0CommonUtils.getShowFamiliesExpansionMap( variabilityProps.soaResponse );
            }
            variabilityProps.expandAll = false; // Expansion map will be used
            break;
        case Pca0Constants.GRID_DISPLAY_MODE.FEATURES:
            // Transition between Families-Features doesn't require a SOA call. Use cached data.
            variabilityProps.useCachedData = configuratorContext.vcaVariabilityDisplayModeInGrid === Pca0Constants.GRID_DISPLAY_MODE.FAMILIES;
            delete variabilityProps.expansionMap;
            variabilityProps.expandAll = true; // Expand all nodes, leaf nodes excluded
            break;
        default:
            return;
    }

    // Reset filter
    delete variabilityProps.activeFilter;
    delete variabilityProps.filterApplied;

    // Update atomic data
    commandContext.variabilityProps.update( variabilityProps );

    // Reset selection status for Free Form Values when changing display mode
    var gridSelectionState = { ...commandContext.gridSelectionState.value };
    gridSelectionState.isFreeFormOptionValueSelected = false;
    commandContext.gridSelectionState.update( gridSelectionState );

    configuratorContext.vcaVariabilityDisplayModeInGrid = displayMode;
    appCtxService.updateCtx( 'configuratorContext', configuratorContext );

    // Fire event to force the "Filter Clear" on splm table
    eventBus.publish( 'pltable.columnFilterApplied', {
        gridId: Pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION,
        columnName: Pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT
    } );
};

/**
 * Add free form option value for FF and enumerated families
 * @param {Object} vmGridSelectionState - View Model Atomic Data (Grid Selection State)
 * @param {Object} vmtreeMaps - View Model data property treeMaps
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} eventData - Event data container
 * @param {UwDataProvider} treeDataProvider - Tree data provider
 */
export let addFreeFormOptionValue = function( vmGridSelectionState, vmtreeMaps, vmVariabilityProps, eventData, treeDataProvider ) {
    var localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );
    var newFreeFormValue = eventData.valueText;
    if( !newFreeFormValue ) {
        return;
    }

    // Get information of selected Free Form family
    let gridSelectionStateFromAtomicData = vmGridSelectionState.getAtomicData();
    let gridSelectionState = { ...gridSelectionStateFromAtomicData };

    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };

    let freeFormMap = vmtreeMaps.freeFormAndEnumeratedValuesMap;
    let familyNode = gridSelectionState.selectionInfo;
    if( _.isUndefined( freeFormMap[ familyNode.nodeUid ] ) ) {
        freeFormMap[ familyNode.nodeUid ] = [];
    }
    // Server is sending free form option values with nodeID as <familyUid>:<valueText>
    // Use same format.
    var nodeUid = familyNode.nodeUid + ':' + newFreeFormValue;
    if( !freeFormMap[ familyNode.nodeUid ].includes( nodeUid ) ) {
        freeFormMap[ familyNode.nodeUid ].push( nodeUid );
    } else {
        let value = newFreeFormValue;
        messagingService.showError( localeTextBundle.showDuplicateFreeFormValueErrorMessage.replace( '{0}', value ) );
        return;
    }
    if( familyNode.isExpanded ) {
        let viewModelCollection = treeDataProvider.getViewModelCollection();
        let vmos = viewModelCollection.getLoadedViewModelObjects();
        let updatedVMOs = [ ...vmos ];
        let familyVMO = _.find( updatedVMOs, { nodeUid: familyNode.nodeUid } );
        let featureNode = Pca0VariabilityTreeDisplayService.createViewModelTreeNode(
            nodeUid, // nodeUid
            familyVMO.levelNdx + 1, // levelNdx
            familyVMO.nodeUid, // parentNodeUid,
            familyVMO.alternateID, // parentNode alternateID,
            _.last( familyVMO.children ).childNdx + 1, // childNdx
            variabilityProps.soaResponse, // soaResponse
            vmtreeMaps.backupOfBusinessObjectToSelectionMap, // backupSelectionMap
            false // isSpecialBackgroundCell
        );

        // Add element to view model collection: add vmo to the end of the features list for that family
        let lastChildFeatureIdx = _.indexOf( updatedVMOs, _.last( familyNode.children ) );
        updatedVMOs.splice( lastChildFeatureIdx + 1, 0, featureNode );

        // Add to familyNode
        familyVMO.children.push( featureNode );

        treeDataProvider.update( updatedVMOs );
    } else {
        eventBus.publish( treeDataProvider.name + '.expandTreeNode', {
            parentNode: familyNode
        } );
    }
};

/**
 * Trigger validation for authored Variant Conditions
 * @param {Object} validationProps - Validation Properties container
 * @param {Object} eventData - data carried by validate trigger event
 * @returns {Object} updated Validation Properties container
 */
export let validateVariantConditions = function( validationProps, eventData ) {
    // Process Initial Validation vs. Column Validation
    delete validationProps.columnValidation;
    if( !_.isUndefined( eventData ) && Object.keys( eventData ).indexOf( 'column' ) > -1 ) {
        // This is single column validation
        validationProps.columnValidation = eventData.column;
    }
    eventBus.publish( 'Pca0VariantConditionAuthoringGrid.ValidateProductConfigurations' );
    return validationProps;
};

/**
 * Post processing of validateProductConfigurations3 SOA - for successful SOA response
 * @param {Object} validationSoaResponse - Validation SOA response
 * @param {Object} vmVariabilityProps - VM atomic data
 * @param {Object} validationProps - Validation Properties container
 * @returns {Object} updated Validation Properties container
 */
export let postProcessValidateProductConfigurations = function( validationSoaResponse, vmVariabilityProps, validationProps ) {
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };

    var localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );

    // Initialize Validation Map if needed
    if( _.isUndefined( validationProps.columnToValidationMap ) ) {
        validationProps.columnToValidationMap = {};
    }

    // Initial vs Column Validation
    let validatedColumn = validationProps.columnValidation;

    var displayValue = '';
    var displayMessage = '';
    var viewModelObject = null;
    var origViewModelObject = null;

    if( !_.isUndefined( validatedColumn ) ) {
        // This is for single column validation (header custom menu)
        var validatedColumnUID = validatedColumn.field;
        viewModelObject = variabilityProps.soaResponse.viewModelObjectMap[ validatedColumnUID ];
        displayValue = viewModelObject && viewModelObject.displayName ? viewModelObject.displayName : validatedColumnUID;

        // if isSplitColumn, use originalColumnName for display purposes
        if( validatedColumn.isSplitColumn ) {
            origViewModelObject = variabilityProps.soaResponse.viewModelObjectMap[ validatedColumn.originalColumnName ];
            displayValue = origViewModelObject && origViewModelObject.displayName ? origViewModelObject.displayName : validatedColumnUID;
        }

        var columnValidationOutput = validationSoaResponse[ validatedColumnUID ];
        if( columnValidationOutput.criteriaStatus ) {
            messagingService.showInfo( localeTextBundle.validationSuccessful.replace( '{0}', displayValue ) );
        } else {
            var valueToViolations = columnValidationOutput.valueToViolations;
            if( !_.isUndefined( valueToViolations ) && valueToViolations.hasOwnProperty( validatedColumnUID ) ) {
                var messages = valueToViolations[ validatedColumnUID ].messages;
                displayMessage = '';
                for( var ix = 0; ix < messages.length; ix++ ) {
                    if( displayMessage !== '' ) {
                        displayMessage += '\n\n';
                    }
                    displayMessage += messages[ ix ];
                }
            }

            // Update validation map for column beign validated only
            // Keep unmodified violation messages for other columns
            validationProps.columnToValidationMap[ validatedColumnUID ] = displayMessage;

            messagingService.showError( localeTextBundle.validationForExpressionFailed.replace( '{0}', displayValue ) );
        }
    } else {
        // Initial validation
        var atleastOneFailed = false;

        // Clean columnValidationMap: reset column validation tooltips
        var columnToValidationMap = {};
        let originalColumnUID;
        for( var columnUID in validationSoaResponse ) {
            var column = validationSoaResponse[ columnUID ];
            if( column.criteriaStatus === false ) {
                originalColumnUID = Pca0VCAUtils.instance.getOriginalColumnKeyFromSplitColumnKey( columnUID );
                viewModelObject = variabilityProps.soaResponse.viewModelObjectMap[ originalColumnUID ];

                displayValue = viewModelObject && viewModelObject.displayName ? viewModelObject.displayName : columnUID;
                displayMessage = localeTextBundle.initialValidationForExpressionFailed.replace( '{0}', displayValue );
                columnToValidationMap[ columnUID ] = displayMessage;

                if( !atleastOneFailed ) {
                    atleastOneFailed = true;
                }
            }
        }

        // Update entire validation Map
        validationProps.columnToValidationMap = columnToValidationMap;

        if( atleastOneFailed ) {
            messagingService.showError( localeTextBundle.multiValidationTooltip );
        } else {
            messagingService.showInfo( localeTextBundle.multiValidationSuccessful );
        }
    }
    return validationProps;
};

/**
 * Toggle Filter Criteria Settings State
 * @param {Object} readOnlyProperty - The ViewModel readOnlyProperty
 * @param {Boolean} isReadOnlyMode     true - if filter criteria state to be disabled
 *                                     false - if filter criteria state to be enabled
 */
export let toggleFilterCriteriaSettingsState = function( readOnlyProperty, isReadOnlyMode ) {
    readOnlyProperty.dbValue = isReadOnlyMode;
    var eventData = {
        isReadOnlyMode: isReadOnlyMode
    };
    eventBus.publish( 'Pca0Settings.toggleFilterCriteriaSettingsState', eventData );
};

/**
 * Reset the filter applied to the variability column
 * @param {Object} vmVariabilityProps - View Model Atomic Data
 * @returns {Object} update atomic data
 */
export let resetColumnFilters = function( vmVariabilityProps ) {
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    let variabilityProps = { ...variabilityPropFromAtomicData };

    let isFilterApplied = variabilityProps.filterApplied;

    // Reset filter
    delete variabilityProps.activeFilter;
    delete variabilityProps.filterApplied;

    if( isFilterApplied ) {
        // Fire event to force the "Filter Clear" on splm table
        eventBus.publish( 'pltable.columnFilterApplied', {
            gridId: Pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION,
            columnName: Pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT
        } );
    }
    return variabilityProps;
};

/**
 * In context of ECN the variant condition needs to be saved on the split element ( and NOT original element)
 * @param {Object} vmVariabilityProps The ViewModel atomic data
 * @param {Object} vmtreeMaps - View Model data property treeMaps
 * @param {Object} eventData EventData containing a map having elementUID as its key and splitElementUID as its value
 * @returns {Object} Updated atomic data having map of newly split business object as key and user selections as its value
 */
export let saveExpressionsInECNContext = function( vmVariabilityProps, vmtreeMaps, eventData ) {
    let variabilityProps = { ...vmVariabilityProps.getAtomicData() };
    let businessObjectToSelectionMap = variabilityProps.soaResponse.businessObjectToSelectionMap;
    Object.keys( eventData ).forEach( originalElementUID => {
        let effectivitySplitElementUID = eventData[ originalElementUID ];
        businessObjectToSelectionMap[ effectivitySplitElementUID ] = businessObjectToSelectionMap[ originalElementUID ];
        delete businessObjectToSelectionMap[ originalElementUID ];

        if( vmtreeMaps.columnSplitIDsMap && Object.keys( vmtreeMaps.columnSplitIDsMap ).includes( originalElementUID ) ) {
            let variabilitySplitElementIDs = _.uniq( vmtreeMaps.columnSplitIDsMap[ originalElementUID ] );
            variabilitySplitElementIDs.forEach( variabilitySplitElementID => {
                businessObjectToSelectionMap[ Pca0VCAUtils.instance.generateSplitColumnKey( effectivitySplitElementUID ) ] = businessObjectToSelectionMap[ variabilitySplitElementID ];
                delete businessObjectToSelectionMap[ variabilitySplitElementID ];
            } );
        }
    } );
    variabilityProps.soaResponse.businessObjectToSelectionMap = businessObjectToSelectionMap;
    return variabilityProps;
};

/**
 * Helps to prepare SOA input to get variants expression using getVariantExpressionData3
 * @returns {Object} required as input for SOA
 */
export let prepareSOAInputToGetVariants = function() {
    return {
        variantExpressionDataInput: {
            configContextProvider: '',
            configContext: '',
            configPerspective: exports.getConfigPerspective(),
            selectedObjects: _getSelectedObjectsForSOA(),
            currentExpandedFamilies: '',
            filters: {
                intentFilters: [],
                optionFilter: _getGridOptionFiltersForVca()
            },
            requestInfo: {
                requestType: []
            }
        }
    };
};

export default exports = {
    getConfigPerspective,
    handleInitActions,
    initializeDisplayMode,
    doVcaGridUnmount,
    postProcessGetVariantExpressionData,
    handleEditModeChanged,
    startEditVCA2Table,
    getSaveHandler,
    saveEditVCA2Table,
    postProcessSetVariantExpressionData,
    cancelEditVCA2Table,
    resetEditModeStatus,
    getExpressionData,
    getExpressionDataForValidation,
    getRequestInfoForValidation,
    handleDisplayModeChange,
    addFreeFormOptionValue,
    validateVariantConditions,
    postProcessValidateProductConfigurations,
    toggleFilterCriteriaSettingsState,
    resetColumnFilters,
    saveExpressionsInECNContext,
    prepareSOAInputToGetVariants
};

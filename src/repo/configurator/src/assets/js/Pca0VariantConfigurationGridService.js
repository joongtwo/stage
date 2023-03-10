// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0VariantConfigurationGridService
 */
import assert from 'assert';
import appCtxSvc from 'js/appCtxService';
import cdmSvc from 'soa/kernel/clientDataModel';
import configuratorUtils from 'js/configuratorUtils';
import eventBus from 'js/eventBus';
import pca0GridAuthoringService from 'js/pca0GridAuthoringService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import pca0ExpressionGridService from 'js/Pca0ExpressionGridService';
import propertyPolicyService from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';
import variabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import _ from 'lodash';


/*
 *   Export APIs section starts
 */

let exports = {};

/**
 * Return Active Variant Rules for variantConfigurationView3 SOA Input
 * @param {Object} variantRuleData - The variantRuleData object
 * @returns {Array} Active Variant Rules
 */
let _getActiveVariantRules = function( variantRuleData ) {
    let modelObjects = [];
    if( variantRuleData && variantRuleData.update ) {
        let newVariantRuleData = { ...variantRuleData.value };

        let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
        if( newVariantRuleData.variantRulesToLoad && newVariantRuleData.variantRulesToLoad.length > 0 ) {
            modelObjects = newVariantRuleData.variantRulesToLoad;
        } else if( fscContext.initialVariantRule ) {
            // Handle scenario where SVR is already applied to product (e.g. SVR just created)
            var modelObject = cdmSvc.getObject( fscContext.initialVariantRule.uid );
            modelObjects = [ modelObject ];
            newVariantRuleData.variantRulesToLoad = [ fscContext.initialVariantRule ];

            variantRuleData.update( newVariantRuleData );
            appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
        }
        if( !( modelObjects instanceof Array ) ) {
            modelObjects = [ modelObjects ];
        }
    }
    return modelObjects;
};

/**
 * Get Selected Expressions using active selection map
 * @param {Object} data - VM Object
 * @return {Object}  selected expressions
 */
let _getActiveSelectedExpressionsInGrid = function( data ) {
    if( data.soaResponse ) {
        return pca0ExpressionGridService.getPCAGridFromSelectionMap( data.soaResponse.businessObjectToSelectionMap );
    }
    return null;
};

/**
 * Return Grid filter option for variantConfigurationView3 SOA Input
 * @return {Object} Grid filter option
 */
let _getGridFilterOptionsForFsc = function() {
    let configuratorContext = appCtxSvc.getCtx( 'configuratorContext' );
    if( configuratorContext.vcvVariabilityDisplayModeInGrid === Pca0Constants.GRID_DISPLAY_MODE.CURRENT ) {
        return 'pca0_show_current';
    }
    return 'pca0_show_all';
};

/**
 * Create family ExpansionMap
 * All group nodes are displayed and expanded.
 * Display all families and expand only those having selections defined.
 * @param {Object} soaResponse - the SOA response
 * @return {Object} Expansion map
 */
let _getShowFamiliesExpansionMap = function( soaResponse ) {
    var expansionMap = [];
    var familyExpansionMap = [];

    _.forEach( soaResponse.businessObjectToSelectionMap, function( svrSelections ) {
        _.forEach( svrSelections, function( selection ) {
            var familyNode = _.find( familyExpansionMap, { id: selection.family } );
            var nodeUID = selection.nodeUid;
            if( !nodeUID && selection.props && selection.props.isFreeFormSelection && selection.props.isFreeFormSelection[ 0 ] ) {
                nodeUID = selection.family + ':' + selection.valueText;
            }
            if( !familyNode ) {
                familyNode = {
                    id: selection.family,
                    childNodes: [ { id: nodeUID } ]
                };
                familyExpansionMap.push( familyNode );
            } else {
                familyNode.childNodes.push( { id: nodeUID } );
            }
        } );
    } );

    // Get Root element
    let variantTreeData = soaResponse[ Pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ];
    let rootElement = variantTreeData.filter( treeNode => treeNode.nodeUid === '' );
    assert( rootElement, 'RootElement is missing in the response' );
    let parentNode = rootElement[ 0 ];

    for( var groupIdx = 0; groupIdx < parentNode.childrenUids.length; groupIdx++ ) {
        // Loop through families in group from variant tree data (from SOA response)
        // fetch family nodes to be expanded from family Map
        var groupUID = parentNode.childrenUids[ groupIdx ];
        var groupNode = {
            id: groupUID,
            childNodes: []
        };

        var group_treeData = _.find( soaResponse.variabilityTreeData, {
            nodeUid: groupUID
        } );
        var groupFamilies_treeData = group_treeData.childrenUids;
        for( var familyIdx = 0; familyIdx < groupFamilies_treeData.length; familyIdx++ ) {
            var familyUID = groupFamilies_treeData[ familyIdx ];
            var family_treeData = _.find( soaResponse.variabilityTreeData, {
                nodeUid: familyUID
            } );

            var familyNode = {
                id: familyUID
            };

            // Look for current selections for the family.
            // in case selections are present, add all child Nodes to the tree (i.e., family node will be expanded)
            var isFamilyInSelections = false;
            _.forEach( soaResponse.businessObjectToSelectionMap, function( svrSelections ) {
                _.forEach( svrSelections, function( selection ) {
                    if( selection.family === familyUID && _.find( familyExpansionMap, { id: selection.family } ) ) {
                        // Family has selections
                        isFamilyInSelections = true;
                        return false; // this works as break in lodash.
                    }
                } );

                if( isFamilyInSelections ) {
                    return false; // this works as break in lodash.
                }
            } );

            if( isFamilyInSelections ) {
                familyNode.childNodes = [];
                _.forEach( family_treeData.childrenUids, id => {
                    familyNode.childNodes.push( { id: id } );
                } );

                // todo free form
            }

            groupNode.childNodes.push( familyNode );
        }
        expansionMap.push( groupNode );
    }

    return expansionMap;
};

/**
 * Enable/Disable Menu for Tree Navigation Column
 * (enable/disable filtering)
 * @param {UwDataProvider} treeDataProvider - data provider
 * @param {Boolean} enableMenu - True/False to enable column menu
 */
let _enableDisableTreeNavigationColumnMenu = function( treeDataProvider, enableMenu ) {
    let columns = treeDataProvider.cols;
    let columnDef = _.filter( columns, { isTreeNavigation: true } )[ 0 ];
    columnDef.enableColumnMenu = enableMenu;
};

/**
 * Restore VMOs to original values from DB
 * @param {Object} treeDataProvider - treeDataProvider Object
 */
let _resetPropertiesToDbValue = function( treeDataProvider ) {
    var loadedObjects = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    for( var iDx = 0; iDx < loadedObjects.length; iDx++ ) {
        var properties = loadedObjects[ iDx ].props;
        for( var property in properties ) {
            let wasDirty = properties[ property ].dirty;
            let wasUpdated = properties[ property ].valueUpdated;
            properties[ property ].dirty = false;
            properties[ property ].valueUpdated = false;
            properties[ property ].displayValueUpdated = false; //all 3 have to be reset otherwise isModified in splmtable updateCellChangedClass will return true
            if( _.isUndefined( properties[ property ].originalValue ) ) {
                properties[ property ].dbValue = [ 0 ];
            } else if( properties[ property ].originalValue !== properties[ property ].dbValue[ 0 ] ) {
                properties[ property ].dbValue = [ properties[ property ].originalValue ];
            }
            if( wasDirty || wasUpdated ) {
                eventBus.publish( 'Pca0VariabilityTreeEditService.vmoUpdated', { vmo: loadedObjects[ iDx ], columnField: property } );
            }
        }
    }
};

/**
 * Switch to Grid view
 * @param {Boolean} reset - option to reset
 */
export let showGridView = function( reset ) {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    // Do not proceed if Grid mode is active already
    if( fscContext.treeDisplayMode ) {
        return;
    }

    let configContext = appCtxSvc.getCtx( 'configuratorContext' );

    if( !configContext ) {
        configContext = {
            vcvVariabilityDisplayModeInGrid: Pca0Constants.GRID_DISPLAY_MODE.CURRENT
        };
        appCtxSvc.registerCtx( 'configuratorContext', configContext );
    }
    if( reset ) {
        fscContext.variantRulePanelDirty = false;
        delete fscContext.payloadStrings;
        delete fscContext.selectedExpressions;
        delete fscContext.violationLabel;
    }

    if( fscContext.variantRulePanelDirty ) {
        // Show confirmation dialog
        eventBus.publish( 'Pca0FullScreenConfiguration.confirmSwitchingToTreeMode', {} );
    } else {
        // No user edits, switch to tree mode
        fscContext.treeDisplayMode = true;
        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
    }
    eventBus.publish( 'Pca0FullScreenConfiguration.updateSVRListInSummary' );
};

/**
 * Switch to List view
 * Option available only for single SVR loaded
 * @param {Object} data - commandcontext passed in from command
 */
export let showListView = function( data ) {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    let newfscState = {};
    if( data.fscState && data.fscState.value ) {
        newfscState = { ...data.fscState.value };
    }

    let newVariantRuleData = {};
    if( data.variantRuleData && data.variantRuleData.value ) {
        newVariantRuleData = { ...data.variantRuleData.value };
    }

    // Do not proceed if List mode is active already
    if( newfscState.treeDisplayMode === false ) {
        return;
    }
    // List view needs to initialized according to selectedExpressions from Grid view
    // populate selectedExpresions in fscContext when grid view is switched to list view
    let soaResponse;
    if( data.variabilityProps && data.variabilityProps.value ) {
        soaResponse = data.variabilityProps.value.soaResponse;
    }
    if( !soaResponse ) {
        return;
    }

    if( _.get( soaResponse, 'businessObjectToSelectionMap' ) ) {
        fscContext.selectedExpressions = pca0ExpressionGridService.getPCAGridFromSelectionMap( soaResponse.businessObjectToSelectionMap );
    }
    // Initialize applied SVR: keep loaded SVR (ignore any selection from OccMgmt context)
    fscContext.currentAppliedVRs = [ newVariantRuleData.variantRulesToLoad[ 0 ].uid ];
    // set treeDisplayMode is false as switching to list view
    newfscState.treeDisplayMode = false;
    fscContext.currentScope = '';
    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );

    // update the state of the parent and avoid having to use global context and events
    if( data.fscState.update ) {
        // isSwitchingFromGridToListView flag is true when configuration view is switched from grid to list view
        newfscState.isSwitchingFromGridToListView = true;
        // When switching from grid to list view and if grid view is dirty, then make variantRuleDirty as true
        newfscState.variantRuleDirty = newfscState.isGridDirty;
        data.fscState.update( newfscState );
    }

    //fullScreenConfigurationService.initFSCConfiguration( data.fscState );
};

/**
 * Handle Display Mode change
 * Update context and trigger grid refresh
 * @param {Object} commandContext - the command context (atomicData: variabilityProps)
 * @param {String} displayMode - selected display mode: "Show Current Expressions"/"Show All Families"/"Show All Features"
 */
export let handleDisplayModeChange = function( commandContext, displayMode ) {
    let configuratorContext = appCtxSvc.getCtx( 'configuratorContext' );

    // Do nothing if user selects active Display Mode
    if( configuratorContext.vcvVariabilityDisplayModeInGrid === displayMode ) {
        return;
    }
    var variabilityProps;
    if( commandContext.variabilityProps && commandContext.variabilityProps.value ) {
        variabilityProps = { ...commandContext.variabilityProps.value };
    }
    if( !variabilityProps ) {
        return;
    }
    switch ( displayMode ) {
        case Pca0Constants.GRID_DISPLAY_MODE.CURRENT:
            // Transition to "Show Current Expressions" always requires a SOA call.
            variabilityProps.useCachedData = false;
            delete variabilityProps.expansionMap;
            variabilityProps.expandAll = true; // Expand all nodes, leaf nodes excluded
            break;
        case Pca0Constants.GRID_DISPLAY_MODE.FAMILIES:
            // Transition between Families-Features doesn't require a SOA call. Use cached data.
            variabilityProps.useCachedData = configuratorContext.vcvVariabilityDisplayModeInGrid === Pca0Constants.GRID_DISPLAY_MODE.FEATURES;
            // if Cache data is used, create expansionMap if needed
            if( variabilityProps.useCachedData && _.isUndefined( variabilityProps.expansionMap ) ) {
                variabilityProps.expansionMap = _getShowFamiliesExpansionMap( variabilityProps.soaResponse );
            }
            variabilityProps.expandAll = false; // Expansion map will be used
            break;
        case Pca0Constants.GRID_DISPLAY_MODE.FEATURES:
            // Transition between Families-Features doesn't require a SOA call. Use cached data.
            variabilityProps.useCachedData = configuratorContext.vcvVariabilityDisplayModeInGrid === Pca0Constants.GRID_DISPLAY_MODE.FAMILIES;
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
    if( commandContext.variabilityProps.update ) {
        commandContext.variabilityProps.update( variabilityProps );
    }

    configuratorContext.vcvVariabilityDisplayModeInGrid = displayMode;
    appCtxSvc.updateCtx( 'configuratorContext', configuratorContext );

    // Fire event to force the "Filter Clear" on splm table
    eventBus.publish( 'pltable.columnFilterApplied', { gridId: 'variantConfigurationGrid', columnName: Pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT } );
};

export let getProfileSettingsForFsc = function() {
    return configuratorUtils.getProfileSettingsForFsc();
};

/**
 * Perform post processing after variantConfigurationView3 SOA response is returned
 * @param {Object} vmVariabilityProps - VM atomic data
 * @param {Object} variantRuleData - variantRuleData atomic data
 * @returns {Object} updated view model atomic data to dispatch
 */
export let postProcessLoadVariantRulesData = function( vmVariabilityProps, variantRuleData ) {
    // Clone current status for atomic data
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = _.cloneDeep( variabilityPropFromAtomicData );
    let soaResponse = variabilityProps.soaResponse;

    // In case of empty Variant Rule, force "Show All Features" as selected display mode
    var emptyVRs = true;
    let selectedExpressions = soaResponse.selectedExpressions;
    let elemKeys = Object.keys( selectedExpressions );
    _.forEach( elemKeys, elemKey => {
        let businessObjects = selectedExpressions[ elemKey ];

        // Empty SVR can come either as empty selectedExpressions for that element
        // or as empty configExpressionSections arrary []
        if( businessObjects.length !== 0 &&
            !_.isUndefined( businessObjects[ 0 ].configExpressionSet ) &&
            !_.isUndefined( businessObjects[ 0 ].configExpressionSet[ 0 ].configExpressionSections ) &&
            businessObjects[ 0 ].configExpressionSet[ 0 ].configExpressionSections.length !== 0 ) {
            emptyVRs = false; // Element has selections
        }
    } );

    if( emptyVRs ) {
        variabilityProps.expandAll = true;
        let configuratorContext = appCtxSvc.getCtx( 'configuratorContext' );
        let updatedConfiguratorContext = { ...configuratorContext };
        updatedConfiguratorContext.vcvVariabilityDisplayModeInGrid = Pca0Constants.GRID_DISPLAY_MODE.FEATURES;
        appCtxSvc.updateCtx( 'configuratorContext', updatedConfiguratorContext );
    }
    return variabilityProps;
};


/**
 * Initialize display mode: set current as default if not already set
 */
export let initializeDisplayMode = function() {
    let configuratorContext = appCtxSvc.getCtx( 'configuratorContext' );
    if( !configuratorContext ) {
        configuratorContext = {
            vcvVariabilityDisplayModeInGrid: Pca0Constants.GRID_DISPLAY_MODE.CURRENT
        };
        appCtxSvc.registerCtx( 'configuratorContext', configuratorContext );
    } else {
        if( _.isUndefined( configuratorContext.vcvVariabilityDisplayModeInGrid ) ) {
            configuratorContext.vcvVariabilityDisplayModeInGrid = Pca0Constants.GRID_DISPLAY_MODE.CURRENT;
            appCtxSvc.updateCtx( 'configuratorContext', configuratorContext );
        }
    }
};

/**
 * Update Variability Data (after unload)- filtering active variant rules
 * Update cached SOA response information with currently loaded SVRs
 * @param {Object} viewModel - The ViewModel object
 * @returns {Object} updated atomic data and columns configuration
 */
export let updateCachedVariabilityData = function( viewModel ) {
    let variabilityPropFromAtomicData = viewModel.atomicDataRef.variabilityProps.getAtomicData();
    let treeMaps = viewModel.data.treeMaps;
    var variabilityProps = _.cloneDeep( variabilityPropFromAtomicData );

    let soaResponse = variabilityProps.soaResponse;
    let treeDataProvider = viewModel.dataProviders.treeDataProvider;

    var srvUnloadedEventKey = 'Pca0VariantConfigurationGrid.svrUnloaded';
    if( viewModel.eventMap && Object.keys( viewModel.eventMap ).indexOf( srvUnloadedEventKey ) !== -1 && viewModel.eventMap[ srvUnloadedEventKey ] ) {
        var svrUnloadedID = viewModel.eventMap[ srvUnloadedEventKey ].variantRuleUID;

        // Clean cached selectedExpressions
        // (split expressions are multiple subExpressions: removing ID is enough to clear)
        delete soaResponse.selectedExpressions[ svrUnloadedID ];

        // Clean businessObjectToSelectionMap and backup
        // Clean also split columns: svrUnloadedID is the "originalColumnName"
        delete soaResponse.businessObjectToSelectionMap[ svrUnloadedID ];
        let boKeys = Object.keys( soaResponse.businessObjectToSelectionMap );
        let boKeysToRemove = _.filter( boKeys, key => _.startsWith( key, svrUnloadedID + Pca0Constants.SPLIT_COLUMN_DELIMITER ) );
        _.forEach( boKeysToRemove, key => delete soaResponse.businessObjectToSelectionMap[ key ] );

        delete treeMaps.backupOfBusinessObjectToSelectionMap[ svrUnloadedID ];
        let backupBoKeys = Object.keys( treeMaps.backupOfBusinessObjectToSelectionMap );
        let backupBoKeysToRemove = _.filter( backupBoKeys, key => _.startsWith( key, svrUnloadedID + Pca0Constants.SPLIT_COLUMN_DELIMITER ) );
        _.forEach( backupBoKeysToRemove, key => delete treeMaps.backupOfBusinessObjectToSelectionMap[ key ] );

        // Update columns array: remove unloaded SVR (and splits)
        let originalColumnInfos = [ ...treeDataProvider.columnConfig.columns ];
        _.remove( originalColumnInfos, { originalColumnName: svrUnloadedID } );
        treeDataProvider.columnConfig = {
            columns: originalColumnInfos
        };

        // Check if configuration contains split expressions and update context
        let containsSplitExpressions = pca0ExpressionGridService.selectedExpressionsContainSplitExpressions( soaResponse.selectedExpressions );
        appCtxSvc.updatePartialCtx( 'fscContext.containsSplitExpressions', containsSplitExpressions );

        // Trigger Tree Data refresh: force to use cached data (no SOA call is needed)
        variabilityProps.useCachedData = true;
    }

    let columnConfig = { columns: treeDataProvider.columnConfig.columns };

    treeMaps.cachedSoaResponse = soaResponse;

    // Clean up split ID map
    delete treeMaps.columnSplitIDsMap[ svrUnloadedID ];

    return {
        variabilityProps: variabilityProps,
        columnConfig: columnConfig,
        treeMaps: treeMaps
    };
};

/**
 * Load Variant Rules information from Server through variantConfigurationView3 SOA
 * Post process SOA response and restore column order
 * @param {Object} data - VM Object
 * @param {Object} fscState - fscState atomic data Object
 * @param {Object} variantRuleData - variantRuleData atomic data
 * @returns {Promise} promise
 */
export let loadVariantRulesData = function( data, fscState, variantRuleData ) {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    var soaInput = {
        input: {
            configPerspective: exports.getConfigPerspective( variantRuleData ),
            activeVariantRules: _getActiveVariantRules( variantRuleData ),
            selectedContext: configuratorUtils.getSelectionForVariantContext( Pca0Constants.FSC_CONTEXT ),
            scopes: _.isUndefined( fscContext.currentScope ) ? [ '' ] : [ fscContext.currentScope ],
            payloadStrings: fscContext.payloadStrings,
            // _getActiveSelectedExpressionsInGrid( data ) it always returns empty we have story for REACT observation for it LCS-660427
            // currently not required as it's taken care by server side.
            // due to performance issue we are setting this to empty
            // instead of calling from js file we need to make this call from VM json and need to test issue of loading variant rule two times
            selectedExpressions: configuratorUtils.convertSelectedExpressionJsonObjectToString( {} ),
            requestInfo: {
                requestType: [ 'getConfig' ],
                configurationControlMode: [ 'manual' ],
                switchingToGuidedMode: [ '' ],
                viewType: [ 'Tree' ],
                reassessSelections: _.isUndefined( fscContext.reassessSelections ) ? [ '' ] : [ fscContext.reassessSelections.toString() ],
                profileSettings: [ getProfileSettingsForFsc() ],
                filterMode: [ _getGridFilterOptionsForFsc() ]
            }
        }
    };

    // Register Policy to get Config Perspective
    // Set the policy before SOA call
    var policyId = propertyPolicyService.register( pca0CommonConstants.CFG0CONFIGURATORPERSPECTIVE_POLICY );

    return soaService.postUnchecked( 'Internal-ProductConfiguratorAw-2022-12-ConfiguratorManagement',
        'variantConfigurationView3', soaInput ).then( soaResponse => {
        if( policyId ) {
            propertyPolicyService.unregister( policyId );
        }

        // Handle partial errors
        if( soaResponse.partialErrors || soaResponse.ServiceData && soaResponse.ServiceData.partialErrors ) {
            pca0CommonUtils.processPartialErrors( soaResponse.ServiceData );
            return;
        }

        // Process SOA response and restore input column order
        var clonedExpressions = _.cloneDeep( configuratorUtils.convertSelectedExpressionJsonStringToObject( soaResponse.selectedExpressions ) );
        soaResponse.selectedExpressions = {};
        if( clonedExpressions ) {
            _.forEach( soaInput.input.activeVariantRules, ( svr ) => {
                soaResponse.selectedExpressions[ svr.uid ] = clonedExpressions[ svr.uid ];
            } );
        }

        // Check if configuration contains split expressions and update context
        let containsSplitExpressions = pca0ExpressionGridService.selectedExpressionsContainSplitExpressions( soaResponse.selectedExpressions );
        appCtxSvc.updatePartialCtx( 'fscContext.containsSplitExpressions', containsSplitExpressions );
        const treeDataProvider = data.dataProviders.treeDataProvider;
        const variabilityPropertiesToDisplay = data.variabilityPropertiesToDisplay;
        const vmGridSelectionState = data.atomicDataRef.gridSelectionState;
        // Pass value for Grid Selection State: this will be used for click handler
        let treeResult = exports.loadDataInTree( soaResponse, treeDataProvider, variabilityPropertiesToDisplay, vmGridSelectionState, 'variantConfigurationGrid', fscState );

        // Create backup maps: create backup copies of selections
        treeResult.treeMaps.backupOfBusinessObjectToSelectionMap = _.cloneDeep( treeResult.variabilityProps.soaResponse.businessObjectToSelectionMap );

        return {
            containsConfigData: true,
            columnConfig: treeResult.columnConfig,
            treeMaps: treeResult.treeMaps,
            variabilityProps: treeResult.variabilityProps
        };
    } );
};

/**
 * Process SOA response, build columns, selectionMap and initialize VM data
 * @param {Object} response - The SOA response
 * @param {UwDataProvider} treeDataProvider - The tree DataProvider
 * @param {Array} variabilityPropertiesToDisplay - Array of additional variability properties to display as columns
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 * @param {string} contextKey - key with respective to grid
 * @param {Object} fscState - fscState
 * @returns {Object} Collection of information on data and fields (atomic data) that need to be used to build Tree Load Result
 */
export let loadDataInTree = function( response, treeDataProvider, variabilityPropertiesToDisplay, vmGridSelectionState, gridID, fscState ) {
    // Cached SOA response: used when resetting filters
    var cachedSoaResponse = { ...response };
    var soaResponse = { ...response };

    // Populate businessObjectToSelectionMap and get Column Properties
    let { columnProperties, columnSplitIDsMap, businessObjectToSelectionMap } =
    variabilityTreeDisplayService.getColumnPropsAndSelectionMap(
        gridID,
        soaResponse );
    soaResponse.businessObjectToSelectionMap = businessObjectToSelectionMap;

    // Build columns
    let variabilityColumnProps = {
        displayTreeNavigationText: true,
        enableColumnMenu: true,
        variabilityPropertiesToDisplay: soaResponse.variabilityPropertiesToDisplay ? soaResponse.variabilityPropertiesToDisplay : []
    };

    // Enable column menues
    let tableColumnProps = _.cloneDeep( columnProperties );
    _.forEach( tableColumnProps, columnProps => {
        columnProps.enableColumnMenu = true;
    } );
    // Update SOA response
    soaResponse.variabilityPropertiesToDisplay = variabilityPropertiesToDisplay;
    //var gridID = Object.keys( data.grids )[ 0 ];

    // Load columns and populate businessObjectToSelectionMap
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    fscContext.autoEditMode = true;
    let loadColumnsResult = variabilityTreeDisplayService.loadColumns(
        tableColumnProps,
        variabilityColumnProps,
        Pca0Constants.FSC_CONTEXT,
        treeDataProvider,
        vmGridSelectionState );
    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
    // Initialize properties to be dispatched as VM updates (data and fields)
    // Such data will be used for loading TreeLoadResult
    var expansionMap;
    var expandAll;
    //var columnSplitIDsMap = {};

    // Update selectionMap on soaResponse
    //soaResponse.businessObjectToSelectionMap = loadColumnsResult.businessObjectToSelectionMap;

    //columnSplitIDsMap = loadColumnsResult.columnSplitIDsMap;

    // Populate tree load result
    // Analyze tree structure based on current Display Mode and populate expansion map
    let configuratorContext = appCtxSvc.getCtx( 'configuratorContext' );
    switch ( configuratorContext.vcvVariabilityDisplayModeInGrid ) {
        // For "Show Current Expressions" and "Show All Features", all nodes are displayed, and tree is expanded
        case Pca0Constants.GRID_DISPLAY_MODE.CURRENT:
        case Pca0Constants.GRID_DISPLAY_MODE.FEATURES:
        default:
            expansionMap = undefined;
            expandAll = true; // Expand all nodes, leaf nodes excluded
            break;

            // Expand groups and families having selection expressions
        case Pca0Constants.GRID_DISPLAY_MODE.FAMILIES:
            // Generate Expansion Map in case tree expansion has to be customized
            expandAll = false;
            expansionMap = _getShowFamiliesExpansionMap( soaResponse );
            break;
    }

    // Reset isDirty flag: soaResponse will be enforced and overwrite any unsaved edits
    //let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    if( fscState && fscState.update ) {
        let newState = { ...fscState.value };
        newState.isGridDirty = false;
        fscState.update( newState );
    }
    // Force cell editing
    // Normally, if Edit Mode is not active, cell click event is not propagated
    // In VCV grid, Edit Mode is automatically set when user clicks on a cell


    // Disable Edit Mode on initialization
    appCtxSvc.updateCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false );

    // Build Collection of information on data and fields (atomic data) that need to be used to build Tree Load Result
    return {
        columnConfig: {
            columns: loadColumnsResult.columnInfos
        },
        treeMaps: {
            // Create backup copy for original selections from SOA response
            backupOfBusinessObjectToSelectionMap: _.cloneDeep( soaResponse.businessObjectToSelectionMap ),
            cachedSoaResponse: cachedSoaResponse,
            columnSplitIDsMap: columnSplitIDsMap
        },
        variabilityProps: {
            soaResponse: soaResponse, // it includes businessObjectToSelectionMap
            expandAll: expandAll,
            expansionMap: expansionMap
        }
    };
};

export let applyConfiguration2 = function() {
    //Close the package panel first
    eventBus.publish( 'Pca0FSCPackage.closePanel', {} );
    eventBus.publish( 'Pca0VariantConfigurationGrid.applyConfiguration2', {
        conditionFlag: 'false'
    } );
};

/**
 * Post process user edits after selection map has changed
 * This action takes place upon every single user edit
 * EventData is not cached as a single user edit might translate to multiple VMOs changed (e.g. click on family node)
 * Validate isDirty condition on the grid and update context and menu functionalities
 * Update VMO <style> for edited cell
 * @param {UwDataProvider} treeDataProvider - data provider
 * @param {Object} vmTreeMaps - View Model data property treeMaps
 * @param {Object} vmVariabilityProps - The ViewModel atomic data
 */
export let postProcessUserEdits = function( treeDataProvider, vmTreeMaps, vmVariabilityProps, fscState ) {
    var treeMaps = { ...vmTreeMaps };
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = _.cloneDeep( variabilityPropFromAtomicData );

    let businessObjectToSelectionMap = variabilityProps.soaResponse.businessObjectToSelectionMap;
    let backupOfBusinessObjectToSelectionMap = treeMaps.backupOfBusinessObjectToSelectionMap;

    let isGridDirty = !_.isEqual( businessObjectToSelectionMap, backupOfBusinessObjectToSelectionMap );
    if( fscState && fscState.update ) {
        let newState = { ...fscState.value };
        newState.isGridDirty = isGridDirty;
        fscState.update( newState );
    }

    // Adjust Edit mode and TreeNavigation column functionalities
    // This will enable some functionalities to be activated if no edits are uncommitted (e.g. change of display mode, tree navigation menus)
    _enableDisableTreeNavigationColumnMenu( treeDataProvider, !isGridDirty );
    appCtxSvc.updateCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, isGridDirty );
};

/**
 * Reset edits: restore selection map from backup
 * Undo all changes and reset edit mode
 * @param {UwDataProvider} treeDataProvider - data provider
 * @param {Object} vmTreeMaps - View Model data property treeMaps
 * @param {Object} vmVariabilityProps - The ViewModel atomic data
 * @param {Object} fscState - The fscState atomic data
 * @returns {Object} updated VM atomic data
 */
export let resetEdits = function( treeDataProvider, vmTreeMaps, vmVariabilityProps, fscState ) {
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var treeMaps = { ...vmTreeMaps };
    var variabilityProps = _.cloneDeep( variabilityPropFromAtomicData );
    // Reset TreeNavigation column functionalities and restore VMOs to original DB values
    _enableDisableTreeNavigationColumnMenu( treeDataProvider, true );
    _resetPropertiesToDbValue( treeDataProvider );

    // Revert changes to selectionMap
    variabilityProps.soaResponse.businessObjectToSelectionMap = _.cloneDeep( treeMaps.backupOfBusinessObjectToSelectionMap );
    //update dirty flag
    if( fscState && fscState.update ) {
        let newState = { ...fscState.value };
        newState.isGridDirty = false;
        fscState.update( newState );
    }
    appCtxSvc.updateCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false );
    return variabilityProps;
};

/**
 * Depending on the use case returns default or the current perspective
 * @param {Object} variantRuleData - variantRuleData
 * @return {Object} configPerspective - fsc config  perspective
 */
export let getConfigPerspective = function( variantRuleData ) {
    return configuratorUtils.getFscConfigPerspective( variantRuleData );
};


export default exports = {
    showListView,
    handleDisplayModeChange,
    getProfileSettingsForFsc,
    postProcessLoadVariantRulesData,
    initializeDisplayMode,
    updateCachedVariabilityData,
    loadVariantRulesData,
    loadDataInTree,
    applyConfiguration2,
    postProcessUserEdits,
    resetEdits,
    getConfigPerspective
};

// Copyright (c) 2022 Siemens

/**
 *
 * This file helps as generic grid service.
 */

/**
 * @module js/pca0GridAuthoringService
 */
import appCtxService from 'js/appCtxService';
import assert from 'assert';
import pca0VariantConditionAuthoringGridService from 'js/Pca0VariantConditionAuthoringGridService';
import configuratorUtils from 'js/configuratorUtils';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import eventBus from 'js/eventBus';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import pca0VariabilityTreeEditService from 'js/Pca0VariabilityTreeEditService';
import propertyPolicyService from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';

import _ from 'lodash';

let isExpansionIsRequired = function() {
    let expand = true;
    // Populate tree load result
    // Analyze tree structure based on current Display Mode and populate expansion map
    let configuratorContext = appCtxService.getCtx( 'configuratorContext' );
    if( configuratorContext && configuratorContext.vcaVariabilityDisplayModeInGrid &&
        configuratorContext.vcaVariabilityDisplayModeInGrid === Pca0Constants.GRID_DISPLAY_MODE.FAMILIES ) {
        expand = false;
    }
    return expand;
};

/**
 * Util to create properties info container for the Constraint column
 * @param {Object} column Column
 * @param {Object} variabilityData - View Model Atomic Data <variabilityProps>
 */
let _createColumnProps = ( column, variabilityData ) => {
    // Build locale Text bundle for 'Properties Information'
    let localePropInfoMap = exports.getPropInfoFromSOAResponse( variabilityData.soaResponse );

    if( !_.isUndefined( column.newConstraintColumnProps ) &&
        Object.keys( column.newConstraintColumnProps ).length !== 0 ) {
        // Use props as coming from 'createRelateAndSubmitObjects' soa response.ServiceData
        // These props have been already processed
        column.props = { ...column.newConstraintColumnProps };
    } else {
        // AW Server is sending props with localized value, e.g.: {object_type:['Localized Constraint Type']}
        // Re-arrange structure to accommodate localized Property Display Name, e.g.:
        // {object_type: {propDisplayName: 'Type', propDisplayValue: 'Localized Constraint Type', sourceType:'Cfg0DefaultRule'}}
        let columnProps = {};
        let awServerColumnProps = _.get( variabilityData, 'soaResponse.viewModelObjectMap.' + column.name + '.props' );
        if ( awServerColumnProps ) {
            Object.entries( awServerColumnProps ).forEach( ( [ internalPropKey, propValue ] ) => {
                columnProps[ internalPropKey ] = {
                    propDisplayName: localePropInfoMap[ internalPropKey ],
                    propDisplayValue: propValue[ 0 ]
                };

            // For Constraint Type, get internal Type
            if( internalPropKey === veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID ) {
                columnProps[ internalPropKey ].sourceType = _.get( variabilityData, 'soaResponse.viewModelObjectMap.' + column.name ).sourceType;
            }
            } );
        }
        column.props = columnProps;
    }
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Process SOA response, build columns, selectionMap and initialize VM data
 * @param {Object} response - The SOA response
 * @param {UwDataProvider} treeDataProvider - The tree DataProvider
 * @param {Array} variabilityPropertiesToDisplay - Array of additional variability properties to display as columns
 * @param {Object} variabilityProps - VM variabilityProps atomic data
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 * @param {string} gridID - Name of tree grid id
 * @param {string} contextKey - key with respective to grid
 * @returns {Object} Collection of information on data and fields (atomic data) that need to be used to build Tree Load Result
 */
export let loadDataInTree = function( response, treeDataProvider, variabilityPropertiesToDisplay, variabilityProps, vmGridSelectionState, gridID, contextKey ) {
    // <TODO> This can serve also for VCV grid

    // Cached SOA response: used when resetting filters
    var cachedSoaResponse = { ...response };
    var soaResponse = { ...response };

    // Update SOA response
    soaResponse.variabilityPropertiesToDisplay = variabilityPropertiesToDisplay;

    // Initialize properties to be dispatched as VM updates (data and fields)
    // Such data will be used for loading TreeLoadResult
    var expansionMap = undefined;
    var expandAll = true;

    var freeFormAndEnumeratedValuesMap = {};

    configuratorUtils.initializeFilterCriteriaForContext( soaResponse.ServiceData.modelObjects[ soaResponse.configPerspective.uid ], contextKey );

    // Populate businessObjectToSelectionMap and get Column Properties
    let { columnProperties, columnSplitIDsMap, businessObjectToSelectionMap } =
    pca0VariabilityTreeDisplayService.getColumnPropsAndSelectionMap(
        gridID,
        soaResponse );
    soaResponse.businessObjectToSelectionMap = businessObjectToSelectionMap;

    // Build columns
    let variabilityColumnProps = {
        displayTreeNavigationText: true,
        enableColumnMenu: true,
        variabilityPropertiesToDisplay: soaResponse.variabilityPropertiesToDisplay
    };

    // Enable column menues
    let tableColumnProps = _.cloneDeep( columnProperties );
    _.forEach( tableColumnProps, columnProps => {
        columnProps.enableColumnMenu = true;
    } );

    let loadColumnsResult = pca0VariabilityTreeDisplayService.loadColumns(
        tableColumnProps,
        variabilityColumnProps,
        contextKey,
        treeDataProvider,
        vmGridSelectionState );

    expandAll = isExpansionIsRequired();
    if( !expandAll ) {
        expansionMap = pca0CommonUtils.getShowFamiliesExpansionMap( soaResponse );
    }

    // Look for root Node and get list of families
    // Look for isFreeForm and for cfg0ValueDataType properties for each family
    // Save a map with free form values
    var rootNode = _.find( pca0CommonUtils.getVariabilityNodes( soaResponse ), { nodeUid: '' } );
    assert( rootNode, 'RootElement is missing in the response' );
    var optionFamilies = rootNode.childrenUids;
    if( !_.isUndefined( optionFamilies ) ) {
        for( var kx = 0; kx < optionFamilies.length; kx++ ) {
            var familyUID = optionFamilies[ kx ];
            var familyNode = _.find( soaResponse.variabilityTreeData.variabiltyNodes ?
                soaResponse.variabilityTreeData.variabiltyNodes : soaResponse.variabilityTreeData, { nodeUid: familyUID } );
            assert( familyNode, 'Family node is missing in the response' );
            var familyObject = soaResponse.viewModelObjectMap[ familyUID ];
            assert( familyObject, 'Family object is missing in the response' );

            if( familyObject.props && familyObject.props.isFreeForm && familyObject.props.isFreeForm[ 0 ] === 'true' ||
                pca0VariabilityTreeEditService.isEnumeratedFamily( familyObject ) ) {
                freeFormAndEnumeratedValuesMap[ familyUID ] = familyNode.childrenUids;
            }
        }
    }

    // Reset selection state for FreeForm families: dispatch atomic data changes
    let newGridSelectionState = { ...vmGridSelectionState.getAtomicData() };
    newGridSelectionState.isFreeFormOptionValueSelected = false;
    vmGridSelectionState.setAtomicData( newGridSelectionState );

    // Build Collection of information on data and fields (atomic data) that need to be used to build Tree Load Result
    return {
        columnConfig: {
            columns: loadColumnsResult.columnInfos
        },
        treeMaps: {
            cachedSoaResponse: cachedSoaResponse,
            columnSplitIDsMap: columnSplitIDsMap,
            freeFormAndEnumeratedValuesMap: freeFormAndEnumeratedValuesMap
        },
        variabilityProps: {
            ...variabilityProps,
            soaResponse: soaResponse, // it includes businessObjectToSelectionMap
            expandAll: expandAll,
            expansionMap: expansionMap
        }
    };
};

/**
 * Load VariabilityData through getVariantExpressionData3 SOA
 * Post process SOA response and restore column order
 * @param {Object} nodeBeingExpanded - The Node being expanded
 * @param {UwDataProvider} treeDataProvider - Data Provider
 * @param {Array} variabilityPropertiesToDisplay - Array of additional variability properties to display
 * @param {Object} variabilityProps - VM variabilityProps atomic data
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data container
 * @param {string} gridId - Identifier of grid
 * @param {string} contextKey - Context key specific to grid
 * @returns {Object} TreeLoadResult, columnConfig and data/atomic data to be dispatched
 */
export let loadDataFromServer = function( nodeBeingExpanded, treeDataProvider, variabilityPropertiesToDisplay, variabilityProps, vmGridSelectionState, gridId, contextKey ) {
    // <TODO> move back to Pca0VariantConditionAuthoringGridService
    // This cannot be used for Constraints Grid Editor with 2 tables

    // Prepare SOA Input
    var input = pca0VariantConditionAuthoringGridService.prepareSOAInputToGetVariants();

    // Register Policy to get Config Perspective
    // Set the policy before SOA call
    var policyId = propertyPolicyService.register( pca0CommonConstants.CFG0CONFIGURATORPERSPECTIVE_POLICY );

    return soaService.postUnchecked( 'Internal-ProductConfiguratorAw-2022-12-ConfiguratorManagement',
        'getVariantExpressionData3', input ).then( soaResponse => {
        if( policyId ) {
            propertyPolicyService.unregister( policyId );
        }

        // Handle partial errors
        if( soaResponse.partialErrors || soaResponse.ServiceData && soaResponse.ServiceData.partialErrors ) {
            pca0CommonUtils.processPartialErrors( soaResponse.ServiceData );
            return {};
        }

        // Process SOA response and restore input column order
        let selectedExpressions = configuratorUtils.convertSelectedExpressionJsonStringToObject( soaResponse.selectedExpressions );
        var clonedExpressions = { ...selectedExpressions };
        soaResponse.selectedExpressions = {};
        _.forEach( input.variantExpressionDataInput.selectedObjects, ( selectedObject ) => {
            soaResponse.selectedExpressions[ selectedObject.uid ] = clonedExpressions[ selectedObject.uid ];
        } );

        // Enforce disabling Edit Mode when Variability Data is reloaded from server
        appCtxService.updateCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false );

        // Pass value for Grid Selection State: this will be used for click handler
        let treeResult = exports.loadDataInTree( soaResponse, treeDataProvider, variabilityPropertiesToDisplay, variabilityProps, vmGridSelectionState, gridId, contextKey );

        if( appCtxService.getCtx( 'variantConditionContext.allowConsumerAppsToLoadData' ) ) {
            eventBus.publish( 'Pca0VariantCondition.consumerAppsPostLoadAction', soaResponse.configPerspective.uid );
        }

        return {
            containsConfigData: true,
            columnConfig: treeResult.columnConfig,
            treeLoadParentNode: nodeBeingExpanded,
            treeMaps: treeResult.treeMaps,
            variabilityProps: treeResult.variabilityProps
        };
    } );
};

/**
 * Helps to prepare column config and grid data.
 * Populate data providers with subsets processed out of the soaResponse
 * @param {Object} variability - nodeBeingExpanded for the Tree Table
 * @param {UwDataProvider} gridDataProvider - DataProvider to be initialized/loaded
 * @param {Object} subsetUIDs - View Model Atomic Data <variabilityProps>
 * @param {Object} vmGridSelectionState - To identify and pass to get new column if required
 * @param {Object} treeLoadInput - Properiteis for respective grid
 * @param {Object} gridData - specific to grid details
 * @param {Boolean} hideTreeNavigationText - true if text in Variability Content cell must be hidden (optional, by default text is shown)
 * @returns {Object} TreeLoadResult for the Tree Table
 */
export let prepareColConfigAndTreeData = ( variability, gridDataProvider, subsetUIDs, vmGridSelectionState, treeLoadInput, gridData, hideTreeNavigationText ) => {
    let variabilityColumnProps = {
        displayTreeNavigationText: !hideTreeNavigationText,
        enableColumnMenu: false,
        variabilityPropertiesToDisplay: variability.soaResponse.variabilityPropertiesToDisplay
    };
    const loadColumnsResult = pca0VariabilityTreeDisplayService.loadColumns( variability.columnProperties, variabilityColumnProps, veConstants.CONFIG_CONTEXT_KEY, gridDataProvider,
        vmGridSelectionState );
    const treeResult = pca0VariabilityTreeDisplayService.getTreeLoadResult( treeLoadInput, undefined, variability, gridDataProvider, undefined, subsetUIDs, gridData );
    const columnConfig = {
        columns: loadColumnsResult.columnInfos
    };
    return { treeResult, columnConfig };
};

/**
 * Populate data providers with subsets processed out of the soaResponse
 * Build column props adding uiValue as from server
 * @param {Object} treeLoadInput - nodeBeingExpanded for the Tree Table
 * @param {UwDataProvider} gridDataProvider - DataProvider to be initialized/loaded
 * @param {Object} variabilityData - View Model Atomic Data <variabilityProps>
 * @param {Object} gridProps - Properties for respective grid
 * @param {Object} vmGridSelectionState - To identify and pass to get new column if required
 * @returns {Object} TreeLoadResult for the Tree Table
 */
export let loadGridDataProvider = ( treeLoadInput, gridDataProvider, variabilityData, gridProps, vmGridSelectionState ) => {
    if( !treeLoadInput ) {
        return {};
    }

    let variability = variabilityData.getValue();

    let gridData = gridProps.getValue();
    let subsetUIDs = gridData.gridNodes;
    const { treeResult, columnConfig } = exports.prepareColConfigAndTreeData( variability, gridDataProvider, subsetUIDs, vmGridSelectionState, treeLoadInput, gridData );
    columnConfig.columns.forEach( ( column ) => {
        if( column.name !== Pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT ) {
            column.props = {};
            if( !column.isSplitColumn ) {
                _createColumnProps( column, variability );
            }
        }
    } );
    return {
        treeLoadResult: treeResult,
        treeColumnConfig: columnConfig,
        parentNode: treeLoadInput
    };
};

/**
 * Util to get 'Properties Information' to display Data in labels/tooltips, etc.
 * e.g. {cfg0Message: 'Message'}
 * This is to avoid carrying entire variabilityTreeData for i18n purposes
 * [Property Names come localized from the server]
 * @param {Object} variabilitySoaResponse soaResponse containing variability information
 * @returns {Object} localized Prop Info Map
 */
export let getPropInfoFromSOAResponse = ( variabilitySoaResponse ) => {
    let localePropInfoMap = {};
    let propInfoNode = _.find( variabilitySoaResponse.variabilityTreeData, { nodeUid: veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID } );
    if( !_.isUndefined( propInfoNode ) ) {
        let vmoMap = variabilitySoaResponse.viewModelObjectMap;
        _.forEach( propInfoNode.childrenUids, propKey => {
            localePropInfoMap[ propKey ] = vmoMap[ propKey ].displayName;
        } );
    }
    return localePropInfoMap;
};

export default exports = {
    loadDataInTree,
    loadDataFromServer,
    prepareColConfigAndTreeData,
    loadGridDataProvider,
    getPropInfoFromSOAResponse
};

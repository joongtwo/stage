// Copyright (c) 2022 Siemens

/**
 * @module js/aceConfiguratorTabsEvaluationService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};
var _onLoadingOfACESubLocationEventListener = null;

/**
 * Evaluate the visibility of "Variant Conditions" tab for EBOM
 * @param {Array} selectedObjs The selected objects collection
 * @param {Object} occContextValue Context passed to ACE sub-location
 * @returns {boolean} true if Variant Condition Authoring tab is visible and false otherwise
 */
export let evaluateVariantConditionsTabVisibilityOnSelection = function( selectedObjs, occContextValue ) {
    let isVariantConditionTabVisible = true; //set default as true
    if ( !selectedObjs ) {   return isVariantConditionTabVisible; }

    // retrieve the product uid for comparison
    let productUid = _.get( occContextValue, 'currentState.t_uid' );
    //Validate "Variant Conditions" tab visibility, if selected objects are valid Part types
    for( var i = 0; i < selectedObjs.length; i++ ) {
        
        //"Variant Conditions" tab is not supported on partition selection for Structure Partition
        if( !(occContextValue.supportedFeatures['4GStructureFeature'] === true) && selectedObjs[i].type === 'Fgf0PartitionElement' ){
            // Invalid Selection
            isVariantConditionTabVisible = false;
            break;
        }
        // Start - EBOM Specific evaluation
        if( occContextValue && ( occContextValue.supportedFeatures.Awb0PartStructureFeature || occContextValue.supportedFeatures.ProductEBOMFeature ) ) {
            if( selectedObjs[ i ].props && selectedObjs[ i ].props.awb0Parent ) {
                var parent = cdm.getObject( selectedObjs[ i ].props.awb0Parent.dbValues[ 0 ] );
                if( parent && parent.props && parent.props.awb0AssemblyIndicator ) {
                    var assemblyIndicator = parent.props.awb0AssemblyIndicator.dbValues[ 0 ];
                    // VCA is supported for only if Parent is "Configurable Assembly"
                    if( assemblyIndicator === 'Fixed Assembly' ) {
                        // Invalid Selection
                        isVariantConditionTabVisible = false;
                        break;
                    }
                }
            }
        }
        // End - EBOM Specific evaluation

        // get the current selection uid from list
        const selectedUid = selectedObjs[i].uid;
        // if root node is present in selection list, the Variant Conditions tab should not be visible
        if( productUid === selectedUid ) {
            // Invalid Selection
            isVariantConditionTabVisible = false;
            break;
        }
    }

    return isVariantConditionTabVisible;
};

/**
 * Evaluate the visibility of "Variant Conditions" tab
 * @param {Array} selectedObjs The selected objects collection
 * @param {Object} occContextValue Context passed to ACE sub-location
 * @returns {boolean} true if Variant Condition Authoring tab is visible and false otherwise
 */
let _evaluateVariantConditionsTabVisibility = function( selectedObjs, occContextValue ) {
    return occContextValue.supportedFeatures.Awb0SupportsVariantConditionAuthoring && !_.get( appCtxSvc, 'ctx.splitView.mode' ) && evaluateVariantConditionsTabVisibilityOnSelection( selectedObjs, occContextValue );
};

/**
 * Evaluate the visibility of "Variant Configuration" tab
 * @returns {boolean} true if Variant Configuration tab is visible and false otherwise
 */
let _evaluateVariantConfigurationTabVisibility = function( occContextValue ) {
    return occContextValue.supportedFeatures.Awb0SupportsFullScreenVariantConfiguration && !_.get( appCtxSvc, 'ctx.splitView.mode' );
};

/**
  *
 * Evaluate the visibility of Configurator tabs
 * @param {Array} selectedObjs The selected objects collection
 * @param {Object} occContextValue Context passed to ACE sub-location
  */
export let evaluateConfiguratorTabsVisibility = function( selectedObjs, occContextValue ) {
    let configuratorViewsDisplayContext = {
        showVariantConditionsView : _evaluateVariantConditionsTabVisibility( selectedObjs, occContextValue ),
        showVariantConfigurationView : _evaluateVariantConfigurationTabVisibility( occContextValue )
    };
    appCtxSvc.updatePartialCtx( 'configuratorViewsDisplayContext', configuratorViewsDisplayContext );
    // Enable sub ace applications to provide there own visibility for Configurator tabs in ACE
    eventBus.publish( 'ace.evaluateConfiguratorTabsVisibility', { selections: selectedObjs, occContext : occContextValue } );
};

/**
 * Initialize the configurator tab evaluation service
 */
export let initialize = function() {
    _onLoadingOfACESubLocationEventListener = eventBus.subscribe( 'occDataLoadedEvent', eventData => {
        if( eventData.dataProviderActionType === 'initializeAction' ) {
            evaluateConfiguratorTabsVisibility( _.get( eventData, 'scope.subPanelContext.searchState.pwaSelection' ), _.get( eventData, 'scope.subPanelContext.provider.occContext' ) );
        }
    } );
};

/**
 * Destroy and unsubscribe configurator tab evaluation service
 */
export let destroy = function() {
    eventBus.unsubscribe( _onLoadingOfACESubLocationEventListener );
    appCtxSvc.updatePartialCtx( 'configuratorViewsDisplayContext', {
        showVariantConditionsView : false,
        showVariantConfigurationView : false
    } );
};

export default exports = {
    evaluateVariantConditionsTabVisibilityOnSelection,
    evaluateConfiguratorTabsVisibility,
    initialize,
    destroy
};

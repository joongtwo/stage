// Copyright (c) 2022 Siemens

/**
 * @module js/pca0VariantRuleService
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import _ from 'lodash';

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Clean up context data on unMount
 */
export let cleanupData = function() {
    let configuratorCtx = { ..._.get( appCtxSvc, 'ctx.' + veConstants.CONFIG_CONTEXT_KEY ) };
    if( configuratorCtx ) {
        delete configuratorCtx.disableRevRuleOnConfigPerspective;
        appCtxSvc.updateCtx( veConstants.CONFIG_CONTEXT_KEY, configuratorCtx );
    }
};

/**
 * Get Search Criteria as input for performSearchViewModel4 SOA
 * @returns {Object} searchCriteria
 */
export let getSearchCriteria = function() {
    const configuratorCtx = { ..._.get( appCtxSvc, 'ctx.' + veConstants.CONFIG_CONTEXT_KEY ) };
    // This SOA requires revision rule name so we are using dbValue of revision rule name which always comes in english
    const revisionRule = configuratorCtx.configPerspective.revisionRuleDBName;
    return {
        Name: '*',
        configuratorContext: pca0ConfiguratorExplorerCommonUtils.getConfiguratorContextUID(),
        revisionRule: revisionRule
    };
};

/**
 * Get updated column configuration, disabling sorting and filtering for specified columns
 * @param {Object} response SOA response containing columConfig
 * @param {Array} columnsToDisableSort List of columns that do not support sorting
 * @param {Array} columnsToDisableFilter List of columns that do not support filtering
 * @returns {Object} Updated column configuration
 */
export let getColumnConfig = function( response, columnsToDisableSort, columnsToDisableFilter ) {
    return pca0ConfiguratorExplorerCommonUtils.getColumnConfig( response, columnsToDisableSort, columnsToDisableFilter );
};

/**
 * Populate sync object (selected Variant Rules)
 * @param {Object} subPanelContext subPanel context
 * @param {Boolean} isVCVOpenedFromConfigurator flag to identify if the FSC is opened from Variants tab
 */
export let populateSyncObject = function( subPanelContext, isVCVOpenedFromConfigurator ) {
    let configuratorCtx = { ..._.get( appCtxSvc, 'ctx.' + veConstants.CONFIG_CONTEXT_KEY ) };
    if( configuratorCtx ) {
        _.merge( configuratorCtx, {
            variantRuleData: {
                selectedObjects: subPanelContext.selectionData.selected,
                isVCVOpenedFromConfigurator: isVCVOpenedFromConfigurator
            }
        } );
        appCtxSvc.updateCtx( veConstants.CONFIG_CONTEXT_KEY, configuratorCtx );
    }
};

/**
 * Initialize Component
 * Set disableRevRuleOnConfigPerspective flag on context
 * (NOTE: We don't want to call setProperties if user changes revision rule on Variants tab)
 */
export let initComponent = function() {
    let configuratorCtx = { ..._.get( appCtxSvc, 'ctx.' + veConstants.CONFIG_CONTEXT_KEY ) };
    if( configuratorCtx && !_.isUndefined( configuratorCtx.appliedSettings ) ) {
        _.merge( configuratorCtx, { disableRevRuleOnConfigPerspective: true } );
        appCtxSvc.updateCtx( veConstants.CONFIG_CONTEXT_KEY, configuratorCtx );
        const revisionRule = _.get( configuratorCtx, 'appliedSettings.configSettings.props.pca0RevisionRule' );
        const revisionRuleData = {
            appliedRevisionRule: revisionRule,
            contextKey: veConstants.CONFIG_CONTEXT_KEY
        };
        eventBus.publish( 'Pca0FilterCriteriaSettings.refreshRevisionRuleContent', revisionRuleData );
    }
};

export default exports = {
    cleanupData,
    getSearchCriteria,
    getColumnConfig,
    populateSyncObject,
    initComponent
};

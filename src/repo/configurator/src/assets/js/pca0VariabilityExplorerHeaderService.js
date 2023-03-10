// Copyright (c) 2022 Siemens

/**
 * @module js/pca0VariabilityExplorerHeaderService
 */
import appCtxSvc from 'js/appCtxService';
import configuratorUtils from 'js/configuratorUtils';
import eventBus from 'js/eventBus';
import pca0FilterCriteriaSettingsService from 'js/Pca0FilterCriteriaSettingsService';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import _ from 'lodash';

/**
 * Util to set Effectivity feature
 * Effectivity feature is part of AW startup preferences. Add it to context.
 */
let _initializeEffectivityFeature = () => {
    let contextKey = veConstants.CONFIG_CONTEXT_KEY;
    let clonedCtx = _.cloneDeep( appCtxSvc.getCtx( contextKey ) );
    var ctxPreferences = appCtxSvc.getCtx( 'preferences' );
    clonedCtx.effectivityFeature = ctxPreferences.PCA_effectivity_shown_columns[ 0 ];
    appCtxSvc.updatePartialCtx( contextKey + '.effectivityFeature', clonedCtx.effectivityFeature );
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Initialize Header Revision Rule and Rule Effectivity given SOA response
 * @param {Object} response getProperties SOA response
 */
export let initializeHeaderFromSOA = function( response ) {
    if( response && response.plain && response.plain[ 0 ] && response.modelObjects ) {
        const productItemUid = response.plain[ 0 ];
        const cfg0ProductItemData = response.modelObjects[ productItemUid ];
        if( cfg0ProductItemData && cfg0ProductItemData.props ) {
            const configPerspectiveUid = cfg0ProductItemData.props.cfg0ConfigPerspective.dbValues[ 0 ];
            if( configPerspectiveUid ) {
                const configPerspectiveData = response.modelObjects[ configPerspectiveUid ];
                if( configPerspectiveData && configPerspectiveData.props ) {
                    // Initialize Effectivity Feature
                    const revRuleData = configPerspectiveData.props.cfg0RevisionRule;
                    // DB value of revision rule name which remain in english and necessary to fetch variants as SOA takes only revision rule name not UID
                    // As its runtime object so server finds exact rule using name and gives data accordingly
                    const revisionRuleDBName = _.get( response, 'modelObjects.' + revRuleData.dbValues[0] + '.props.object_name.dbValues.0' );
                    configPerspectiveData.revisionRuleDBName = revisionRuleDBName;
                    _initializeEffectivityFeature();

                    // Initialize Context
                    let contextKey = veConstants.CONFIG_CONTEXT_KEY;
                    configuratorUtils.initializeFilterCriteriaForContext( configPerspectiveData, contextKey );
                }
            }
        }
    }
};

/**
 * Initialize or update the revision rule and effectivity link in Variability Explorer header.
 * Initialize Config Perspective and Filter Criteria on Configurator context
 */
export let initializeHeaderInfoForContext = function() {
    let contextKey = veConstants.CONFIG_CONTEXT_KEY;

    // Initialize Effectivity Feature
    _initializeEffectivityFeature();

    // This is similar to configuratorUtils.initializeFilterCriteriaForContext
    // But we have a slightly different behavior:
    // - we do not overwrite appliedSettings and configPerspective on context
    // ----(they might be out-of-sync. 'appliedSettings' is considered the single point of truth)

    // Initialize cache
    configuratorUtils.initializeCache( contextKey );

    // Initialize effectivity
    pca0FilterCriteriaSettingsService.initializeEffectivity( contextKey );
};

export default exports = {
    initializeHeaderFromSOA,
    initializeHeaderInfoForContext
};

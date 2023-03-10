// Copyright (c) 2022 Siemens

/**
 * @module js/pca0ContextManagementService
 */
import appCtxSvc from 'js/appCtxService';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import eventBus from 'js/eventBus';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import _ from 'lodash';

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Register the Configurator Context with the application context.
 * Fetch configuration information from Session Storage if available.
 * Trigger getProperties SOA call if needed.
 */
export let registerConfiguratorCtx = function() {
    var configContext = appCtxSvc.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    if( !configContext || _.isEmpty( configContext ) ) {
        configContext = {}; {
            // TODO <Vaibhav>: Code to be removed once authoring functionality stabilizes - LCS-643542
            var url = window.location;
            if( url.href.search( 'cfgauth' ) > -1 ) {
                configContext.cfgauth = true;
            }
        }

        // Query Configurator Context Information from Session Storage
        let getPropsSOACallNeeded = true;
        let configuratorContextUID = pca0ConfiguratorExplorerCommonUtils.getConfiguratorContextUID();
        const configCtxMap = pca0ConfiguratorExplorerCommonUtils.getConfigCtxMapFromSessionStorage();
        if( configCtxMap.hasOwnProperty( configuratorContextUID ) ) {
            configContext.configPerspective = configCtxMap[ configuratorContextUID ].configPerspective;
            configContext.appliedSettings = configCtxMap[ configuratorContextUID ].appliedSettings;
            getPropsSOACallNeeded = false;
        }
        appCtxSvc.registerCtx( veConstants.CONFIG_CONTEXT_KEY, configContext );

        let eventName = getPropsSOACallNeeded ?
            'pca0VariabilityExplorerHeaderService.getRequiredProperties' :
            'pca0VariabilityExplorerHeaderService.initializeHeader';
        eventBus.publish( eventName );
    }
};

/**
 * Unregister the configurator context from the application context:
 * - only if selected tab is not Model/Features/Variants/Constraints
 */
export let unregisterConfiguratorCtx = function() {
    var state = appCtxSvc.getCtx( 'state' );
    if( state.params.pageId !== 'tc_xrt_Models' &&
        state.params.pageId !== 'tc_xrt_Features' &&
        state.params.pageId !== 'tc_xrt_Variants' &&
        state.params.pageId !== 'tc_xrt_Constraints' ) {
        appCtxSvc.updatePartialCtx( 'clientScopeURI', '' );
        appCtxSvc.unRegisterCtx( veConstants.CONFIG_CONTEXT_KEY );
    }
};

/**
 * Util to perform Custom action in Variants tab
 * NOTE: for Variants tab we don't call setProperties when Revision Rule is changed
 * as we don't want to make changes in perspective
 * In this method:
 * - we only make changes forcefully in context without calling setProperties
 * - we update sessionStorage for 'appliedSettings' section only (no edits on perspective)
 * - we set a dirty flag on sessionStorage to notify out-of-sync situation
 * @param {*} eventData details about changed revision rule
 */
export var notifyTabsToUpdateRevisionRule = function( eventData ) {
    const pageId = appCtxSvc.getCtx( 'state.params.pageId' );
    let configuratorCtx = { ..._.get( appCtxSvc, 'ctx.' + veConstants.CONFIG_CONTEXT_KEY ) };
    if( configuratorCtx && eventData && pageId === 'tc_xrt_Variants' &&
        configuratorCtx.lastSelectedRevisionRuleUid !== eventData[ 0 ].uid ) {
        const uiValues = eventData[ 0 ].cellHeader1;
        _.set( configuratorCtx, 'appliedSettings.configSettings.props.pca0RevisionRule', {
            dbValues: [ eventData[ 0 ].uid ],
            uiValues: [ uiValues ]
        } );
        _.set( configuratorCtx, 'lastSelectedRevisionRuleUid', eventData[ 0 ].uid );
        configuratorCtx.configPerspective.revisionRuleDBName = eventData[ 0 ].props.object_name.dbValues[0]; // db values should be use in SOA;
        appCtxSvc.updateCtx( veConstants.CONFIG_CONTEXT_KEY, configuratorCtx );

        // Update Session Storge for appliedSettings only
        // This will cause 'appliedSettings' to be out-of-sync with 'configPerspective'
        // The synchronization between the two will take place when user navigates to another Variability Explorer tab
        exports.syncSessionStorage( true );

        const revRuleUpdates = { dbValues: [ eventData[ 0 ].uid ], uiValues: [ uiValues ] };

        // Fire events to reload Variants data and update revision rule link in Variants tab
        eventBus.publish( 'pca0VariantRuleGrid.plTable.reload' );
        const revisionRuleData = {
            appliedRevisionRule: revRuleUpdates,
            contextKey: veConstants.CONFIG_CONTEXT_KEY
        };

        eventBus.publish( 'Pca0FilterCriteriaSettings.refreshRevisionRuleContent', revisionRuleData );
    }
};

/**
 * Save Configurator Context Header information on SessionStorage
 * @param {Boolean} setOutOfSyncFlag true if out-of-sync flag has to be set on sessionStorage
 */
export let syncSessionStorage = ( setOutOfSyncFlag ) => {
    let configCtxMap = pca0ConfiguratorExplorerCommonUtils.getConfigCtxMapFromSessionStorage();
    var configContext = appCtxSvc.getCtx( veConstants.CONFIG_CONTEXT_KEY );

    // <TODO> USE baseSelection to be independent from global ctx
    let configuratorContextUID = _.get( configContext, 'configPerspective.props.cfg0ProductItems.dbValues[0]' );
    configCtxMap[ configuratorContextUID ] = {
        isOutOfSyncWithPerspective: setOutOfSyncFlag,
        configPerspective: configContext.configPerspective,
        appliedSettings: configContext.appliedSettings
    };
    sessionStorage.setItem( veConstants.CONFIG_CONTEXT_MAP, JSON.stringify( configCtxMap ) );
};

export default exports = {
    registerConfiguratorCtx,
    unregisterConfiguratorCtx,
    notifyTabsToUpdateRevisionRule,
    syncSessionStorage
};

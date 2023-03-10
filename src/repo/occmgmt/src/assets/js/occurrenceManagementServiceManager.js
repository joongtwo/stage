// Copyright (c) 2022 Siemens

/**
 * @module js/occurrenceManagementServiceManager
 */
import aceConfiguratorTabsEvaluationService from 'js/aceConfiguratorTabsEvaluationService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import backgroundWorkingCtxTimer from 'js/backgroundWorkingContextTimer';
import backgroundWorkingCtxSvc from 'js/backgroundWorkingContextService';
import toggleIndexConfigurationService from 'js/toggleIndexConfigurationService';
import globalRevRuleConfigurationService from 'js/globalRevRuleConfigurationService';
import occmgmtUpdatePwaDisplayService from 'js/occmgmtUpdatePwaDisplayService';
import aceColorDecoratorService from 'js/aceColorDecoratorService';
import structureFilterService from 'js/structureFilterService';
import discoveryFilterService from 'js/discoveryFilterService';
import discoverySubscriptionService from 'js/discoverySubscriptionService';
import occmgmtTreeTableDataService from 'js/occmgmtTreeTableDataService';
import occmgmtStructureEditService from 'js/occmgmtStructureEditService';
import aceExpandBelowService from 'js/aceExpandBelowService';
import changeService from 'js/changeService';
import aceDefaultCutCopyService from 'js/aceDefaultCutCopyService';
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import occmgmtPropertyPolicyService from 'js/occmgmtPropertyPolicyService';
import variantInfoConfigurationService from 'js/variantInfoConfigurationService';
import propertyCallTimer from 'js/invoker/propertyCallTimer';
import effectivityService from 'js/effectivityService';

var exports = {};

/**
 * Initialize occurrence management services
 */
export let initializeOccMgmtServices = function( contextKey, useAutoBookmark ) {
    occMgmtStateHandler.initializeOccMgmtStateHandler( contextKey );
    if( useAutoBookmark ) {
        backgroundWorkingCtxTimer.initialize( contextKey );
        backgroundWorkingCtxSvc.initialize( contextKey );
        aceRestoreBWCStateService.initialize( contextKey );
    }

    globalRevRuleConfigurationService.initialize( contextKey );
    occmgmtUpdatePwaDisplayService.initialize( contextKey );
    aceColorDecoratorService.initializeColorDecors( contextKey );
    toggleIndexConfigurationService.initialize( contextKey );
    structureFilterService.initializeContextKey( contextKey );
    discoverySubscriptionService.initialize( contextKey );
    occmgmtTreeTableDataService.initialize( contextKey );
    occmgmtStructureEditService.initialize( contextKey );
    changeService.initialize( contextKey );
    aceExpandBelowService.initialize( contextKey );
    variantInfoConfigurationService.initialize( contextKey );
    aceConfiguratorTabsEvaluationService.initialize( contextKey );
    effectivityService.initialize( contextKey );
    propertyCallTimer.initialize();

    //Following call to register policy will be removed in future with polarion item :
    // LCS-545909 - Remove property policy on client JS code for 'awb0QuantityManaged' and implement proper fix
    occmgmtPropertyPolicyService.registerPropertyPolicy();
};

/**
 * Destroy occurrence management services
 */
export let destroyOccMgmtServices = function( subPanelContext ) {
    let contextKey = subPanelContext.provider.contextKey;

    if( subPanelContext.provider.useAutoBookmark ) {
        backgroundWorkingCtxTimer.reset();
        backgroundWorkingCtxSvc.reset( subPanelContext );
    }

    toggleIndexConfigurationService.reset( contextKey );
    globalRevRuleConfigurationService.destroy();
    occmgmtUpdatePwaDisplayService.destroy( contextKey );
    occMgmtStateHandler.destroyOccMgmtStateHandler( contextKey );
    aceColorDecoratorService.destroyColorDecors( contextKey );
    structureFilterService.destroy( contextKey );
    discoveryFilterService.destroy( contextKey );
    occmgmtTreeTableDataService.destroy( contextKey );
    occmgmtStructureEditService.destroy( contextKey );
    aceExpandBelowService.destroy( contextKey );
    changeService.destroy( contextKey );
    aceDefaultCutCopyService.destroy( contextKey );
    aceRestoreBWCStateService.destroy( contextKey );
    discoverySubscriptionService.destroy( contextKey );
    variantInfoConfigurationService.destroy( contextKey );
    aceConfiguratorTabsEvaluationService.destroy( contextKey );
    effectivityService.destroy( contextKey );
    propertyCallTimer.destroy();

    //Following call to register policy will be removed in future with polarion item :
    // LCS-545909 - Remove property policy on client JS code for 'awb0QuantityManaged' and implement proper fix
    occmgmtPropertyPolicyService.unRegisterPropertyPolicy();
};

/**
 * Occurrence Management Service Manager
 */

export default exports = {
    initializeOccMgmtServices,
    destroyOccMgmtServices
};

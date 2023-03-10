// Copyright (c) 2022 Siemens

/**
 * @module js/globalRevRuleConfigurationService
 */
import appCtxSvc from 'js/appCtxService';
import revRuleConfigService from 'js/revisionRuleConfigurationService';
import eventBus from 'js/eventBus';

var exports = {};

var _onAdminPanelRevisionRuleChangedEventListener = null;

export let initialize = function() {
    _onAdminPanelRevisionRuleChangedEventListener = eventBus
        .subscribe(
            'RevisionRuleAdminPanel.revisionRuleChanged',
            function( eventData ) {
                var viewKey = eventData.contextViewKey;
                var contextObject = appCtxSvc.getCtx( viewKey );
                appCtxSvc.updatePartialCtx( viewKey + '.configContext', {
                    r_uid: eventData.revisionRule,
                    useGlobalRevRule: eventData.useGlobalRevRule,
                    var_uids: revRuleConfigService.evaluateVariantRuleUID( contextObject ),
                    iro_uid: null,
                    de: null,
                    ue: null,
                    ei_uid: null,
                    rev_sruid: eventData.rev_sruid,
                    startFreshNavigation: true
                } );
            }, 'AdminRevRuleConfigurationChange' );
};

export let destroy = function() {
    eventBus.unsubscribe( _onAdminPanelRevisionRuleChangedEventListener );
};

/**
 * Global Revision Rule Configuration Service
 */
export default exports = {
    initialize,
    destroy
};

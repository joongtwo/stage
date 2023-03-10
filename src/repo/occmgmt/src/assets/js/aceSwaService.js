// Copyright (c) 2022 Siemens

/**
 * @module js/aceSwaService
 */
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import contextStateMgmtService from 'js/contextStateMgmtService';
import occmgmtUtils from 'js/occmgmtUtils';
import occmgmtSublocationService from 'js/occmgmtSublocationService';
import eventBus from 'js/eventBus';

/**
 * {EventSubscriptionArray} Collection of eventBuss subscriptions to be removed when the controller is
 * destroyed.
 */
var exports = {};
var _tabsSupportedForSplitView = [ 'tc_xrt_Overview', 'tc_xrt_Finishes', 'tc_xrt_MadeFrom',
    'web_whereused', 'tc_xrt_Changes', 'tc_xrt_History', 'attachments', 'tc_xrt_Simulation', 'Awb0ViewerFeature', 'Awv0StructureViewerPageContainer'
];

export let isTabSupportedForSplitView = function( pageId ) {
    return _tabsSupportedForSplitView.includes( pageId );
};

export let getActivePageId = function( contextKey ) {
    var currentContext = appCtxService.getCtx( contextKey );
    if( !_.isUndefined( currentContext ) ) {
        var spageId = currentContext && currentContext.currentState.spageId;
        if( _.isUndefined( spageId ) || _.isNull( spageId ) ) {
            var sublocationAttributes = currentContext.sublocationAttributes;
            if( sublocationAttributes && sublocationAttributes.awb0ActiveSublocation ) {
                spageId = sublocationAttributes.awb0ActiveSublocation[ 0 ];
            }
        }
        return spageId;
    }
    return null;
};

/**
 * on SWA tab change, set isUserContextSaveRequired to true. To invoke saveUserWorkingContextState SOA
 */
export let swaTabChange = function( subPanelContext ) {
    var currentContext = appCtxService.getCtx( subPanelContext.contextKey );
    if( currentContext && currentContext.treeLoadingInProgress === false ) {
        //Get the SWA page id present on the URL and the one in the CFX atomic data to check URL update needed or not
        var activeTab = subPanelContext.occContext.currentState.spageId;
        if( _.isUndefined( activeTab ) ) {
            //If spageId not available then get the value what is sent by server in the SOA response
            activeTab = !_.isUndefined( currentContext.sublocationAttributes ) ? currentContext.sublocationAttributes.awb0ActiveSublocation[ 0 ] : undefined;
        }
        var secondaryActiveTabId = subPanelContext.pageContext.sublocationState.secondaryActiveTabId;
        if( secondaryActiveTabId !== activeTab ) {
            if( secondaryActiveTabId !== 'SelectionSummary' ) {
                var contextState = contextStateMgmtService.createContextState( subPanelContext.occContext, {
                    spageId: secondaryActiveTabId
                }, true );

                var value = {
                    isUserContextSaveRequired: true,
                    currentState: contextState.currentState,
                    previousState: contextState.previousState
                };
                occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelContext.occContext );
                occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelContext.contextKey );
                occmgmtSublocationService.updateUrlFromCurrentState( subPanelContext.provider, contextState.currentState );
            }
            if( !aceRestoreBWCStateService.isProductInteracted( currentContext.currentState.uid ) ) {
                eventBus.publish( 'occMgmt.interaction' );
            }
        }
    }
};

export default exports = {
    getActivePageId,
    swaTabChange,
    isTabSupportedForSplitView
};

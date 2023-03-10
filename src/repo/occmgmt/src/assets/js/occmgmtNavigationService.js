// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * This represents the Occmgmt Navigation Module
 *
 * @module js/occmgmtNavigationService
 */
import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import logger from 'js/logger';

import 'js/leavePlace.service';

var exports = {};

// service and module references

/**
 * Function to transition to ACE with the focus on the occurrence identified by the input clone stable id chain.
 *
 * @param {String} productRevisionUid Top Item Revision uid
 * @param {String} revisionRuleUid Revision Rule uid
 * @param {String} variantRuleInfo variantRuleUid; String variantRuleOwiningItemId;
 * @param {Date} effectivityInfo dateEffectivity; int unitEffectivity; String endItemId;
 * @param {Object} cloneStableIdChain Clone stable chain id for the occurrence to focus
 * @param {Boolean} cleanupBookmarkData if true then delete the BookmarkData
 * @param {Boolean} reload if true then will force transition even if no state or params have changed
 */
export let createURLAndLaunchContent = function( productRevisionUid, revisionRuleUid, variantRuleInfo,
    effectivityInfo, cloneStableIdChain, cleanupBookmarkData, reload ) {
    if( !productRevisionUid ) {
        throw 'Mandatory argument productRevisionUid not defined.';
    }
    if ( !revisionRuleUid ) {
        throw 'Mandatory argument revisionRuleUid not defined.';
    }
    if ( !cloneStableIdChain ) {
        throw 'Mandatory argument cloneStableIdChain not defined.';
    }

    var transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
    var toParams = {};

    toParams.page = 'Content';
    toParams.pageId = 'tc_xrt_Content';
    toParams.uid = productRevisionUid;

    var options = {};
    if( reload ) {
        options.reload = reload;
    }
    var systemLocatorParams = {};

    systemLocatorParams.RevisionRule = revisionRuleUid;
    systemLocatorParams.OccThreadChain = cloneStableIdChain;
    //This is Focus Occurrence with clone stable id chain use case.So, setting isFocusedLoad to true
    systemLocatorParams.isFocusedLoad = true;

    if( variantRuleInfo ) {
        systemLocatorParams.VariantRule = variantRuleInfo.variantRuleUid;
    }

    if( effectivityInfo ) {
        systemLocatorParams.EndItemUid = effectivityInfo.endItemUid;
        systemLocatorParams.ToUnit = effectivityInfo.unitEffectivity;
        systemLocatorParams.EndDate = effectivityInfo.dateEffectivity;
    }

    if( cleanupBookmarkData ) {
        systemLocatorParams.savedSessionMode = 'reset';
    }

    appCtxSvc.registerCtx( 'systemLocator', systemLocatorParams );

    logger.trace( '#### locationChangeSuccess with params : ' + toParams );
    logger.trace( '#### locationChangeSuccess with params : ' + systemLocatorParams );
    AwStateService.instance.go( transitionTo, toParams, options );
};

export let navigateWithGivenParams = function( urlParamsMap, urlParamsWithValue ) {
    var paramWithKeys = Object.keys( urlParamsWithValue );
    var urlParams = { ...AwStateService.instance.params };
    for( var param in urlParamsMap ) {
        if( paramWithKeys.includes( param ) ) {
            urlParams[ urlParamsMap[ param ] ] = urlParamsWithValue[ param ];
        } else {
            urlParams[ urlParamsMap[ param ] ] = null;
        }
    }
    AwStateService.instance.go( '.', urlParams );
};

export default exports = {
    createURLAndLaunchContent,
    navigateWithGivenParams
};

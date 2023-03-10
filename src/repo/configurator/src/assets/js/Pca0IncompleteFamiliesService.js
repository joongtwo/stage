// Copyright (c) 2022 Siemens

/**
 * Helper service for handling guided navigation through incomplete families and features
 *
 * @module js/Pca0IncompleteFamiliesService
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import Pca0Constants from 'js/Pca0Constants';
import pca0ScopesService from 'js/pca0ScopesService';
import _ from 'lodash';

var exports = {};

/**
 * Get Navigation Info from Cached Data when Active Family is set
 * Next/Previous UID will be processed starting from current Active Family
 * Next: start looking from next (top-down) family starting from Active Family
 * Previous: start looking from previous (bottom-up) family starting from Active Family
 * @param {String} activeFamilyUID current family serving as starting point for next/previous search
 * @returns {Object} navigation information: group and family UIDs
 */
let _getNavigationInfoGivenFamily = function( activeFamilyUID ) {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let cachedUIDs = context.incompleteFamiliesInfo.incompleteFamilies;
    let cachedTreeNodes = context.incompleteFamiliesInfo.incompleteFamiliesTreeData;
    let navigationFamilyUID = undefined;
    let navigationGroupUID = undefined;

    // Circular search: get next/previous index from cached list of UIDs
    // Next: if end of list is reached, get first element from list
    // Previous: if first of list is reached, get last element from list
    let currentIdx = cachedUIDs.indexOf( activeFamilyUID );
    let navIdx;
    if( context.goPrevious ) {
        navIdx = currentIdx - 1;
        if( navIdx === -1 ) {
            navIdx = cachedUIDs.length - 1;
        }
    } else {
        navIdx = currentIdx + 1;
        if( navIdx === cachedUIDs.length ) {
            navIdx = 0;
        }
    }
    navigationFamilyUID = cachedUIDs[ navIdx ];
    let navigationFamilyNode = _.find( cachedTreeNodes, { nodeUid: navigationFamilyUID } );
    navigationGroupUID = navigationFamilyNode.parentUids[ 0 ];
    return {
        navigationGroupUID,
        navigationFamilyUID
    };
};

/**
 * Get Navigation Info from Cached Data when Active Family is not set
 * Next/Previous UID will be processed starting from current group
 * Next: start looking from first family in current group
 * Previous: start looking from last family in previous group (always a change of scope)
 * @returns {Object} navigation information: group and family UIDs
 */
let _getNavigationInfoGivenGroup = function() {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let cachedTreeNodes = context.incompleteFamiliesInfo.incompleteFamiliesTreeData;
    let navigationFamilyUID = undefined;
    let navigationGroupUID = undefined;
    let currentGroupUID = _.isUndefined( context.currentScope ) ?
        Pca0Constants.PSUEDO_GROUPS_UID.PRODUCTS_GROUP_UID : context.currentScope;

    // Note: a Next/Previous is always found (eventually coming back to current group)
    if( context.goPrevious ) {
        // goPrevious: always start from previous group
        let prevScopeFound = false;
        navigationGroupUID = currentGroupUID;
        while( !prevScopeFound ) {
            navigationGroupUID = pca0ScopesService.getPreviousScope( navigationGroupUID );
            let prevScopeNode = _.find( cachedTreeNodes, { nodeUid: navigationGroupUID } );
            if( !_.isUndefined( prevScopeNode ) ) {
                prevScopeFound = true;
                navigationFamilyUID = prevScopeNode.childrenUids[ prevScopeNode.childrenUids.length - 1 ];
            }
        }
    } else {
        // Start from current group
        navigationGroupUID = currentGroupUID;
        let groupNode = _.find( cachedTreeNodes, { nodeUid: navigationGroupUID } );
        if( _.isUndefined( groupNode ) ) {
            let nextScopeFound = false;
            while( !nextScopeFound ) {
                navigationGroupUID = pca0ScopesService.getNextScope( navigationGroupUID );
                let nextScopeNode = _.find( cachedTreeNodes, { nodeUid: navigationGroupUID } );
                if( !_.isUndefined( nextScopeNode ) ) {
                    nextScopeFound = true;
                    groupNode = nextScopeNode;
                }
            }
        }
        navigationFamilyUID = groupNode.childrenUids[ 0 ];
    }
    return {
        navigationGroupUID,
        navigationFamilyUID
    };
};

/**
 * Trigger navigation
 * @param {Boolean} resetCachedSoa reset cached soaResponse
 * @param {Object} scopeSelection atomic data
 */
let _triggerNavigation = function( resetCachedSoa, scopeSelection ) {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    // If Navigation Family is in current scope, do UI adjustments
    if( context.navigateTo.groupUid === context.currentScope ) {
        eventBus.publish( 'Pca0Features.focusToFamily' );
    } else {
        // Navigation Family is in a different scope: enforce scope selection
        if( resetCachedSoa ) {
            // Invalidate cached SOA: a new SOA call will be made to download new scope data
            delete context.navigateTo.soaResponse;
        }
        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, context );

        if( scopeSelection !== undefined && scopeSelection.getAtomicData ) {
            var newScopeSelection = { ...scopeSelection.getAtomicData() };
            newScopeSelection.currentScopeSelectionUid = context.navigateTo.groupUid;
            scopeSelection.setAtomicData( newScopeSelection );
        } else if( scopeSelection && scopeSelection.update ) {
            let newscopeSelection = { ...scopeSelection.value };
            newscopeSelection.currentScopeSelectionUid = context.navigateTo.groupUid;
            scopeSelection.update( newscopeSelection );
        }
    }
};

/**
 * Get "Next"/"Previous" navigation information from cached data
 * @param {Object} scopeSelection atomic data
 */
let _getNavigationInfoFromCachedData = function( scopeSelection ) {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    // Navigation target based on Active Family
    // ActiveFamily may be
    // - the target of Next/Previous navigation
    // - family owning last selected feature
    let navigationInfo = !_.isUndefined( context.activeFamilyUID ) ?
        _getNavigationInfoGivenFamily( context.activeFamilyUID ) : // Active Family is still set, start research for Next/Previous from there
        _getNavigationInfoGivenGroup(); // Active Family is not set. This occurs when scope selection was changed by the user

    // Update Navigation information on context
    context.navigateTo = {};
    context.navigateTo.groupUid = navigationInfo.navigationGroupUID;
    context.navigateTo.familyUid = navigationInfo.navigationFamilyUID;

    // Trigger navigation
    // Invalidate cached SOA: a new SOA call will be made to download new scope data if needed
    _triggerNavigation( true, scopeSelection );

    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, context );
};

/**
 * Process "computeNextIncompleteFamily" SOA response and Initialize completeness and Navigation Information
 * @param {Object} soaResponse the SOA response for "computeNextIncompleteFamily" VCV2 call
 * @param {Object} scopeSelection atomic data
 * @returns {Object} incomplete families Information
 */
export let initIncompleteFamiliesInfo = function( soaResponse, scopeSelection ) {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let incompleteFamiliesInfo = JSON.parse( soaResponse.responseInfo.incompleteFamiliesInfo[ 0 ] );

    // Get next/previous navigation Group
    let navigationFamilyUID = soaResponse.responseInfo.currentIncompleteFamily[ 0 ];
    let familyNode = _.find( incompleteFamiliesInfo.incompleteFamiliesTreeData, { nodeUid: navigationFamilyUID } );
    let groupNode = _.find( incompleteFamiliesInfo.incompleteFamiliesTreeData, { nodeUid: familyNode.parentUids[ 0 ] } );
    let navigationGroupUID = groupNode.nodeUid;

    // Update Navigation information on context
    // (TODO to be enhanced) soaResponse will be used when changing scope to navigate to next family
    // features are cached, without unnecessary soa call
    context.navigateTo = {
        groupUid: navigationGroupUID,
        familyUid: navigationFamilyUID,
        soaResponse: soaResponse
    };
    context.incompleteFamiliesInfo = incompleteFamiliesInfo;
    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, context );

    // Trigger navigation
    if( !_.isUndefined( context.navigateTo ) ) {
        _triggerNavigation( false, scopeSelection );
    }
    return incompleteFamiliesInfo;
};

/**
 * Navigate to Next/Previous Required 
 * If cached data is available: 
 * - get Next/Previous Required from cached data.
 * - If on different group, call SOA to fetch configuration data.
 * - If on same active group, adjust UI for navigation and highlight
 * If cached data is not available:
 * - call SOA to re-compute incompleteness and navigate to next/previous Required
 * @param {Boolean} goPrevious True if "Previous Required" command was clicked
 * @param {Object} commandContext containing selection atomic data
 */
export let navigateToNextIncompleteFamily = function( goPrevious, commandContext ) {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    context.goPrevious = goPrevious;

    // If Next is clicked, set property conditions to enable Previous Required
    if( !goPrevious ) {
        context.isNextRequiredClicked = true;
    }
    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, context );

    if( _.isUndefined( context.incompleteFamiliesInfo ) ) {
        // Cached data is not available: trigger SOA call
        eventBus.publish( 'Pca0FullScreenConfiguration.getNextRequired' );
    } else {
        // Process Next/Previous Required and navigate
        _getNavigationInfoFromCachedData( commandContext.scopeSelection );
    }
};

/**
 * Reset incomplete families cache to compute Next/Previous Required
 * @param {Object} context Context to delete incompleteFamiliesInfo and update with new active family
 * @param {Object} familyUID active family on context
 */
export let resetIncompleteFamiliesCache = function( context, familyUID ) {
    delete context.incompleteFamiliesInfo;
    context.activeFamilyUID = familyUID;
    appCtxSvc.updateCtx( 'fscContext', context );
};

export default exports = {
    initIncompleteFamiliesInfo,
    navigateToNextIncompleteFamily,
    resetIncompleteFamiliesCache
};

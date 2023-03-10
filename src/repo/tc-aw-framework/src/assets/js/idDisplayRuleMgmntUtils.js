// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/idDisplayRuleMgmntUtils
 */
import localeSvc from 'js/localeService';
import tcViewModelObjectSvc from 'js/tcViewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';

var exports = {};

/**
 * Persist selected vmo in context for which the 'i' command is clicked
 * This is required as vmo is lost from panelContext when navigating from sub-panel to main panel
 * @param {Object} context - Id Display Rule context
 * @return {Boolean} isIdDispRuleInfoReadyToLaunch - boolean flag
 */
export let setUnSetInContextIdDisplayRule = function( context ) {
    var isIdDispRuleInfoReadyToLaunch = null;
    if( context && context.idDisplayRuleContext ) {
        appCtxSvc.registerCtx( 'idDisplayRuleContext', context.idDisplayRuleContext );
        isIdDispRuleInfoReadyToLaunch = true;
    } else {
        appCtxSvc.unRegisterCtx( 'idDisplayRuleContext' );
    }
    return isIdDispRuleInfoReadyToLaunch;
};

/**
 * get selected display rule
 * @param {Object} data - event data.
 * @return {Object} selected Display rule object.
 */
export let getCurrentDisplayRule = function( data ) {
    return cdm.getObject( data.eventData.property ? data.eventData.property.dbValue.uid : data.eventData.selectedObjects[ 0 ].uid );
};

/**
 * The function will get all the display rules configured for this user excluding the empty rule.
 * Additionally one empty rule will also be added.
 * @param {Object} response - Response object from the getDisplayRule SOA.
 * @return {Object} array of display rules for this user.
 */
export let getDisplayIdsForUser = function( response ) {
    var displayRules = [];
    _.forEach( response.ServiceData.modelObjects, function( respObj ) {
        if( respObj && respObj.props && respObj.modelType.typeHierarchyArray.indexOf( 'IdDispRule' ) > -1 ) {
            displayRules.push( respObj );
        }
    } );
    // following snippet ensures totalFound is updated only when display Rule sublocation is in play and not elsewhere
    if( appCtxSvc.ctx.sublocation && appCtxSvc.ctx.sublocation.clientScopeURI === 'Awp0MyIdDisplayRules' && !_.isUndefined( appCtxSvc.ctx.search ) ) {
        appCtxSvc.ctx.search.totalFound = displayRules.length;
    }
    return displayRules;
};

/**
 * The function will get all the display rules configured for this user including the empty rule.
 * Additionally one empty rule will also be added.
 * @param {Object} response - Response object from the getDisplayRule SOA.
 * @return {Object} array of display rules for this user.
 */
export let getDisplayIdsForUserIncludingEmpty = function( response ) {
    var displayRules = exports.getDisplayIdsForUser( response );

    // Add empty (no rule) display rule.
    return localeSvc.getLocalizedText( 'IdDisplayRulesMessages', 'emptyDisplayRule' ).then(
        function( noIdDisplayRuleText ) {
            var noIdDisplayRuleObj = {
                uiValue: noIdDisplayRuleText,
                dbValue: 'noIdDisplayRule',
                uiValues: [ noIdDisplayRuleText ],
                dbValues: [ 'noIdDisplayRule' ]
            };
            var props = {
                object_string: noIdDisplayRuleObj
            };
            var noIdDisplayRule = {
                props: props,
                uid: 'AAAAAAAAAAAAAA',
                modelType: {
                    typeHierarchyArray: [ 'IdDispRule' ]
                },
                type: 'IdDispRule'
            };
            var noIdDisplayRuleVmo = tcViewModelObjectSvc.createViewModelObjectById( noIdDisplayRule.uid );
            noIdDisplayRuleVmo.props = noIdDisplayRule.props;
            noIdDisplayRuleVmo.type = noIdDisplayRule.type;
            displayRules.push( noIdDisplayRuleVmo );
            return displayRules;
        } );
};

export default exports = {
    setUnSetInContextIdDisplayRule,
    getCurrentDisplayRule,
    getDisplayIdsForUser,
    getDisplayIdsForUserIncludingEmpty
};

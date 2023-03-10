// Copyright (c) 2022 Siemens

/**
 * @module js/aceStructureConfigurationService
 */
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import appCtxSvc from 'js/appCtxService';
import occmgmtUpdatePwaDisplayService from 'js/occmgmtUpdatePwaDisplayService';
import contextStateMgmtService from 'js/contextStateMgmtService';
import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

export let initialize = function() {
};

export let updatedbValue = function( input ) {
    return input === true || input === 'true';
};
export let updateConfiguration = function( data, occContext ) {
    if( occContext && occContext.configContext && !occContext.skipReloadOnConfigParamChange && !_.isEmpty( occContext.configContext ) ) {
        eventBus.publish( 'configurationChangeStarted' );

        if( !_.isUndefined( occContext.currentState ) && !aceRestoreBWCStateService.isProductInteracted( occContext.currentState.uid ) ) {
            aceRestoreBWCStateService.processProductInteraction( occContext ).then( function( ) {
                ///control will come here when resetUserWorkingContextState is complete
                var newState = {};
                newState.incontext_uid = null;
                contextStateMgmtService.updateContextState( undefined, newState, true, occContext );
                occmgmtUpdatePwaDisplayService.resetPwaContents( { viewToReset: data.contextKey }, occContext );
            } );
        } else{
            if( occContext.currentState !== undefined ) {
                var newState = {};
                newState.incontext_uid = null;
                contextStateMgmtService.updateContextState( undefined, newState, true, occContext );
            }
            occmgmtUpdatePwaDisplayService.resetPwaContents( { viewToReset: data.contextKey }, occContext );
        }
    }
};

/**
  * Populate the contextKeyObject on data object from viewModel.
  *
  * @param {Object} data - The 'data' object from viewModel
  * @returns {Object} The 'data' object from viewModel
  */
export let populateContextKey = function( data ) {
    if( data.subPanelContext ) {
        if( _.get( data, 'subPanelContext.configurationInPanel' ) ) {
            const contextKeyObject = appCtxSvc.getCtx( 'aceActiveContext.context' );
            const contextKey = 'aceActiveContext.context';
            const viewKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
            return { contextKeyObject, contextKey, viewKey };
        } else if( _.get( data, 'subPanelContext.provider.contextKey' ) ) {
            const contextKeyObject = appCtxSvc.getCtx( data.subPanelContext.provider.contextKey );
            const contextKey = data.subPanelContext.provider.contextKey;
            const viewKey = data.subPanelContext.provider.contextKey;
            return { contextKeyObject, contextKey, viewKey };
        }
    }
    const contextKeyObject = appCtxSvc.getCtx( 'aceActiveContext.context' );
    const contextKey = 'aceActiveContext.context';
    const viewKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    return { contextKeyObject, contextKey, viewKey };
};

/**
  * Get the data object from viewModel.
  *
  * @param {Object} data - The 'data' object from viewModel
  * @returns {Object} The 'data' object from viewModel
  */
export let getViewModelData = function( data ) {
    return data;
};

/**
  * Get the correct provider name based on tc version.
  *
  * @param {Object} providerName - The input 'provider name'
  * @returns {Object} The 'provider name' based on tc version
  */
export let getProviderName = function( providerName ) {
    var prefix = occmgmtUtils.isMinimumTCVersion( 14, 0 ) ? 'Fnd0' : 'Awb0';
    return prefix + providerName;
};

export let destroy = function() {
};

export default exports = {
    initialize,
    destroy,
    populateContextKey,
    getViewModelData,
    updateConfiguration,
    getProviderName,
    updatedbValue
};

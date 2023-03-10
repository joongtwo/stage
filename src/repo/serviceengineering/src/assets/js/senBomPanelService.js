// Copyright (c) 2022 Siemens

/**
 * Service for senBomPanel view.
 * @module js/senBomPanelService
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import occMgmtServiceManager from 'js/occurrenceManagementServiceManager';
import occMgmtSubLocService from 'js/occmgmtSublocationService';

let exports = {};
let _eventSubDefs = [];

/**
  * Get request preference object
  *
  * @param {object} provider - provider/subPanelContext object
  * @returns {object} - Request preference object
  */
let _getRequestPrefObject = function( provider ) {
    let requestPref = {
        savedSessionMode: 'restore'
    };

    if ( provider.openMode ) {
        requestPref.openWPMode = provider.openMode;
    }
    return requestPref;
};

/**
  * Register context for sen BOM Panel
  *
  * @param {object} provider - provider/subPanelContext object
  */
let _registerContext = function( provider ) {
    let requestPref = _getRequestPrefObject( provider );
    appCtxSvc.registerCtx( 'requestPref', requestPref );
    let currentContext = {};
    let modelObject = provider.baseSelection.modelObject;
    currentContext.uid = modelObject.uid;
    currentContext.t_uid = modelObject.uid;
    currentContext.pci_uid = "";
    appCtxSvc.registerCtx( provider.viewKey, {
        currentState: currentContext,
        requestPref: requestPref,
        modelObject: provider.baseSelection.modelObject,
        expansionCriteria: {},
        showTopNode: provider.showTopNode,
        startFreshNavigation: false,
        transientRequestPref: {}
    } );
};

/**
  * Register ACE active context
  *
  * @param {string} contextKey - context key
  */
let _registerAceActiveContext = function( contextKey ) {
    appCtxSvc.ctx[ contextKey ].childPanelId = 'AddChildElement';
    appCtxSvc.ctx[ contextKey ].siblingPanelId = 'AddSiblingElement';
    appCtxSvc.registerCtx( 'aceActiveContext', {
        key: contextKey,
        context: appCtxSvc.ctx[contextKey]
    } );
};


/**
  * Update reqPref
  *
  * @param {object} eventData - Event data
  * @param {object} provider - provider/subPanelContext object
  */

let updateReqPref = function( eventData, provider ) {
    let ctx = appCtxSvc.getCtx( eventData.contextKey );
    let oldReqPref = ctx.requestPref ? ctx.requestPref : {};
    oldReqPref.openWPMode = provider.openMode;
    appCtxSvc.updatePartialCtx( eventData.contextKey + '.requestPref', oldReqPref );
};

/**
  * Register occDataLoadedEvent event
  *
  * @param {object} data sen BOM Panel view model
  */
let _registerOccDataLoadedEvent = function( data ) {
    let senBomPanelOccDataLoadedSubDef = eventBus.subscribe( 'occDataLoadedEvent', function( eventData ) {
        if ( eventData && eventData.contextKey && eventData.contextKey === data.contextKey ) {
            updateReqPref( eventData, data.provider );
        }
    } );
    _eventSubDefs.push( senBomPanelOccDataLoadedSubDef );
};


/**
  * Register update event
  *
  * @param {object} data Se BOM Panel view model
  */
let _registerUpdateEvent = function( data, subPanelContext ) {
    let updateSubDef = eventBus.subscribe( 'appCtx.update', function( eventData ) {
        if ( eventData.name === data.contextKey && eventData.target === 'currentState' ) {
            occMgmtSubLocService.updateUrlFromCurrentState( eventData, subPanelContext );
        }
    } );
    _eventSubDefs.push( updateSubDef );
};

/**
  * Register event listerners
  *
  * @param {object} data sen BOM Panel view model
  */
let _registerEventListeners = function( data, subPanelContext ) {
    _registerOccDataLoadedEvent( data );
    _registerUpdateEvent( data, subPanelContext );
};

/**
  * Initialize senBomPanel
  *
  * @param {object} subPanelContext - panel data
  * @param {object} data - Declarative data
  */
export let initializeSenBomPanel = function( subPanelContext, data ) {
    let cloneData = data;
    let provider = subPanelContext.provider;
    
    let contextKey = provider.viewKey;
    _registerContext( provider );
    _registerAceActiveContext( contextKey );
    occMgmtServiceManager.initializeOccMgmtServices( contextKey, false );
    _registerEventListeners( cloneData, subPanelContext );
    occMgmtSubLocService.updateState( contextKey, subPanelContext );
    return {
        provider: provider,
        contextKey: contextKey
    };
};

/**
  * Unregister split view mode
  */
let unRegisterSplitViewMode = function() {
    let senViewKeys = appCtxSvc.getCtx( 'splitView.viewKeys' );
    _.forEach( senViewKeys, function( senViewKey ) {
        appCtxSvc.unRegisterCtx( senViewKey );
    } );
    appCtxSvc.unRegisterCtx( 'splitView' );
};

/**
  * Cleanup registration done by senBomPanel
  */
export let cleanupSenBomPanel = function() {
    unRegisterSplitViewMode();
    appCtxSvc.updatePartialCtx( 'hideRightWall', false );
    appCtxSvc.updatePartialCtx( 'sentaskPageContext.subTaskName', '' );
    appCtxSvc.updatePartialCtx( 'skipAutoBookmark', false );
    _.forEach( _eventSubDefs, function( eventSubDef ) {
        eventBus.unsubscribe( eventSubDef );
    } );
    _eventSubDefs.length = 0;
};

export default exports = {
    initializeSenBomPanel,
    cleanupSenBomPanel
};

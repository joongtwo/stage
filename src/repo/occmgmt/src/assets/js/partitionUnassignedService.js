// Copyright (c) 2022 Siemens

/**
 * A service that manages the unassigned command specific service.<br>
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/partitionUnassignedService
 */
import occmgmtSplitViewUpdateService from 'js/occmgmtSplitViewUpdateService';
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';

var exports = {};
var _addElementListener = null;
var _removeElementListener = null;

let refreshInactiveView = function() {
    let occContext2 = appCtxSvc.getCtx( 'occmgmtContext2' );
    if( occContext2 ) {
        var isUnassignedMode = occContext2.currentState.pci_uid.includes( 'UM:1' );
        if ( isUnassignedMode ) {
            var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();
            if ( inactiveView ) {
                eventBus.publish( 'acePwa.reset', { retainTreeExpansionStates: true, viewToReset: inactiveView, silentReload: true } );
            }
        }
    }
};

export let initializeUnassignedService = function() {
    if( !_addElementListener ) {
        _addElementListener = eventBus.subscribe( 'addElement.elementsAdded', function( event ) {
            refreshInactiveView();
        } );
    }

    if( !_removeElementListener ) {
        _removeElementListener = eventBus.subscribe( 'ace.elementsRemoved', function( event ) {
            refreshInactiveView();
        } );
    }

    eventBus.subscribe( 'appCtx.register', function( eventData ) {
        if ( eventData.name === 'splitView' && appCtxSvc.ctx.occmgmtContext2 !== undefined ) {
            let occContext2 = appCtxSvc.getCtx( 'occmgmtContext2' );
            var isUnassignedMode = occContext2.currentState.pci_uid.includes( 'UM:1' );
            if ( ( _removeElementListener || _addElementListener ) && isUnassignedMode ) {
                appCtxSvc.updatePartialCtx( 'requestPref.unassignedMode', [ 'false' ] );
                eventBus.unsubscribe( _removeElementListener );
                eventBus.unsubscribe( _addElementListener );
                _removeElementListener = null;
                _addElementListener = null;
            }
        }
    } );
};

export default exports = {
    initializeUnassignedService
};

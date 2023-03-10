// Copyright (c) 2022 Siemens

/**
 * @module js/changeService
 */
import appCtxSvc from 'js/appCtxService';
import occmgmtUtils from 'js/occmgmtUtils';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import cdmSvc from 'soa/kernel/clientDataModel';

var exports = {};

var _aceElementRemovedEvent = null;

var _aceElementDragDropEvent = null;

/**
  * Related the children based on input element uid.
  *
  * @param {String} parentUid Parent element Uid that need to be reloaded
  */
var _reloadParent = function( parentUid ) {
    if( !parentUid ) {
        return;
    }
    let contextKey = appCtxSvc.ctx.aceActiveContext.key;
    eventBus.publish( 'aceLoadAndSelectProvidedObjectInTree', {
        objectsToSelect: [ cdmSvc.getObject( parentUid ) ],
        viewToReact: contextKey,
        nodeToExpandAfterFocus: parentUid
    } );
};


/**
  * Initializes Change service.
  */
export let initialize = function() {
    if( _aceElementRemovedEvent === null ) {
        _aceElementRemovedEvent = eventBus.subscribe( 'ace.elementsRemoved', function( eventData ) {
            var operationName = '';
            if( eventData.operationName ) {
                operationName = eventData.operationName;
            }

            if( occmgmtUtils.isTreeView() && operationName === 'removeElement' && appCtxSvc.ctx.occmgmtContext.isChangeEnabled ) {
                var parentUid = occmgmtUtils.getParentUid( appCtxSvc.ctx.selected );
                _reloadParent( parentUid );
            }
        } );
    }
    if( _aceElementDragDropEvent === null ) {
        _aceElementDragDropEvent = eventBus.subscribe( 'ace.elementsMoved', function() {
            if( occmgmtUtils.isTreeView() && appCtxSvc.ctx.occmgmtContext.isChangeEnabled
                 && appCtxSvc.ctx.aceActiveContext.context.addElementInput
                 && appCtxSvc.ctx.aceActiveContext.context.addElementInput.moveParentElementUids ) {
                var moveParentElementUids = appCtxSvc.ctx.aceActiveContext.context.addElementInput.moveParentElementUids;
                _.forEach( moveParentElementUids, function( parentUid ) {
                    _reloadParent( parentUid );
                } );
            }
        } );
    }
};

export let destroy = function() {
    if( _aceElementRemovedEvent ) {
        eventBus.unsubscribe( _aceElementRemovedEvent );
        _aceElementRemovedEvent = null;
    }

    if( _aceElementDragDropEvent ) {
        eventBus.unsubscribe( _aceElementDragDropEvent );
        _aceElementDragDropEvent = null;
    }
};

/**
  * Show BOM Change Configuration service utility
  * @param {appCtxService} appCtxSvc - Service to use
  * @param {occmgmtUtils} occmgmtUtils - Service to use
  * @returns {object} - object
  */

export default exports = {
    initialize,
    destroy
};

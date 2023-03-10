// Copyright (c) 2022 Siemens

/**
 * This is the command handler for show child occurrences command which is contributed to cell list.
 *
 * @module js/showChildOccsCommandHandler
 */
import contextStateMgmtService from 'js/contextStateMgmtService';
import cdmSvc from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import popupService from 'js/popupService';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};

export let getContextKeyFromParentScope = function( parentScope ) {
    return contextStateMgmtService.getContextKeyFromParentScope( parentScope );
};

export let showChildOccurences = function( vmo, contextKey ) {
    //In Tree View , "Show Children" can be executed from Breadcrumb. It should behave like Node expansion in that case.
    if( occmgmtUtils.isTreeView() ) {
        eventBus.publish( 'aceLoadAndSelectProvidedObjectInTree', {
            objectsToSelect: [ cdmSvc.getObject( vmo.uid ) ],
            viewToReact: contextKey,
            nodeToExpandAfterFocus: vmo.uid
        } );
    } else {
        var newState = {};
        newState.o_uid = vmo.uid;
        newState.c_uid = vmo.uid;

        contextStateMgmtService.updateContextState( contextKey, newState, true );
    }

    popupService.hide();
};

export default exports = {
    getContextKeyFromParentScope,
    showChildOccurences
};

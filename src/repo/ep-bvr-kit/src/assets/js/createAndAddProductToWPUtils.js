// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* global
 */

/**
 * @module js/createAndAddProductToWPUtils
 */
import awPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';
import epInitializationService from 'js/epInitializationService';
import popupService from 'js/popupService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import appCtxService from 'js/appCtxService';
import epContextService from 'js/epContextService';
let _popupRef = null;
let _saveEvent = null;

/**
 * show create Product popup with specified values,options and binding context
 *@param   {String} declView - declView, define your view in declView
 *@param   {Object} locals - title of the popup
 *@param   {Object} options - popup options
 *@param   {Object} subPanelContext - Optional. Used when some information needs to be passed on from parent context.
 *@returns {Promise} promise with the created popupRef element
 */
function showCreateProductPopup( { declView, locals, options, subPanelContext } ) {
    _saveEvent = eventBus.subscribe( 'ep.saveEvents', function( eventData ) {
        _reset();
        const ccObjectUid = appCtxService.getCtx( 'epTaskPageContext.collaborationContext' ).uid;
        const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.CC, epLoadConstants.HEADER ], ccObjectUid );
        return epLoadService.loadObject( loadTypeInput ).then( ( response ) => {
            epInitializationService.updateTaskPageContext( response );
            for( let object in  response.loadedObjectsMap ) {
                epContextService.setPageContext( object,  response.loadedObjectsMap[ object ][ 0 ] );
            }
            epInitializationService.updateConfigurationFlagInfo( response );
            eventBus.publish( 'ep.addRemoveEvents', { addedSaveEvent: 'objectToAdd' } );
        } );
    } );

    eventBus.subscribe( 'EpCreateObjectPopupCancel', function() {
        _reset();
    } );

    let deferred = awPromiseService.instance.defer();
    popupService.show( { declView, locals, options, subPanelContext } ).then( function( popupRef ) {
        _popupRef = popupRef;
        deferred.resolve( popupRef );
    } );

    return deferred.promise;
}

/**
 * resets the values
 */
function _reset() {
    if( _saveEvent ) {
        eventBus.unsubscribe( _saveEvent );
        _saveEvent = null;
    }
    if( _popupRef ) {
        popupService.hide( _popupRef );
        _popupRef = null;
    }
}

export default {
    showCreateProductPopup
};

// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service large popups
 *
 * @module js/mfeLargePopupUtils
 */
import popupService from 'js/popupService';
import popupUtils from 'js/popupUtils';
import eventBus from 'js/eventBus';



const POPUP_MARGIN = 40;
const LARGE_POPUP_CSS = 'aw-mfe-largePopup';
let largePopupRef;
let subscriptions = [];

/**
 * showLargePopup
 *
 * @param { Object } popupParams popup params from view model
 * @returns {Promise} popup promise
 */
export function showLargePopup( popupParams ) {
    if( !popupParams.options ) {
        popupParams.options = {};
    }
    popupParams.options.draggable = false;
    popupParams.options.ignoreLimit = true;
    if( popupParams.options.className ) {
        popupParams.options.className = `${LARGE_POPUP_CSS}  ${popupParams.options.className}`;
    } else{
        popupParams.options.className = LARGE_POPUP_CSS;
    }

    return popupService.show( popupParams ).then( popupRef => {
        largePopupRef = popupRef;
        subscriptions.push( eventBus.subscribe( 'aw.windowResize', resizePopup ) );
        resizePopup().then( () => popupRef );
    } );
}

/**
 * resize popup after window resize
 *
 * @returns {Promise} popup promise
 */
function resizePopup() {
    if( largePopupRef ) {
        popupUtils.processOptions( largePopupRef.panelEl, {
            containerWidth: window.innerWidth - POPUP_MARGIN,
            containerHeight: window.innerHeight - POPUP_MARGIN
        } );
        return popupService.update( largePopupRef.panelEl );
    }
}

/**
 * hideLargePopup
 */
function hideLargePopup() {
    if( largePopupRef ) {
        popupService.hide( largePopupRef.panelEl ).then( () => {
            largePopupRef = null;
            for( const s of subscriptions ) {
                eventBus.unsubscribe( s );
            }
            subscriptions = [];
        } );
    }
}

// eslint-disable-next-line no-unused-vars
let exports;
export default exports = {
    showLargePopup,
    hideLargePopup
};


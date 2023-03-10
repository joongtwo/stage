// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import notyService from 'js/NotyModule';
import soaService from 'soa/kernel/soaService';
import _appCtxService from 'js/appCtxService';
import commandService from 'js/command.service';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import mfeHostingRequestsCache from 'js/services/mfeHostingRequestsCache';

/**
 *
 * @module js/services/mfeHostingMessagingService
 */

let galssPanelElements = {};
let messageHandlers = {};
let getCustomeHostedIframeID = null;
let mfeSyncCtxPath = null;
let mfeSoaRequestsCahceWhiteList = new Object();
let mfeResetSoaRequestsList = new Object();


/**
 * getHostedWindow according to iFrame id
 *
 * @param {* } sourceWindow sourceWindow id
 * @returns {Element} the hosted window
 */
function getHostedWindow( sourceWindow ) {
    const sourceWin = document.getElementById( getCustomeHostedIframeID( sourceWindow ) );
    if( sourceWin ) {
        return sourceWin.contentWindow;
    }
    return null;
}

/**
 * @returns {String} default hosted window id
 */
function getDefaultHostedIframeID() {
    return 'hostedIframe';
}

/**
 * Initialize hosting messaging
 *
 * @param {Function} getCustomeHostedIframeIDFunction function to return requested window ID
 * @param {String} mfeCtxPath ctx path to sync
 */
export function initHostingMessaging( getCustomeHostedIframeIDFunction = getDefaultHostedIframeID, mfeCtxPath ) {
    messageHandlers.mfeAddPopupGlassPanel = [ addGlassPanelToGlobalNavigation ];
    messageHandlers.mfeRemovePopupGlassPanel = [ removeGlassPanel ];
    messageHandlers.mfeNotyMessage = [ handleNotyMessage ];
    messageHandlers.soa = [ handleSoaMessage ];
    messageHandlers.mfeSyncCtx = [ handleSyncCtxMessage ];
    messageHandlers.mfeExecuteCommand = [ handleExecuteCommand ];
    messageHandlers.mfePublishEvent = [ handlePublishEvent ];
    //listen to message form hosted page
    window.addEventListener( 'message', handleMessage, false );
    //this is done in order to enable to hide popups in hosting
    //in 6.1 react based this event listener is causing the modal popups to close
    //window.addEventListener( 'blur', handleBlur );
    window.addEventListener( 'focus', handleFocus );

    getCustomeHostedIframeID = getCustomeHostedIframeIDFunction;
    mfeSyncCtxPath = mfeCtxPath;
}

/**
 * Handles soa request from hosted page.
 * @param {String} serviceName - test
 * @param { String } sourceWindow - test
 */
const handleSoaMessage = async function( { serviceName, operationName, jsonData, cacheId }, sourceWindow ) {
    const soaOptions = {
        ignoreHost: true,
        raw: true
    };
    const cahceRequestKey = mfeHostingRequestsCache.createKeyForSoaCache( serviceName, operationName );
    const filter = mfeSoaRequestsCahceWhiteList[cahceRequestKey];
    let includeResponseInCache = false;
    let soaResponse;

    if ( mfeResetSoaRequestsList[cahceRequestKey] ) {
        mfeHostingRequestsCache.clearResponse( mfeResetSoaRequestsList[cahceRequestKey] );
    }
    if ( filter ) {
        if ( !filter.filterFunc || filter.filterFunc( jsonData ) ) {
            soaResponse = mfeHostingRequestsCache.getResponse( cahceRequestKey, jsonData );
            includeResponseInCache = true;
        }
    }

    if ( !soaResponse ) {
        soaResponse = await soaService.postUnchecked(
            serviceName,
            operationName,
            jsonData.body,
            jsonData.header.policy,
            soaOptions
        );
    }
    if ( includeResponseInCache ) {
        mfeHostingRequestsCache.setResponse( cahceRequestKey, jsonData, soaResponse );
    }


    const hostMessage = {
        ...soaResponse,
        cacheId: cacheId,
        type: 'soa'
    };

    const clonedHostMessage = _.cloneDeep( hostMessage );
    const hostedWindow = getHostedWindow( sourceWindow );
    if( hostedWindow !== null ) {
        hostedWindow.postMessage( clonedHostMessage, '*' );
        if( mfeSyncCtxPath ) {
            postMessageToHostedWindow( 'mfeSyncCtx', mfeSyncCtxPath, _appCtxService.getCtx( mfeSyncCtxPath ) );
        }
    }
};

/**
 *  handles request from hosted page.
 * @param {object} e - event sent from hosted
 **/
function handleMessage( e ) {
    // Attempting fix for LCS-386077
    if( e.origin === window.location.origin ) {
        let handlers = messageHandlers[ e.data.type ];
        if( handlers ) {
            handlers.forEach( function( handler ) {
                handler( e.data, e.source );
            } );
        }
    }
}

// /**
//  *  we need this to enable close of popups
//  *  in case we move to hosted iframe
//  *
//  **/
// function handleBlur() {
//     document.querySelector( 'body' ).click();
// }

/**
 *  we need this to enable close of popups
 *  in case we move to hosting from iframe
 *
 **/
function handleFocus() {
    const sourceWin = document.getElementById( getDefaultHostedIframeID() );
    if( sourceWin ) {
        const hostedWindow = sourceWin.contentWindow;

        if( hostedWindow !== null ) {
            hostedWindow.postMessage( { type: 'clickOnHosting' }, '*' );
        }
    }
}
/**
 *  handles request from hosted page.
 *  any notyMessaage from hosted are being
 *  sent to hosting .
 *  in case of warning we can have buttins
 *  so we need to send back the user action
 *
 * @param {object} data - event data sent from hosted
 * @param { object } sourceWindow - the source window
 **/
function handleNotyMessage( data, sourceWindow ) {
    //if we getting buttons we need to send back the user action
    if( data.buttonsArr ) {
        data.buttonsArr.forEach( ( btn ) => {
            btn.onClick = function( event ) {
                event.close();
                let targetWindow = getHostedWindow( sourceWindow );
                targetWindow.postMessage( { type: 'mfeNotyMessage.' + data.method, btnIndex: btn.btnIndex }, '*' );
            };
        } );
        notyService[ data.method ]( data.message.message || data.message, data.buttonsArr, data.messageData );
    } else {
        //simply call noty message without special handleing
        notyService[ data.method ]( data.message.message || data.message, data.messageData );
    }
}

/**
 * handleSyncCtxMessage
 *
 * @param {*} data  ctx data
 */
function handleSyncCtxMessage( data ) {
    if( data ) {
        _appCtxService.updatePartialCtx( data.key, data.value );
    }
}

/**
 * handleExecuteCommand
 *
 * @param {Object} data event data
 */
function handleExecuteCommand( data ) {
    if( data ) {
        commandService.executeCommand( data.key, data.value );
    }
}

/**
 * Publish event
 *
 * @param {Object} data event data
 */
function handlePublishEvent( data ) {
    if( data ) {
        eventBus.publish( data.key, data.value );
    }
}

/**
 * glass panel style set width and height
 *
 * @param {string} height - glass panel heigth
 * @param {string} width - glass panel width
 * @param {object} element  - ui object to set style
 * @param {string} backgroundColor - glass panel color from hosted
 * @param {string} left - glass panel left position
 **/
function setGlassPanelStyle( height, width, element, backgroundColor, left ) {
    element.setAttribute( 'style', 'position: absolute; visibility: visible; display: block; top: 0; left: ' + left + '; width: ' +
        width + '; height: ' + height + '; z-index: 1001;opacity: 0.3; color:red; border: 1px solid blue;border: none;background-color:' + backgroundColor );
}

/**
 *  handle request from hosted to remove glass panel
 *
 **/
function removeGlassPanel() {
    document.getElementById( 'main-view' ).classList.remove( 'aw-mfe-hostingPopupPanelGlass' );

    let glasPanelsAtrr = Object.getOwnPropertyNames( galssPanelElements );
    glasPanelsAtrr.forEach( function( attr ) {
        let glassPanel = galssPanelElements[ attr ];
        if( glassPanel.parentNode ) {
            glassPanel.parentNode.removeChild( glassPanel );
        }
    } );
    galssPanelElements = {};
}

/**
 *  we saving the elements with glass panel use it later to remove
 * @param {string} key - the key of the dom elemnt
 * @param {object} element - the dom elemnt
 **/
function addGlassPanelToMap( key, element ) {
    galssPanelElements[ key ] = element;
}

/**
 *  return the dom element from map
 * @param {string} key - the key of the dom elemnt
 * @returns {object} - the dom element
 **/
function getGlassPanelForKey( key ) {
    return galssPanelElements[ key ];
}

/**
 *  handles request from hosted page.
 *  to add glass panel to global navigation
 *  right side panel
 *
 * @param {object} data - event data sent from hosted
 **/
function addGlassPanelToGlobalNavigation( data ) {
    if( !getGlassPanelForKey( 'globalNavigation' ) ) {
        let globalNavigationElement = document.querySelector( 'aw-include[name=\'commonGlobalNavigation\']' );
        //find out global navigation height
        const globalNavigationWidth = globalNavigationElement.offsetWidth + 'px';

        let element = document.createElement( 'div' );
        setGlassPanelStyle( '100%', globalNavigationWidth, element, data.backgroundColor, 0 );
        addGlassPanelToMap( 'globalNavigation', element );
        globalNavigationElement.appendChild( element );
        document.getElementById( 'main-view' ).classList.add( 'aw-mfe-hostingPopupPanelGlass' );
    }
}

/**
 *  remove all event listenrs typicly in the end of lifecycle
 *
 **/
function removeEventListners() {
    window.removeEventListener( 'message', handleMessage );
    //window.removeEventListener( 'blur', handleBlur );
    window.removeEventListener( 'focus', handleFocus );
}

/**
 * Post message to hosted application
 *
 * @param {String} type: type of message
 * @param {*} key key
 * @param {*} value value to send
 * */
export function postMessageToHostedWindow( type, key, value ) {
    const hostedWindow = getHostedWindow();
    if( hostedWindow !== null ) {
        hostedWindow.postMessage( {
            type: type,
            key: key,
            value: value
        }, '*' );
    }
}
/**
 *
 * @param {String} serviceName - soa service name
 * @param {String} operationName - soa operation name
 * @param {function} filterFunc - optional function to check request jason input,
 *                       return true is valid else not valid json.
 *                       if the fuction is null we assume all input are ok
 * @param {String} resetServiceName - soa service name for reset service
 * @param {String} resetOperationName - soa operation name for reset service
 */
export function addWhiteListSoaRequests( serviceName, operationName, filterFunc, resetServiceName, resetOperationName ) {
    const serviceCache = mfeHostingRequestsCache.createKeyForSoaCache( serviceName, operationName );
    mfeSoaRequestsCahceWhiteList[serviceCache] = { filterFunc };
    if ( resetServiceName && resetOperationName ) {
        mfeResetSoaRequestsList[mfeHostingRequestsCache.createKeyForSoaCache( resetServiceName, resetOperationName )] = serviceCache;
    }
}


// eslint-disable-next-line no-unused-vars
let exports = {};
export default exports = {
    initHostingMessaging,
    setGlassPanelStyle,
    addGlassPanelToGlobalNavigation,
    addGlassPanelToMap,
    getGlassPanelForKey,
    messageHandlers,
    removeEventListners,
    getDefaultHostedIframeID,
    postMessageToHostedWindow,
    addWhiteListSoaRequests
};

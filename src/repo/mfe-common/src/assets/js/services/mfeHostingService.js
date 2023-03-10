/* eslint-disable no-console */
// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/* global
INF_SERVICES_CORE_2014_02 SOL_SERVICES_CLIPBOARD_2014_02 INF_INTEROP INF_SERVICES_CORE_2014_07 INF_SERVICES SOL_SERVICES_ROUTER_2020_01 SOL_SERVICES_SELECTION_2014_07 INF INF_SERVICES_SOA_2014_02 */

/**
 * This module contains a service that handles hosting.
 * call only to initHosting and at the end destroyHosing
 *
 * @module js/services/mfeHostingService
 */

import browserUtils from 'js/browserUtils';
// import 'lib/splmBrowserInterOpMin';
import eventBus from 'js/eventBus';
import soaService from 'soa/kernel/soaService';
import logger from 'js/logger';
import ClipboardService from 'js/clipboardService';

let _clipboardService;
let _clipboardConfigured;
let _currentClipboardUids;
let _remoteClipboardProxy;
let _src;
let _hostControlInstance;
/**
 * Setup the configuration
 *
 * @function handleHostConfigurationRequest
 * @returns {Object} Configuration settings object
 */
const handleHostConfigurationRequest = function() {
    return new INF_SERVICES_CORE_2014_07.HostConfigurationResponseMsg( [
        new INF_SERVICES.Pair( 'AllowChangeLocation', 'false' ),
        new INF_SERVICES.Pair( 'AllowGoHome', 'true' ),
        new INF_SERVICES.Pair( 'AllowOpenInNewLocation', 'true' ),
        new INF_SERVICES.Pair( 'AllowThemeChange', 'true' ),
        new INF_SERVICES.Pair( 'AllowUserSessionChange', 'false' ),
        new INF_SERVICES.Pair( 'AllowGroupRoleChange', 'false' ),
        new INF_SERVICES.Pair( 'HostType', 'AW' ),
        new INF_SERVICES.Pair( 'HasFullScreenSupport', 'true' ),
        new INF_SERVICES.Pair( 'IS_VIEWER_SUPPORTED', 'true' ),
        new INF_SERVICES.Pair( 'ShowSiemensLogo', 'true' ),
        new INF_SERVICES.Pair( 'SendToCommandDisplayName', 'Send to Test' ),
        new INF_SERVICES.Pair( 'HostSupportsMultipleSelection', 'true' ),
        new INF_SERVICES.Pair( 'Use2014_07_SOA', 'false' ),
        new INF_SERVICES.Pair( 'Use2015_10_SOA', 'true' ),
        new INF_SERVICES.Pair( 'UseSoaPostMessage', 'true' )
    ] );
};

/**
 * This class extends IAsyncSoaJsonMessageHandler to setup SOA tunneling
 *
 * @class MyAsyncSoaJsonMessageHandler
 */
class MyAsyncSoaJsonMessageHandler extends INF_SERVICES_SOA_2014_02.IAsyncSoaJsonMessageHandler {
    constructor( hostControlInstance ) {
        super();
        this.handle = async function( requestMsg ) {
            if( !this.soaJsonRequestProxy ) {
                let svcDesc = JSON.parse( requestMsg.ReplyServiceDescriptor );

                if( svcDesc.FQN !== INF.Constants.CS_SOA_JSON_REQUEST_SVC || svcDesc.SvcVersion !== INF.Constants.VERSION_2014_02 ) {
                    logger.error( `Unsupported ReplyService: ${requestMsg.ReplyServiceDescriptor}` );
                } else {
                    this.soaJsonRequestProxy = new INF_SERVICES_SOA_2014_02.SoaJsonRequestProxy( _hostControlInstance );
                }
            }

            let { body, header } = JSON.parse( requestMsg.Message );

            const options = {
                ignoreHost: true,
                raw: true
            };

            const response = await soaService.postUnchecked(
                requestMsg.ServiceName,
                requestMsg.OperationName,
                body,
                header.policy,
                options
            );

            if( this.soaJsonRequestProxy ) {
                const responseMsg = new INF_SERVICES_SOA_2014_02.SoaJsonResponseMessage( requestMsg.Version,
                    requestMsg.CacheId, response, null );
                this.soaJsonRequestProxy.sendResponse( responseMsg );
            } else {
                return null;
            }
        };
    }
}
/**
 * This class extends IRemoteClipboardChangeListener to setup remote clipboard handling
 *
 * @class MyRemoteClipboardChangeHandler
 */
class MyRemoteClipboardChangeHandler extends SOL_SERVICES_CLIPBOARD_2014_02.IRemoteClipboardChangeListener {
    constructor() {
        super();
        this.remoteClipboardChange = function( msg ) {
            if( msg.Contents ) {
                _clipboardService.setContents( msg.Contents );
            }
        };
    }
}

/**
 * Handle changes to the client route
 *
 * @function handleRouterChanges
 *
 * @param {Object} routerMsg - settings object
 */
const handleRoute = function( routerMsg ) {
    if( !routerMsg.FromState.abstract ) {
        eventBus.publish( 'navigateToObjectFromHostedContent', { routerMsg: routerMsg } );
    }
};

/**
 * Handle selection changes from AW4.1
 *
 * @function selectionChange
 *
 * @param {INF_BASE_2014_02.SelectionChangeEvent} selChangeEvent - Event that holds the details of the
 *            selection change announcement.
 */
const selectionChange = function( selChangeEvent ) {
    let selectedUIDs = selChangeEvent.selection;

    // Set the contents of the current 4.3 clipboard in 4.1 on first selection event as we know hosting is started here
    if( !_clipboardConfigured && _currentClipboardUids.length > 0 && _currentClipboardUids[ 0 ].ObjId !== undefined ) {
        _clipboardConfigured = true;
        _remoteClipboardProxy.clearRemoteClipboard();
        _remoteClipboardProxy.addToRemoteClipboard( _currentClipboardUids );
    }

    eventBus.publish( 'hosting.changeSelection', {
        operation: 'replace',
        selected: selectedUIDs
    } );
};

/**
 *
 * @function registerServices
 * @param {Object} hostManager - The host manager for the registered services
 */
const registerServices = function( hostManager ) {
    let hostConfig = new INF_SERVICES_CORE_2014_07.HostConfigurationSvc( { handleHostConfigurationRequest } );
    hostManager.registerService( hostConfig );

    let asyncSoaJsonMessageSvc = new INF_SERVICES_SOA_2014_02.AsyncSoaJsonMessageSvc( new MyAsyncSoaJsonMessageHandler( hostManager.getHostControl() ) );
    hostManager.registerService( asyncSoaJsonMessageSvc );

    let remoteClipboardSvc = new SOL_SERVICES_CLIPBOARD_2014_02.RemoteClipboardSvc();
    remoteClipboardSvc.addListener( new MyRemoteClipboardChangeHandler() );
    hostManager.registerService( remoteClipboardSvc );

    let router = new SOL_SERVICES_ROUTER_2020_01.HostRouterSvc( { handleRoute } );
    hostManager.registerService( router );

    let selectionProviderSvc = new SOL_SERVICES_SELECTION_2014_07.SelectionProviderSvc();
    selectionProviderSvc.addListener( { selectionChange } );
    hostManager.registerService( selectionProviderSvc );

    _remoteClipboardProxy = new SOL_SERVICES_CLIPBOARD_2014_02.RemoteClipboardProxy( hostManager.getHostControl() );
};

/**
 * Initialize hosting
 *
 * @function _initializeHosting
 * @param {String} location - AW location
 * @param {String} prefix - AW url state
 * @param {String} params - state params object uid, mcn id
 */
const initializeHosting = ( location, prefix, params, iframeId ) => {
    let iFrame = document.getElementById( iframeId );

    window.splmHostPing = INF.splmHostPing; // eslint-disable-line no-undef
    window.splmHost_WebSideServiceListUpdate = INF.splmHost_WebSideServiceListUpdate; // eslint-disable-line no-undef
    window.splmHostMethod = INF.splmHostMethod; // eslint-disable-line no-undef
    window.splmHostEvent = INF.splmHostEvent; // eslint-disable-line no-undef
    window.splmHost_WebSideStartHandShake = INF.splmHost_WebSideStartHandShake; // eslint-disable-line no-undef

    let hostManager = INF_INTEROP.getHostManagerInstance();
    if( hostManager ) {
        _hostControlInstance = hostManager.initializeHostIntegration( iFrame, registerServices );
    }

    initSrc( location, prefix, params );
};

/**
 *
 *
 * @function Initialize src of iframe
 * @param {String} location - AW location
 * @param {String} prefix - AW url state
 * @param {String} params - model object uid, MCN id if object opened through MCN Object
 */
const initSrc = ( location, prefix, params ) => {
    _src = browserUtils.getBaseURL() + location + '/?ah=true&/#' + prefix;

    let paramString = '';
    for( let key in params ) {
        if( params.hasOwnProperty( key ) && params[ key ] ) {
            paramString = paramString.concat( `&${key}=${params[ key ]}` );
        }
    }
    _src = _src.concat( paramString.replace( '&', '?' ) );
    return _src;
};

/**
 * This function calculate and set up the hosting service
 *
 * @param {string} location - application location
 * @param {*} prefix - url prefix (sublocation info)
 * @param {*} params - state params: uid, mcn
 *
 * @return {Object}
 * {string} src - of the ifarme
 * {Object} hostControlInstance - controller for hosting
 */
export const initHosting = function( location, prefix, params, iframeId = 'hostedIframe' ) {
    _clipboardService = ClipboardService.instance;

    _clipboardConfigured = false;
    _currentClipboardUids = _clipboardService.getContents().map( obj => new INF_SERVICES_CORE_2014_02.InteropObjectRef( obj.uid, '', '' ) );

    initializeHosting( location, prefix, params, iframeId );

    return {
        src: _src,
        hostControlInstance: _hostControlInstance
    };
};

/**
 * destroy hosting setup
 */
export const destroyHosting = function() {
    window.splmHostPing = null;
    window.splmHost_WebSideServiceListUpdate = null;
    window.splmHostMethod = null;
    window.splmHostEvent = null;
    window.splmHost_WebSideStartHandShake = null;
    _clipboardService = null;
    _clipboardConfigured = null;
    _currentClipboardUids = null;
    _remoteClipboardProxy = null;
    _src = null;
    _hostControlInstance = null;
    INF_INTEROP.hostManager = null;
};

export default {
    initHosting,
    destroyHosting,
    initSrc
};

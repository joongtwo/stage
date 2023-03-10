// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/openInVisualizationProductContextInfoProvider
 */
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import selectionSvc from 'js/selection.service';

var productContextInfoProviderFn = undefined;
var exports = {};

/**
 * Set function on current service that would return the intended product context for VIS.
 *
 * @param { Function } registerFuntion JS function that returns an object containing "productContextInfo"
 */
export let registerProductContextToLaunchVis = function( registerFuntion ) {
    if( registerFuntion && typeof registerFuntion === 'function' ) {
        productContextInfoProviderFn = registerFuntion;
    }
};

/**
 * Reset current service function attribute to 'null'
 */
export let resetProductContextInfo = function() {
    if( productContextInfoProviderFn ) {
        productContextInfoProviderFn = undefined;
    }
};

/**
 * Gets product launch info
 *  @return {Promise} Resolves to ProductLaunchInfo.
 */
export let getProductLaunchInfo = function() {
    var deferred = AwPromiseService.instance.defer();

    if( productContextInfoProviderFn !== undefined ) {
        productContextInfoProviderFn().then( function( productLaunchInfo ) {
            deferred.resolve( productLaunchInfo );
        } );
    } else {
        // User did not open assembly in Viewer.
        let occmgmtActiveContext = appCtxService.getCtx( 'aceActiveContext' );
        let occmgmtContextKey = occmgmtActiveContext && occmgmtActiveContext.key ? occmgmtActiveContext.key : 'occmgmtContext';
        let selectedObjects = selectionSvc.getSelection().selected;
        let productLaunchInfo = [ {
            productContextInfo: appCtxService.getCtx( occmgmtContextKey ).productContextInfo,
            selections: selectedObjects
        } ];
        deferred.resolve( productLaunchInfo );
    }
    return deferred.promise;
};

export default exports = {
    registerProductContextToLaunchVis,
    resetProductContextInfo,
    getProductLaunchInfo
};

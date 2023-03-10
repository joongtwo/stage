// Copyright (c) 2022 Siemens

/**
 * Module for Generate Offline Package Panel
 *
 * @module js/Ewi0Offline
 */
import appCtxSvc from 'js/appCtxService';
import $ from 'jquery';

/**
 * Define public API
 */
var exports = {};

/**
 * Generate the offline package
 *
 * @param {Object} data - the data object in scope
 */
export let generatePackage = function( data ) {
    var packageName = data.packageName.dbValue;
    var recordCurrentStep = data.recordingMode.dbValue === true ? 1 : 0;
    var enableVis = data.includeVis.dbValue === true ? 1 : 0;
    var password = data.password.dbValue;
    var visHost = enableVis === 1 ? data.visHost.dbValue : '';

    var user = appCtxSvc.getCtx( 'user' );
    var userName = user.props.user_name.dbValue;

    var currentUrl = window.location.href;

    var userSession = appCtxSvc.getCtx( 'userSession' );
    var locale = userSession.props.fnd0locale.dbValue;

    var baseUrl = appCtxSvc.ctx.preferences.EWI_OfflineServletAddress;
    baseUrl = baseUrl.endsWith( '/' ) ? baseUrl : baseUrl + '/';

    var params = {
        username: userName,
        password: password,
        numOfThreads: 2,
        url: currentUrl,
        recordOneStep: recordCurrentStep,
        locale: locale,
        enableVis: enableVis,
        visHost: visHost,
        customName: packageName
    };

    var urlParams = $.param( params );
    window.open( baseUrl + urlParams, '_blank', 'fullscreen=yes' );
};

/**
 * Set the setIncludeVis field
 *
 * @param {boolean} includeVis - is include 3D visualization selected
 * @param {Object} visHost - the visHost field
 */
export let setIncludeVis = function( includeVis, visHost ) {
    visHost.isRequired = includeVis;
};

/**
 * A glue code to support Ewi0Offline
 *
 * @param {Object} appCtxSvc - appCtxService
 *
 * @return {Object} - Service instance
 *
 * @member Ewi0Offline
 */

export default exports = {
    generatePackage,
    setIncludeVis
};

// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import defaultLocationSvc from 'js/defaultLocationService';
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';

/**
 * mfeDeployedTemplateManager
 *
 * @module js/mfeDeployedTemplateManager
 */
'use strict';

/**
 * call SOA for deployed templates check and save value in ctx
 * @param {String} ctxDeplyedTemplatePath - the ctx path we want to save the deployed templates values at
 * @returns {Promise} promise object
 */
function loadAndSaveCurrentStateDeployedTemplateInfo( ctxDeplyedTemplatePath ) {
    //get the deployed templates from the page state
    const deployedTemplates = defaultLocationSvc.getCurrentState().data.deployedTemplateState;
    if( Array.isArray( deployedTemplates ) && deployedTemplates.length > 0 ) {
        const templateNameToCheck = [];
        //get the deployed templates state from the ctx
        let deployedTemplateState = appCtxSvc.getCtx( ctxDeplyedTemplatePath ) || {};
        deployedTemplates.forEach( ( templateName ) => {
            //only new deployed templates should be checked for status
            if( deployedTemplateState.hasOwnProperty( templateName ) ) {
                return;
            }
            templateNameToCheck.push( templateName );
        } );

        let newTemplateList = [];
        templateNameToCheck.forEach( ( templateName ) => {
            const inputData = {
                templateNames: [ templateName ]
            };
            // curretly getSiteTemplateDeployInfo can check one input at a time
            newTemplateList = soaSvc.postUnchecked( 'Internal-BusinessModeler-2010-09-DataModelManagement', 'getSiteTemplateDeployInfo', inputData ).then(
                ( response ) => {
                    const newDeployedTemplateState = {};
                    deployedTemplateState = appCtxSvc.getCtx( ctxDeplyedTemplatePath ) || {};
                    newDeployedTemplateState[templateName] = Array.isArray( response.templatesDeployInfo );
                    Object.assign( newDeployedTemplateState, deployedTemplateState );
                    appCtxSvc.updatePartialCtx( ctxDeplyedTemplatePath, newDeployedTemplateState );
                    return newDeployedTemplateState;
                } );
        } );
        return newTemplateList;
    }
        return new Promise( ( resolve ) => {
            resolve( null );
        } );
}

let exports = {};
export default exports = {
    loadAndSaveCurrentStateDeployedTemplateInfo
};

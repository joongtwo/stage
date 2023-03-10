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
 * mfe policy service
 *
 * @module js/mfeLicenseManager
 */
'use strict';

/**
 * call SOA for licence check and save value in ctx
 * @param {String} ctxLicensePath - the ctx path we want to save the license values at
 */
function loadAndSaveCurrentStateLicenses( ctxLicensePath ) {
    //get the features keys from the page state
    const featureKeys = defaultLocationSvc.getCurrentState().data.featureKeyLicenses;
    if( featureKeys ) {
        const licAdminInput = [];
        //get the licenses state from the ctx
        const licensesState = appCtxSvc.getCtx( ctxLicensePath ) || {};
        featureKeys.forEach( ( featureKey ) => {
            //only new feature keys licenses should be checked for status
            if( licensesState.hasOwnProperty( featureKey ) ) {
                return;
            }
            licAdminInput.push( {
                featureKey,
                licensingAction: 'check'
            } );
        } );
        if( licAdminInput.length > 0 ) {
            const inputData = {
                licAdminInput
            };
            soaSvc.postUnchecked( 'Core-2019-06-Session', 'licenseAdmin', inputData ).then(
                ( response ) => {
                    const newlicensesState = {};
                    licAdminInput.forEach( ( { featureKey } ) => newlicensesState[featureKey] = true );
                    response.partialErrors && response.partialErrors.forEach( ( error ) => {
                        newlicensesState[error.clientId] = false;
                    } );
                    Object.assign( newlicensesState, licensesState );
                    appCtxSvc.updatePartialCtx( ctxLicensePath, newlicensesState );
                } );
        }
    }
}

let exports = {};
export default exports = {
    loadAndSaveCurrentStateLicenses
};

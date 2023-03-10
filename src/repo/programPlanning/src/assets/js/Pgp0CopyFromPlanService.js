// Copyright (c) 2022 Siemens
/**
 *
 * @module js/Pgp0CopyFromPlanService
 */

import ctxService from 'js/appCtxService';
import _ from 'lodash';
import dateTimeSvc from 'js/dateTimeService';

var exports = {};

/**
 * Method that display current date
 *
 * @returns {Date} Today date
 */
export let getCurrentDate = function( ) {
    return new Date();
};

/**
 * Method that check if PSI0 template is installed.
 *
 * @param {response} response - SOA response
 */

export let checkForPsi0BOTypesfun = function( response, data, fields ) {
    let isPsi0TemplateInstalled = false;
    if( response && response.types && response.types.length > 0 ) {
        isPsi0TemplateInstalled = true;
    }
    ctxService.updateCtx( 'isPsi0TemplateInstalled', isPsi0TemplateInstalled );
    const deliverables = _.clone( data.categoryIncludeDeliverables );
    const checklists = _.clone( data.categoryIncludeChecklists );
    deliverables.dbValue = isPsi0TemplateInstalled;
    checklists.dbValue = isPsi0TemplateInstalled;
    if( fields ) {
        fields.categoryIncludeDeliverables.update( isPsi0TemplateInstalled );
        fields.categoryIncludeChecklists.update( isPsi0TemplateInstalled );
    }
};

export let getDateStringPrimeEventDate = function( dateObject ) {
    let dateValue = {};
    dateObject.setHours( 0, 0, 0 );
    dateValue = dateTimeSvc.formatUTC( dateObject );
    return dateValue;
};

export default exports = {
    getCurrentDate,
    checkForPsi0BOTypesfun,
    getDateStringPrimeEventDate
};

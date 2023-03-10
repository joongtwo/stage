// Copyright 2021 Siemens Product Lifecycle Management Software Inc.


/**
 * service for epRevisionRuleListWidget
 * @module js/epRevisionRuleListWidgetService
 */

import appCtxSvc from 'js/appCtxService';

/**
  * Get the revision rules from the SOA response
  * @param {Object} response SOA response
  * @returns {Array} Array of revision rules
  */
export function getRevisonListFromRes( response ) {
    let revisionRuleListArray = [];
    let revRuleObj = {};
    if( appCtxSvc.ctx.userSession.props.awp0RevRule ) {
        let globalRevRule = appCtxSvc.ctx.userSession.props.awp0RevRule.displayValues[ 0 ];
        revRuleObj.propDisplayValue = globalRevRule;
        revRuleObj.dispValue = globalRevRule;
        revRuleObj.propInternalValue = appCtxSvc.ctx.userSession.props.awp0RevRule.value;
        revisionRuleListArray.push( revRuleObj );
    }
    for( let lovValRow in response.lovValues ) {
        if( response.lovValues.hasOwnProperty( lovValRow ) ) {
            let revRuleListObj = {};
            let targetProgram = response.lovValues[ lovValRow ].propDisplayValues.object_name[ 0 ];
            revRuleListObj.propDisplayValue = targetProgram;
            revRuleListObj.dispValue = targetProgram;
            revRuleListObj.propInternalValue = response.lovValues[ lovValRow ].uid;
            if( revRuleObj.propInternalValue !== revRuleListObj.propInternalValue ) {
                revisionRuleListArray.push( revRuleListObj );
            }
        }
    }
    return revisionRuleListArray;
}

// eslint-disable-next-line no-unused-vars
let exports = {};
export default exports = {
    getRevisonListFromRes
};

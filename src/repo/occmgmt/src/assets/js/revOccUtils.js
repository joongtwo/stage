// Copyright (c) 2022 Siemens

/**
 * @module js/revOccUtils
 */
import appCtxService from 'js/appCtxService';
import cdmSvc from 'soa/kernel/clientDataModel';
import _ from 'lodash';

/* This function will return part and usages from selection
 * @return {Object} array of change input
*/
export const getPartAndUsageListFromSelection = function() {
    const changeInput = [];
    const selectedObjects = appCtxService.ctx.mselected;
    _.forEach( selectedObjects, function( selectedObject ) {
        const awb0Archetype = selectedObject.props.awb0Archetype;
        if ( awb0Archetype.dbValues.length > 0 && awb0Archetype.dbValues[0] !== null && awb0Archetype.dbValues[0] !== '' ) {
            const partObject = cdmSvc.getObject( awb0Archetype.dbValues[0] );
            changeInput.push( partObject );
        }

        const usg0UsageOccRev = selectedObject.props.usg0UsageOccRev;
        if ( usg0UsageOccRev && usg0UsageOccRev.dbValues.length > 0 && usg0UsageOccRev.dbValues[0] !== null && usg0UsageOccRev.dbValues[0] !== '' ) {
            const puObject = cdmSvc.getObject( usg0UsageOccRev.dbValues[0] );
            changeInput.push( puObject );
        }
    } );
    return changeInput;
};

const exports = {
    getPartAndUsageListFromSelection
};

export default exports;

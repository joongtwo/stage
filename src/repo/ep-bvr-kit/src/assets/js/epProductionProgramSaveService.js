// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Production Program Related Service
 *
 * @module js/epProductionProgramSaveService
 */
import localeService from 'js/localeService';
import epSaveHandlerService from 'js/epSaveHandlerService';
import AwPromiseService from 'js/awPromiseService';
import messagingService from 'js/messagingService';
import editHandlerService from 'js/editHandlerService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import _ from 'lodash';

/**
 * saveEdits
 * @param {*} dataSource dataSource
 * @returns {Promise} save action
 */
function saveEdits( dataSource ) {
    const prop = dataSource.getAllModifiedProperties()[ 0 ];
    if( prop.propertyName === epBvrConstants.MFG_PRODUCTION_RATE && prop.newValue === 0 ) {
        const localTextBundle = localeService.getLoadedText( 'AdminMessages' );
        messagingService.showError( localTextBundle.productionRateInvalid );
        const editHandler = editHandlerService.getActiveEditHandler();
        if( editHandler ) {
            editHandler.cancelEdits();
        }
        return AwPromiseService.instance.reject();
    }
    return epSaveHandlerService.getSaveHandler().saveEdits( dataSource );
}

const saveHandler = {
    saveEdits,
    isDirty: epSaveHandlerService.getSaveHandler().isDirty
};

/**
 * Returns the save handler
 *
 * @return {Object} the save handler
 */
export function getSaveHandler() {
    return saveHandler;
}

export default {
    getSaveHandler
};

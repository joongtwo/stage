// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* global
 */

/**
 * @module js/createWorkPackagePopupUtils
 */
import eventBus from 'js/eventBus';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import cdm from 'soa/kernel/clientDataModel';
import epNavigationService from 'js/epNavigationService';

let exports = {};
let _saveEvent = null;
let _imanObjectTypePolicyId = null;

/**
 * Initiate the WP popup
 */
export let initiateWorkPackagePopup = function() {
    _imanObjectTypePolicyId = propertyPolicySvc.register( {
        types: [ {
            name: 'ImanType',
            properties: [ {
                name: 'type_name'
            } ]
        } ]
    } );
    _saveEvent = eventBus.subscribe( 'ep.saveEvents', function( eventData ) {
        _reset();
        let objectToNavigate = cdm.getObject( eventData.saveResults[ 0 ].saveResultObject.uid );
        epNavigationService.navigateToManagePage( objectToNavigate );
    } );

    eventBus.subscribe( 'EpCreateObjectPopupCancel', function() {
        _reset();
    } );
};

/**
 * resets the values
 */
let _reset = function() {
    if( _imanObjectTypePolicyId ) {
        propertyPolicySvc.unregister( _imanObjectTypePolicyId );
        _imanObjectTypePolicyId = null;
    }
    if( _saveEvent ) {
        eventBus.unsubscribe( _saveEvent );
        _saveEvent = null;
    }
};

export default exports = {
    initiateWorkPackagePopup
};

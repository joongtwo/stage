// Copyright (c) 2022 Siemens

/**
 * Service to register and unregister additional property policies in ACE
 * 
 * @module js/occmgmtPropertyPolicyService
 */
import occmgmtUtils from 'js/occmgmtUtils';
import propPolicySvc from 'soa/kernel/propertyPolicyService';

let exports = {};
let policyId;

/**
 * Register property policy
 */
export let registerPropertyPolicy = function() {
    if( occmgmtUtils.isMinimumTCVersion( 13, 2 ) ) {
        let policyIOverrideGetOcc = {
            types: [ {
                name: 'Awb0ConditionalElement',
                properties: [ {
                    name: 'awb0QuantityManaged'
                } ]
            } ]
        };
        policyId = propPolicySvc.register( policyIOverrideGetOcc );
    }
};

/**
 * Un-Register property policy
 */
export let unRegisterPropertyPolicy = function() {
    if( policyId ) {
        propPolicySvc.unregister( policyId );
        policyId = null;
    }
};

/**
 * Occurrence Management Service Manager
 */

export default exports = {
    registerPropertyPolicy,
    unRegisterPropertyPolicy
};

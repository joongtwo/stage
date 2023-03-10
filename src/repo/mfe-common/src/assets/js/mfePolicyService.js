// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import propPolicySvc from 'soa/kernel/propertyPolicyService';

/**
 * mfe policy service
 *
 * @module js/mfePolicyService
 */
'use strict';

const nameToPolicyId = {};

/**
 *
 * @param {string} name - the policy name
 * @param {object} policyObj - the policy object
 */
export function register( name, policyObj ) {
    if( typeof name === 'string' && policyObj && !nameToPolicyId[ name ] ) {
        const policyId = propPolicySvc.register( policyObj );
        nameToPolicyId[ name ] = policyId;
    }
}

/**
 *
 * @param {string} name - the policy name
 */
export function unregister( name ) {
    if( typeof name === 'string' && nameToPolicyId[ name ] ) {
        propPolicySvc.unregister( nameToPolicyId[ name ] );
        delete nameToPolicyId[ name ];
    }
}

let exports = {};
export default exports = {
    register,
    unregister
};

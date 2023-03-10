// Copyright (c) 2022 Siemens

/**
 * Service to register and unregister additional property policies in ACE for types supported by Structure Discovery.
 *
 * @module js/discoveryPropertyPolicyService
 */

import occmgmtUtils from 'js/occmgmtUtils';
import propPolicySvc from 'soa/kernel/propertyPolicyService';

let exports = {};
let worksetPolicyId;

/**
  * Register property policy
  */
export let registerPropertyPolicy = function() {
    if( occmgmtUtils.isMinimumTCVersion( 14, 1 ) && !occmgmtUtils.isMinimumTCVersion( 14, 2 ) ) {
        let worksetPendingChangesProperty = {
            types: [ {
                name: 'Fnd0WorksetRevision',
                properties: [ {
                    name: 'fnd0PendingChanges'
                } ]
            } ]
        };
        worksetPolicyId = propPolicySvc.register( worksetPendingChangesProperty );
    }
};

/**
  * Un-Register property policy
  */
export let unRegisterPropertyPolicy = function() {
    if( worksetPolicyId ) {
        propPolicySvc.unregister( worksetPolicyId );
        worksetPolicyId = null;
    }
};

/**
  * Occurrence Management Service Manager
  */

export default exports = {
    registerPropertyPolicy,
    unRegisterPropertyPolicy
};


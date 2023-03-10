// Copyright (c) 2022 Siemens

/**
 * @module js/Ewi0PartsService
 */
import policySvc from 'soa/kernel/propertyPolicyService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

/**
 * Export
 */
var exports = {};

/**
 * Toggle aggregate current and subsequent Parts command
 *
 * @param {Object} partsData - the parts data
 * @param {Object} relations - relations to load
 * @param {Object} workareasTabs - ewi sublocation workareas tabs views data
 * @param {StringArray} policyIds - List of policy Ids to unregister latter after the soa call
 */
export let toggleAggregateParts = function( partsData, relations, workareasTabs, policyIds ) {
    policyIds = [];
    var aggregateState = partsData.runtimePropertyName;
    if( aggregateState === 'ewi0aggregate_material' ) {
        delete relations.ewi0aggregate_material;
        partsData.runtimePropertyName = 'ewi0aggregateSubsqMaterial';
    } else {
        delete relations.ewi0aggregateSubsqMaterial;
        partsData.runtimePropertyName = 'ewi0aggregate_material';
    }

    relations[ partsData.runtimePropertyName ] = [];

    _.forEach( workareasTabs, function( workareaTabs ) {
        var tabsList = workareaTabs.tabs;
        _.forEach( tabsList, function( tab ) {
            var propPolicy = tab.viewMode.propPolicy;
            if( propPolicy ) {
                var policyId = policySvc.register( propPolicy );
                policyIds.push( policyId );
            }

            if( tab.name === 'Parts' ) {
                if( aggregateState === 'ewi0aggregateSubsqMaterial' ) {
                    tab.relations = {
                        ewi0aggregate_material: []
                    };
                } else {
                    tab.relations = {
                        ewi0aggregateSubsqMaterial: []
                    };
                }
            }
        } );
    } );

    eventBus.publish( 'ewi.getRelated' );
};

/**
 * A glue code to support EWI Parts
 *
 * @param {Object} policySvc - soa_kernel_propertyPolicyService
 *
 * @return {Object} - Service instance
 *
 * @member Ewi0PartsService
 */

export default exports = {
    toggleAggregateParts
};

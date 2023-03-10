// Copyright (c) 2022 Siemens

/**
 * @module js/Ewi0ToolsService
 */
import policySvc from 'soa/kernel/propertyPolicyService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

/**
 * Export
 */
var exports = {};

/**
 * Toggle aggregate current and subsequent Tools command
 *
 * @param {Object} toolsData - the tools data
 * @param {Object} relations - relations to load
 * @param {Object} workareasTabs - ewi sublocation workareas tabs views data
 * @param {StringArray} policyIds - List of policy Ids to unregister latter after the soa call
 *
 */
export let toggleAggregateTools = function( toolsData, relations, workareasTabs, policyIds ) {
    policyIds = [];
    var aggregateState = toolsData.runtimePropertyName;
    if( aggregateState === 'ewi0aggregate_equipment' ) {
        delete relations.ewi0aggregate_equipment;
        toolsData.runtimePropertyName = 'ewi0aggregateSubsqEquipment';
    } else {
        delete relations.ewi0aggregateSubsqEquipment;
        toolsData.runtimePropertyName = 'ewi0aggregate_equipment';
    }

    relations[ toolsData.runtimePropertyName ] = [];

    _.forEach( workareasTabs, function( workareaTabs ) {
        var tabsList = workareaTabs.tabs;
        _.forEach( tabsList, function( tab ) {
            var propPolicy = tab.viewMode.propPolicy;
            if( propPolicy ) {
                var policyId = policySvc.register( propPolicy );
                policyIds.push( policyId );
            }

            if( tab.name === 'Tools' ) {
                if( aggregateState === 'ewi0aggregateSubsqEquipment' ) {
                    tab.relations = {
                        ewi0aggregate_equipment: []
                    };
                } else {
                    tab.relations = {
                        ewi0aggregateSubsqEquipment: []
                    };
                }
            }
        } );
    } );

    eventBus.publish( 'ewi.getRelated' );
};

/**
 * A glue code to support EWI Tools
 *
 * @param {Object} policySvc - soa_kernel_propertyPolicyService
 *
 * @return {Object} - Service instance
 *
 * @member Ewi0ToolsService
 */
export default exports = {
    toggleAggregateTools
};

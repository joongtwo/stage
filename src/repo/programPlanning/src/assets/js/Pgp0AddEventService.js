// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/**
 * @module js/Pgp0AddEventService
 */
import _ from 'lodash';
import addObjectUtils from 'js/addObjectUtils';

var exports = {};
/**
 * Get input data for object creation.
 *
 * @param {Object} data the view model data object
 */
export let getCreateInput = function( data, parentPlanEventSub, parentPlanTimeline, editHandler ) {
    var createInputMap = {};
    let selectionType = {
        dbValue: data.xrtState.xrtTypeLoaded.type
    };
    let objCreateInfo = addObjectUtils.getObjCreateInfo( selectionType, editHandler );
    createInputMap[ '' ] = {
        boName: data.xrtState.xrtTypeLoaded.type,
        propertyNameValues: {},
        compoundCreateInput: {}
    };
    //For BA , use extensionVMProps for additional new props
    let extensionVMProps = {};
    if( parentPlanTimeline ) {
        extensionVMProps.prg0PlanObject = {
            dbValue: parentPlanTimeline
        };
    } else {
        extensionVMProps.prg0PlanObject = {
            dbValue: parentPlanEventSub
        };
    }
    return { extensionVMProps:extensionVMProps, objCreateInfo:objCreateInfo };
};

/**
 * Set the default properties with initial values.
 * @param {*} fields
 * @param {Object} subPanelContext
*/
export let initializeDefaultProps = function( fields, subPanelContext ) {
    var xrtState = { ...fields.xrtState };
    let lovEntry = {
        propDisplayValue: subPanelContext.selectionData.selected[ 0 ].props.object_name.displayValues[ 0 ],
        propInternalValue: subPanelContext.selectionData.selected[ 0 ].uid
    };
    fields.xrtState.xrtVMO.props.prg0TargetParentPlan.setLovVal( { lovEntry }, null );
};

export default exports = {
    getCreateInput,
    initializeDefaultProps
};

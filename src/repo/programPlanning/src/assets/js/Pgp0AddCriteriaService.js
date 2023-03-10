
// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/**
 * @module js/Pgp0AddCriteriaService
 */
import _ from 'lodash';
import addObjectUtils from 'js/addObjectUtils';

var exports = {};
/**
 * Get input data for object creation.
 *
 * @param {Object} data the view model data object
 */
export let getCreateInput = function( objectType, eventUid, editHandler ) {
    var createInputMap = {};
    let selectionType = {
        dbValue: objectType
    };
    let objCreateInfo = addObjectUtils.getObjCreateInfo( selectionType, editHandler );
    createInputMap[ '' ] = {
        boName: objectType,
        propertyNameValues: {},
        compoundCreateInput: {}
    };
    //For BA , use extensionVMProps for additional new props
    let extensionVMProps = {};
    extensionVMProps.prg0EventObject = {
        dbValue: eventUid
    };
    return { extensionVMProps:extensionVMProps, objCreateInfo:objCreateInfo };
};

export default exports = {
    getCreateInput
};

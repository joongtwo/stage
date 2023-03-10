// Copyright (c) 2022 Siemens

/**
 * @module js/MrmCreateNXAssemblyService
 */
import _ from 'lodash';

var exports = {};
export let updateSimplifyHolderGeometryCheckbox = function( simplifyHolderGeometryCheckbox, extractHolderDataSelected ) {
    const newSimplifyHolderGeometryCheckbox = _.clone( simplifyHolderGeometryCheckbox );
    if ( extractHolderDataSelected ) {
        newSimplifyHolderGeometryCheckbox.isEnabled = true;
        newSimplifyHolderGeometryCheckbox.dbValue = true;
        newSimplifyHolderGeometryCheckbox.isEditable = true;
    } else {
        newSimplifyHolderGeometryCheckbox.isEnabled = false;
        newSimplifyHolderGeometryCheckbox.dbValue = false;
        newSimplifyHolderGeometryCheckbox.isEditable = false;
    }

    return newSimplifyHolderGeometryCheckbox;
};

export let setFlagsForCreateNXAssyInProcess = function( createNXAssyInProcess ) {
    const newCreateNXAssyInProcess = _.clone( createNXAssyInProcess );
    newCreateNXAssyInProcess.dbValue = true;
    return newCreateNXAssyInProcess;
};

export default exports = {
    updateSimplifyHolderGeometryCheckbox,
    setFlagsForCreateNXAssyInProcess
};

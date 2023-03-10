// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


/**
 * This service implements common functions.
 *
 * @module js/Pgp0ProgramUtil
 */
var exports = {};

export let processPWASelection = function( modelobject, selectionModel ) {
    if ( modelobject && selectionModel ) {
        selectionModel.setSelection( modelobject.uid );
    }
};

export default exports = {
    processPWASelection
};

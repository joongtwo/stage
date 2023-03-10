// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for Pert
 *
 * @module js/pertUtils
 */



/**
 * This methods updates the input mode of the diagram to move mode
 *
 * @param graphModel - the graph model
 */
export function setMoveMode( graphModel ) {
    graphModel.update( 'config.inputMode', 'viewInputMode' );
}

/**
 * This methods updates the input mode of the diagram to editing mode
 *
 * @param graphModel - the graph model
 */
export function setEditMode( graphModel ) {
    graphModel.update( 'config.inputMode', 'editingMode' );
}

// eslint-disable-next-line no-unused-vars
let exports;
export default exports = {
    setMoveMode,
    setEditMode
};

// Copyright (c) 2022 Siemens

/**
 * This module provides access to an edit handler, which allows for the edit properties page to have several functionality improvements,
 * such as watching for when the edit should be complete or not.
 *
 * @module js/classifyEditPropsService
 */
import editHandlerFactory from 'js/editHandlerFactory';
import dataSourceService from 'js/dataSourceService';
import editHandlerService from 'js/editHandlerService';

let exports = {};

/**
 * Type to edit handler context map
 */
var editHandlerContextConstant = 'EDIT_CLS_PROPERTIES';

/**
 * Create an edit handler for the view model
 */
export let addEditHandler = function( declViewModel ) {
    if( editHandlerContextConstant ) {
        var editHandler = editHandlerFactory.createEditHandler( dataSourceService
            .createNewDataSource( {
                declViewModel: declViewModel
            } ) );
        if( editHandler ) {
            editHandlerService.setEditHandler( editHandler, editHandlerContextConstant );
            // Only set as active if the current edit handler is not in edit mode
            if( !editHandlerService.editInProgress().editInProgress ) {
                //registerEditHandler
                if( editHandler && editHandler.canStartEdit() ) {
                    editHandlerService.setEditHandler( editHandler, 'NONE' );
                    editHandlerService.setActiveEditHandlerContext( 'NONE' );
                    editHandler.startEdit();
                }
            }
        }
    }
};

/**
 * Remove the existing edit handler
 */
export let removeEditHandler = function() {
    if( editHandlerContextConstant ) {
        var editHandler = editHandlerService.getEditHandler( editHandlerContextConstant );
        if( editHandler ) {
            editHandler.leaveConfirmation().then( function() {
                editHandlerService.removeEditHandler( editHandlerContextConstant );
            } );
        }
    }
};

export default exports = {
    addEditHandler,
    removeEditHandler
};

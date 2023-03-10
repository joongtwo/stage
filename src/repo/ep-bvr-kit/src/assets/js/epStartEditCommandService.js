// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


/**
 * @module js/epStartEditCommandService
 */
import editHandlerService from 'js/editHandlerService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';


/**
 * execute the start edit command handler
 *
 * @param {String} handler context
 * @param {Object} object the object to edit
 */
export function execute( handler, object ) {
    //check for autoRevise
    let saveInputWriter = saveInputWriterService.get();
    if( object ) {
        saveInputWriter.addReviseInput( object );
        epSaveService.saveChanges( saveInputWriter, true, [ object ] )
            .then( function( result ) {
                if( !result ) {
                    return;
                }
                // this is required to let save edit know which handler is active.
                if( !handler ) {
                    handler = 'NONE';
                }
                editHandlerService.setActiveEditHandlerContext( handler );
                if( !editHandlerService.isEditEnabled() ) {
                    const editHandler = editHandlerService.getEditHandler( handler );
                    if( !editHandler.editInProgress() ) {
                        editHandler.startEdit();
                    }
                }
            } );
    }
}

export default {
    execute
};

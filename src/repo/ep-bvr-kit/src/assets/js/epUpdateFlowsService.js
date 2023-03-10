// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 *
 * @module js/epUpdateFlowsService
 */

 import _ from 'lodash';
 import messagingService from 'js/messagingService';
 import epSaveService from 'js/epSaveService';
 import saveInputWriterService from 'js/saveInputWriterService';
 import eventBus from 'js/eventBus';
 import localeSvc from 'js/localeService';

 const instrMessagePath = '/i18n/updateFLowsMessages';
 /**
 * @param {Number} objectUid - loadedObject id
 * @param {Number} ParallelFlowsAllowed -  check if parallel flows allowed
 * @param {Number} Recursive - all levels allowed
 *  @returns {Object}
 */

  export function updateFlows( object,parallelFlowsAllowed,data ) {
    const saveInputWriter = saveInputWriterService.get();
    const relatedObject = {
        uid:object.uid,
        type:object.type
    };
    const resource = localeSvc.getLoadedText( instrMessagePath );
    const UpdateFlow = {
        objectUid: object.uid,
        ParallelFlowsAllowed: String(parallelFlowsAllowed),
        Recursive: String(data)
    };
    saveInputWriter.updateFlows( UpdateFlow );

    return epSaveService.saveChanges( saveInputWriter, true, [ relatedObject ]).then( function() {
        eventBus.publish( 'awGraph.initialized' );
        messagingService.showInfo( resource.flowsSuccessfullyUpdated );
    } );
}

export default {
    updateFlows
};
